//! AIFeed content negotiation middleware for Axum.
//!
//! Serves the signed AIFeed overlay (`aifeed site build` output) with HTTP
//! content negotiation: clients asking for `text/aifeed+markdown` (or
//! `text/mako+markdown`) receive the verified markdown plus the inline
//! `X-Aifeed-Signature` header; everyone else falls through to your app.
//!
//! ```rust,no_run
//! use axum::{routing::get, Router};
//! use aifeed_axum::AifeedLayer;
//!
//! async fn index() -> &'static str { "hello" }
//!
//! // Register routes (and any fallback) BEFORE .layer(): axum only wraps
//! // routes that exist when layer() is called.
//! let app: Router = Router::new()
//!     .route("/", get(index))
//!     .layer(AifeedLayer::new("./public"));
//! ```

use std::{
    convert::Infallible,
    future::Future,
    path::{Path, PathBuf},
    pin::Pin,
    task::{Context, Poll},
};

use axum::{
    body::Body,
    http::{header, HeaderMap, HeaderValue, Method, Request, StatusCode, Uri},
    response::Response,
};
use tower::{Layer, Service};

pub const MEDIA_AIMD: &str = "text/aifeed+markdown";
pub const MEDIA_MAKO: &str = "text/mako+markdown";

/// Middleware configuration. Mirrors the Go adapter's `Handler(next, root, aimd, mako)`.
#[derive(Clone, Debug)]
pub struct AifeedLayer {
    root: PathBuf,
    aimd: bool,
    mako: bool,
}

impl AifeedLayer {
    /// Serve the AIFeed overlay rooted at `root` (both profiles enabled).
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            root: root.into(),
            aimd: true,
            mako: true,
        }
    }

    /// Enable or disable the native AIFeed Markdown profile.
    pub fn aimd(mut self, enabled: bool) -> Self {
        self.aimd = enabled;
        self
    }

    /// Enable or disable the MAKO compatibility profile.
    pub fn mako(mut self, enabled: bool) -> Self {
        self.mako = enabled;
        self
    }
}

impl<S> Layer<S> for AifeedLayer {
    type Service = AifeedService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        AifeedService {
            inner,
            layer: self.clone(),
        }
    }
}

/// Tower service produced by [`AifeedLayer`].
#[derive(Clone, Debug)]
pub struct AifeedService<S> {
    inner: S,
    layer: AifeedLayer,
}

type BoxFuture<T> = Pin<Box<dyn Future<Output = T> + Send>>;

impl<S> Service<Request<Body>> for AifeedService<S>
where
    S: Service<Request<Body>, Response = Response, Error = Infallible>
        + Clone
        + Send
        + 'static,
    S::Future: Send + 'static,
{
    type Response = Response;
    type Error = Infallible;
    type Future = BoxFuture<Result<Response, Infallible>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Infallible>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<Body>) -> Self::Future {
        if let Some(response) = try_serve(&self.layer, req.method(), req.uri(), req.headers()) {
            return Box::pin(async move { Ok(response) });
        }
        let mut inner = self.inner.clone();
        Box::pin(async move { inner.call(req).await })
    }
}

fn try_serve(layer: &AifeedLayer, method: &Method, uri: &Uri, headers: &HeaderMap) -> Option<Response> {
    if *method != Method::GET && *method != Method::HEAD {
        return None;
    }
    let root = std::path::absolute(&layer.root).ok()?;
    let path = uri.path();

    for (route, file, enabled) in [
        ("/.well-known/ai.json", "ai.json", layer.aimd || layer.mako),
        (
            "/.well-known/ai-signature.json",
            "ai-signature.json",
            layer.aimd || layer.mako,
        ),
        (
            "/.well-known/aifeed-index.json",
            "aifeed-index.json",
            layer.aimd,
        ),
        (
            "/.well-known/aifeed-index.json.sig",
            "aifeed-index.json.sig",
            layer.aimd,
        ),
        ("/.well-known/mako-index.json", "mako-index.json", layer.mako),
        (
            "/.well-known/mako-index.json.sig",
            "mako-index.json.sig",
            layer.mako,
        ),
    ] {
        if path != route {
            continue;
        }
        if !enabled {
            return None;
        }
        return serve_file(&root, Path::new(".well-known").join(file), "application/json; charset=utf-8", method);
    }
    if path == "/llms.txt" {
        return serve_file(&root, PathBuf::from("llms.txt"), "text/plain; charset=utf-8", method);
    }

    let accept = headers
        .get(header::ACCEPT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    let profile = if layer.aimd && accept.contains(MEDIA_AIMD) {
        "aimd"
    } else if layer.mako && accept.contains(MEDIA_MAKO) {
        "mako"
    } else {
        return None;
    };
    let suffix = if profile == "mako" { ".mako.md" } else { ".aifeed.md" };
    let clean = path.trim_matches('/');
    let mut candidates = vec![format!("index{suffix}")];
    if !clean.is_empty() {
        candidates = vec![format!("{clean}{suffix}"), format!("{clean}/index{suffix}")];
    }
    for candidate in candidates {
        let resolved = match safe_join(&root, Path::new(&candidate)) {
            Some(resolved) => resolved,
            None => continue,
        };
        let body = match std::fs::read(&resolved) {
            Ok(body) => body,
            Err(_) => continue,
        };
        return Some(serve_markdown(&body, &resolved, profile, method));
    }
    None
}

fn safe_join(root: &Path, relative: &Path) -> Option<PathBuf> {
    let mut target = root.to_path_buf();
    for part in relative.components() {
        match part {
            std::path::Component::Normal(piece) => target.push(piece),
            std::path::Component::CurDir => {}
            _ => return None,
        }
    }
    if target == *root || target.starts_with(root) {
        Some(target)
    } else {
        None
    }
}

fn serve_file(root: &Path, relative: PathBuf, content_type: &str, method: &Method) -> Option<Response> {
    let resolved = safe_join(root, &relative)?;
    let body = std::fs::read(resolved).ok()?;
    let builder = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "public, max-age=3600, must-revalidate")
        .header(header::CONTENT_LENGTH, body.len());
    if *method == Method::HEAD {
        builder.body(Body::empty())
    } else {
        builder.body(Body::from(body))
    }
    .ok()
}

