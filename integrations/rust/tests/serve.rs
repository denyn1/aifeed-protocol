use std::{
    path::PathBuf,
    sync::atomic::{AtomicUsize, Ordering},
};

use axum::{
    body::Body,
    http::{Request, StatusCode},
    routing::get,
    Router,
};
use tower::ServiceExt;

use aifeed_axum::{AifeedLayer, MEDIA_AIMD, MEDIA_MAKO};

static COUNTER: AtomicUsize = AtomicUsize::new(0);

struct Fixture {
    dir: PathBuf,
}

impl Fixture {
    fn create() -> Self {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!("aifeed-rust-{}-{}", std::process::id(), id));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("docs")).unwrap();
        std::fs::create_dir_all(dir.join(".well-known")).unwrap();
        std::fs::write(dir.join("index.html"), "<h1>hi</h1>").unwrap();
        std::fs::write(
            dir.join("index.aifeed.md"),
            "---\ntype: article\ntokens: 12\nlanguage: en\n---\n\n# Hi\n\nBody.\n",
        )
        .unwrap();
        std::fs::write(dir.join("index.aifeed.md.sig"), "{\"signature\":\"test\"}").unwrap();
        std::fs::write(
            dir.join("docs").join("index.aifeed.md"),
            "---\ntype: docs\ntokens: 7\nlanguage: en\n---\n\n# Docs\n",
        )
        .unwrap();
        std::fs::write(
            dir.join("plain.aifeed.md"),
            "---\ntype: article\ntokens: 3\nlanguage: en\n---\n\nPlain.\n",
        )
        .unwrap();
        std::fs::write(dir.join(".well-known").join("ai.json"), "{\"ok\":true}").unwrap();
        std::fs::write(dir.join("llms.txt"), "# test\n").unwrap();
        Self { dir }
    }

    fn app(&self, layer: AifeedLayer) -> Router {
        // NOTE: axum applies Router::layer only to routes registered so far —
        // the fallback must be registered BEFORE .layer(), otherwise unmatched
        // paths bypass the middleware (see axum docs for Router::layer).
        Router::new()
            .route("/", get(|| async { "html home" }))
            .fallback(inner_404)
            .layer(layer)
    }

    fn layer(&self) -> AifeedLayer {
        AifeedLayer::new(&self.dir)
    }
}

async fn inner_404() -> (StatusCode, &'static str) {
    (StatusCode::NOT_FOUND, "inner 404")
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

async fn body_text(response: axum::response::Response) -> (StatusCode, Vec<(String, String)>, String) {
    let status = response.status();
    let headers = response
        .headers()
        .iter()
        .map(|(name, value)| (name.to_string(), value.to_str().unwrap_or("").to_string()))
        .collect::<Vec<_>>();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    (
        status,
        headers,
        String::from_utf8_lossy(&bytes).to_string(),
    )
}

fn header<'a>(headers: &'a [(String, String)], name: &str) -> &'a str {
    headers
        .iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.as_str())
        .unwrap_or("")
}

fn make_request(path: &str, accept: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder().uri(path);
    if let Some(value) = accept {
        builder = builder.header("accept", value);
    }
    builder.body(Body::empty()).unwrap()
}

#[tokio::test]
async fn serves_manifest_and_llms() {
    let fixture = Fixture::create();
    let app = fixture.app(fixture.layer());

    let (status, _, body) = body_text(app.oneshot(make_request("/.well-known/ai.json", None)).await.unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains("\"ok\":true"));

    let app = fixture.app(fixture.layer());
    let (status, headers, _) = body_text(app.oneshot(make_request("/llms.txt", None)).await.unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    assert!(header(&headers, "content-type").contains("text/plain"));
}

#[tokio::test]
async fn negotiates_aimd_on_clean_path() {
    let fixture = Fixture::create();
    let app = fixture.app(fixture.layer());
    let (status, headers, body) = body_text(app.oneshot(make_request("/", Some(MEDIA_AIMD))).await.unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    assert!(header(&headers, "content-type").contains(MEDIA_AIMD));
    assert_eq!(header(&headers, "vary"), "Accept");
    assert_eq!(header(&headers, "x-aifeed-profile"), "aimd");
    assert_eq!(header(&headers, "x-mako-tokens"), "12");
    assert!(header(&headers, "x-aifeed-signature").starts_with("aimd1:"));
    assert!(body.contains("# Hi"));
}

#[tokio::test]
async fn falls_through_without_accept() {
    let fixture = Fixture::create();
    let app = fixture.app(fixture.layer());
    let (status, _, body) = body_text(app.oneshot(make_request("/", None)).await.unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, "html home");
}

#[tokio::test]
async fn disabled_profile_falls_through() {
    let fixture = Fixture::create();
    let app = fixture.app(fixture.layer().mako(false));
    let (_, _, body) = body_text(app.oneshot(make_request("/", Some(MEDIA_MAKO))).await.unwrap()).await;
    assert_eq!(body, "html home");

    let app = fixture.app(fixture.layer().aimd(false));
    let (_, _, body) = body_text(app.oneshot(make_request("/", Some(MEDIA_AIMD))).await.unwrap()).await;
    assert_eq!(body, "html home");
}

#[tokio::test]
async fn serves_directory_index_and_omits_missing_signature() {
    let fixture = Fixture::create();
    let app = fixture.app(fixture.layer());
    let (status, _, body) = body_text(app.oneshot(make_request("/docs", Some(MEDIA_AIMD))).await.unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains("# Docs"));

    let app = fixture.app(fixture.layer());
    let (_, headers, _) = body_text(app.oneshot(make_request("/plain", Some(MEDIA_AIMD))).await.unwrap()).await;
    assert_eq!(header(&headers, "x-aifeed-profile"), "aimd");
    assert_eq!(header(&headers, "x-aifeed-signature"), "");
}

#[tokio::test]
async fn head_returns_headers_without_body() {
    let fixture = Fixture::create();
    let app = fixture.app(fixture.layer());
    let request = Request::builder()
        .uri("/")
        .method("HEAD")
        .header("accept", MEDIA_AIMD)
        .body(Body::empty())
        .unwrap();
    let expected = std::fs::read(fixture.dir.join("index.aifeed.md")).unwrap().len().to_string();
    let (status, headers, body) = body_text(app.oneshot(request).await.unwrap()).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, "");
    assert_eq!(header(&headers, "content-length"), expected.as_str());
}

#[tokio::test]
async fn rejects_traversal_and_unknown_paths() {
    let fixture = Fixture::create();
    let app = fixture.app(fixture.layer());
    let (status, _, _) = body_text(
        app.oneshot(make_request("/sub/../../etc/passwd", Some(MEDIA_AIMD)))
            .await
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let app = fixture.app(fixture.layer());
    let (status, _, _) = body_text(app.oneshot(make_request("/missing", Some(MEDIA_AIMD))).await.unwrap()).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}