fn media_type(profile: &str) -> &'static str {
    if profile == "mako" {
        MEDIA_MAKO
    } else {
        MEDIA_AIMD
    }
}

fn frontmatter_block(text: &str) -> &str {
    let rest = text
        .strip_prefix("---\r\n")
        .or_else(|| text.strip_prefix("---\n"))
        .unwrap_or("");
    match rest.find("---") {
        Some(index) => &rest[..index],
        None => "",
    }
}

fn frontmatter_field(text: &str, key: &str) -> String {
    for line in frontmatter_block(text).lines() {
        let trimmed = line.trim();
        let Some((name, rest)) = trimmed.split_once(':') else {
            continue;
        };
        if name.trim() != key {
            continue;
        }
        let mut value = rest.trim().to_string();
        if let Some(index) = value.find(" #") {
            value = value[..index].trim().to_string();
        }
        return value.trim_matches('"').to_string();
    }
    String::new()
}

fn header_value(text: &str, fallback: &'static str) -> HeaderValue {
    let clean: String = text
        .chars()
        .filter(|c| (' '..='~').contains(c))
        .collect();
    let trimmed = clean.trim();
    let value = if trimmed.is_empty() { fallback } else { trimmed };
    HeaderValue::from_str(value).unwrap_or_else(|_| HeaderValue::from_static(""))
}

fn base64url_nopad(input: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);
    for chunk in input.chunks(3) {
        let word = ((chunk[0] as u32) << 16)
            | (if chunk.len() > 1 { (chunk[1] as u32) << 8 } else { 0 })
            | (if chunk.len() > 2 { chunk[2] as u32 } else { 0 });
        out.push(ALPHABET[((word >> 18) & 63) as usize] as char);
        out.push(ALPHABET[((word >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[((word >> 6) & 63) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[(word & 63) as usize] as char);
        }
    }
    out
}

fn serve_markdown(body: &[u8], md_path: &Path, profile: &str, method: &Method) -> Response {
    let text = String::from_utf8_lossy(body);
    let prefix = if profile == "mako" { "mako1:" } else { "aimd1:" };
    let mut builder = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, media_type(profile).to_owned() + "; charset=utf-8")
        .header(header::VARY, "Accept")
        .header("X-Mako-Version", "1.0")
        .header("X-Mako-Tokens", header_value(&frontmatter_field(&text, "tokens"), "0"))
        .header(
            "X-Mako-Type",
            header_value(&frontmatter_field(&text, "type"), "custom"),
        )
        .header("X-Mako-Lang", header_value(&frontmatter_field(&text, "language"), "en"))
        .header("X-Aifeed-Profile", profile);
    if let Ok(container) = std::fs::read(md_path.with_extension("md.sig")) {
        let trimmed = String::from_utf8_lossy(&container).trim().to_string();
        if !trimmed.is_empty() {
            let encoded = HeaderValue::from_str(&(prefix.to_owned() + &base64url_nopad(trimmed.as_bytes())));
            if let Ok(value) = encoded {
                builder = builder.header("X-Aifeed-Signature", value);
            }
        }
    }
    let builder = builder.header(header::CONTENT_LENGTH, body.len());
    (if *method == Method::HEAD {
        builder.body(Body::empty())
    } else {
        builder.body(Body::from(body.to_vec()))
    })
    .unwrap_or_else(|_| {
        Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .body(Body::empty())
            .unwrap()
    })
}

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn base64url_matches_known_vector() {
        assert_eq!(base64url_nopad(b"hello"), "aGVsbG8");
        assert_eq!(base64url_nopad(b"f"), "Zg");
        assert_eq!(base64url_nopad(b"fo"), "Zm8");
        assert_eq!(base64url_nopad(b"foob"), "Zm9vYg");
        assert_eq!(base64url_nopad(b""), "");
    }

    #[test]
    fn frontmatter_fields_parse() {
        let text = "---\ntype: article\ntokens: 42 # words\nlanguage: \"id\"\n---\n\nBody\n";
        assert_eq!(frontmatter_field(text, "tokens"), "42");
        assert_eq!(frontmatter_field(text, "type"), "article");
        assert_eq!(frontmatter_field(text, "language"), "id");
        assert_eq!(frontmatter_field(text, "missing"), "");
        assert_eq!(frontmatter_field("", "type"), "");
        assert_eq!(frontmatter_field("Body\n---\ntype: x\n", "type"), "");
    }

    #[test]
    fn safe_join_blocks_traversal() {
        let root = Path::new("/srv/public");
        assert!(safe_join(root, Path::new("a.aifeed.md")).is_some());
        assert!(safe_join(root, Path::new("sub/index.aifeed.md")).is_some());
        assert!(safe_join(root, Path::new("../secret")).is_none());
        assert!(safe_join(root, Path::new("/etc/passwd")).is_none());
    }
}
