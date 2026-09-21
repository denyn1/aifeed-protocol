# AIFeed Integrations — any platform, not just WordPress

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

`aifeed site build <dir>` turns **any** static output (Hugo, Jekyll, Astro, Eleventy,
Next.js export, Vite, plain HTML, …) into an AIFeed origin: signed manifest, delta
index, per-page AIFeed Markdown documents, signature sidecars, and optional `llms.txt`. Server
adapters then add content negotiation and inline signatures for dynamic stacks.

```bash
aifeed keygen --out .aifeed
aifeed site build public --domain example.com --key .aifeed/aifeed-private.pem \
  --profile both --llms --inject
```

## Matrix

| Platform | Serve (negotiation) | Files to use |
|---|---|---|
| Static hosting (Netlify, GitHub Pages, S3, …) | explicit endpoints (`/path.aifeed.md`, `/path.mako.md` + `<link rel="alternate">`; `--inject` writes them) | `aifeed site build` output |
| Vite (build plugin) | signs `build.outDir` and injects alternates | [`@aifeed/frameworks/vite`](../packages/aifeed-frameworks/README.md) |
| Astro (integration) | signs the `astro:build:done` output | [`@aifeed/frameworks/astro`](../packages/aifeed-frameworks/README.md) |
| Next.js static export | `postbuild` → `aifeed-next` signs `out/` | [`@aifeed/frameworks/next`](../packages/aifeed-frameworks/README.md) |
| nginx | Accept → `.aifeed.md` / `.mako.md` rewrite | [`nginx/aifeed-content.conf`](nginx/aifeed-content.conf) |
| Caddy | Accept → `.aifeed.md` / `.mako.md` rewrite | [`caddy/Caddyfile`](caddy/Caddyfile) |
| Apache | mod_rewrite + ForceType | [`apache/.htaccess`](apache/.htaccess) |
| Traefik (v2/v3) | Accept → `.aifeed.md` / `.mako.md` rewrite | [`traefik/aifeed.yml`](traefik/aifeed.yml) |
| Node / Express / plain http | handler + inline signature | [`node/aifeed-serve.js`](node/aifeed-serve.js) |
| Next.js (App Router) | middleware + route handler | [`nextjs/middleware.js`](nextjs/middleware.js), [`nextjs/app/api/aifeed/route.js`](nextjs/app/api/aifeed/route.js) |
| PHP (non-WordPress) | `aifeed_serve()` front-controller check | [`php/aifeed-serve.php`](php/aifeed-serve.php) |
| Python ASGI (FastAPI/Starlette/Django) | `AifeedMiddleware` | [`python/aifeed_middleware.py`](python/aifeed_middleware.py) |
| Go (net/http) | `aifeed.Handler(next, root, aimd, mako)` | [`go/aifeed.go`](go/aifeed.go) |
| Rust (Axum) | `AifeedLayer` middleware (negotiation + inline signatures) | [`rust/`](rust/) |
| Cloudflare Workers (static assets) | Accept → `.aifeed.md` / `.mako.md` via the `ASSETS` binding | [`cloudflare/worker.mjs`](cloudflare/worker.mjs), [`cloudflare/wrangler.template.toml`](cloudflare/wrangler.template.toml) |
| CI/CD | build + sign + verify before deploy | [`github-action/aifeed.yml`](github-action/aifeed.yml) |
| WordPress | plugin with dual-stack serving + admin | `wp-plugin/` |

## Static hosting note

Plain file hosts cannot negotiate `Accept`. Use the **explicit endpoint** pattern, which
the spec allows: each HTML page links to its markdown files
(`<link rel="alternate" type="text/aifeed+markdown" href="/path.aifeed.md">` and, for the
MAKO profile, `type="text/mako+markdown" href="/path.mako.md"`). `aifeed site build
--inject` adds those link tags automatically. Signatures live in `{file}.sig` sidecars
(for example `/artikel/satu.aifeed.md.sig`) and their context matches the media type.

## Asset files (images, PDFs, downloads)

Pages list their media and downloadable files under `aifeed.assets` in the signed
frontmatter — references only, never inlined. `aifeed site build` fills `mime` from the
file extension and, for files present in the source directory (≤16 MiB), adds `size` and
`sha-256`; agents can verify a download with `sdk.verifyAsset(bytes, asset)` before using
it. Edge policy applies to asset paths too: on the strict demo origin,
`/assets/logo.svg` returns 403 for training crawlers and 200 for everyone else.

## File naming

`aifeed site build` is profile-aware:

| `--profile` | Files written per page | Index | Manifest |
|---|---|---|---|
| `aimd` (default) | `{path}.aifeed.md` + `.sig` | `/.well-known/aifeed-index.json` (+`.sig`) | `content.profile: aifeed-md` |
| `mako` | `{path}.mako.md` + `.sig` | `/.well-known/mako-index.json` (+`.sig`) | `content.profile: mako` |
| `both` | both files, each with `.sig` | both indices | `content.profile: both` |

Directory indexes use `{dir}/index.aifeed.md` (or `.mako.md`) and are served at the clean
path (`/dir`). Signature context inside each `.sig` matches its media type
(`aimd` / `mako`); cross-context replay is rejected by SDKs.

## Platform quickstarts

### Static / SSG (Hugo, Jekyll, Astro, Eleventy, Vite, Next export)

Framework plugins sign the build output automatically:

```bash
npm install --save-dev @aifeed/frameworks@next
npx aifeed-build keygen --out .aifeed    # once per project
```

```js
// vite.config.js
import { aifeed } from '@aifeed/frameworks/vite';
export default { plugins: [aifeed({ domain: 'example.com', keyPath: '.aifeed/aifeed-private.pem' })] };
```

```js
// astro.config.mjs
import aifeed from '@aifeed/frameworks/astro';
export default { integrations: [aifeed({ domain: 'example.com', keyPath: '.aifeed/aifeed-private.pem' })] };
```

```jsonc
// Next.js static export — package.json
{ "scripts": { "postbuild": "aifeed-next --domain example.com --key .aifeed/aifeed-private.pem" } }
```

Or sign any output manually with the CLI:

```bash
aifeed site build public --domain example.com --key .aifeed/aifeed-private.pem \
  --profile both --llms --inject
# deploy ./public as-is: .well-known/, *.aifeed.md, *.mako.md, *.sig, llms.txt
```

Explicit endpoints (no Accept negotiation needed):
`https://example.com/artikel/satu.aifeed.md` and `.../satu.mako.md`.

### nginx / Caddy / Apache

1. Build as above (put the output in your web root).
2. Copy the config: `nginx/aifeed-content.conf`, `caddy/Caddyfile`, or `apache/.htaccess`
   (adjust `root`/`server_name`/`ORIGIN`).
3. Reload and verify:

```bash
curl -sI -H 'Accept: text/aifeed+markdown' https://example.com/artikel/satu \
  | grep -Ei 'HTTP|content-type|vary|x-aifeed|x-mako'
curl -sI -H 'Accept: text/mako+markdown' https://example.com/artikel/satu \
  | grep -Ei 'content-type|x-aifeed'
curl -sI https://example.com/.well-known/ai.json | grep -Ei 'HTTP|content-type'
curl -sI https://example.com/artikel | grep -Ei 'HTTP|content-type'   # nested index
```

### Node / Express / Fastify / plain http

```js
const http = require('node:http');
const { createAifeedHandler } = require('./integrations/node/aifeed-serve');

const handle = createAifeedHandler({ root: './public', mako: true });
http.createServer((req, res) => {
  if (handle(req, res)) return;      // manifest, index, llms.txt, AIFeed Markdown/MAKO
  res.writeHead(404); res.end('not found');
}).listen(8080);

// Express: app.use((req, res, next) => { if (!handle(req, res)) next(); });
```

### Next.js (App Router)

Copy [`nextjs/middleware.js`](nextjs/middleware.js) and
[`nextjs/app/api/aifeed/route.js`](nextjs/app/api/aifeed/route.js) into your app. Static
exports cannot negotiate: use `--inject` and the explicit endpoints instead.

### PHP (non-WordPress)

```php
require __DIR__ . '/integrations/php/aifeed-serve.php';
if (aifeed_serve(__DIR__ . '/public', ['mako' => true])) {
    exit; // served by AIFeed before your normal routing
}
```

### Python ASGI (FastAPI, Starlette, Django)

```python
from aifeed_middleware import AifeedMiddleware
app.add_middleware(AifeedMiddleware, root="public", mako=True)
```

### Go (net/http)

```go
http.Handle("/", aifeed.Handler(http.FileServer(http.Dir("public")), "public", true, true))
```

### Rust (Axum)

```rust
use axum::{routing::get, Router};
use aifeed_axum::AifeedLayer;

async fn index() -> &'static str { "hello" }

// Register routes (and any fallback) BEFORE .layer(): axum only wraps
// middleware around routes that exist when layer() is called.
let app: Router = Router::new()
    .route("/", get(index))
    .layer(AifeedLayer::new("./public"));
```

```bash
cd integrations/rust && cargo test   # negotiation, headers, traversal guard
```

### Traefik (v2/v3)

```bash
traefik --providers.file.filename=integrations/traefik/aifeed.yml
# set ORIGIN_HOST / ORIGIN_PORT inside the file first
```

### Cloudflare Workers (static assets)

```bash
cp integrations/cloudflare/worker.mjs ./worker.mjs
cp integrations/cloudflare/wrangler.template.toml ./wrangler.toml   # point [assets].directory at your build output
npx wrangler deploy
```

Request directory URLs with a trailing slash (`/dir/`) to receive markdown; `/dir`
falls back to the HTML asset.

## Verify after deploy

```bash
aifeed validate public --domain example.com --json          # manifest offline
curl -s https://example.com/.well-known/aifeed-index.json.sig | head -c 200
aifeed aimd fetch https://example.com/artikel/satu --key .aifeed/aifeed-public.txt --json
aifeed mako fetch https://example.com/artikel/satu --key .aifeed/aifeed-public.txt --json --format mako
```

`aifeed keygen --out .aifeed` writes `.aifeed/aifeed-public.txt`; the private key never
leaves your machine except through CI secrets.

## How verification works for clients

1. Fetch `/.well-known/ai.json` (signed, DNS-anchored) → permissions and limits.
2. Fetch the delta index (`/.well-known/aifeed-index.json` + `.sig`).
3. Request the page with `Accept: text/aifeed+markdown` (or `text/mako+markdown`), or
   fetch the explicit `.aifeed.md` / `.mako.md` URL, then verify the inline
   `X-Aifeed-Signature` or sidecar `{file}.sig` against the manifest key.

Adapters set `Vary: Accept`, the MAKO header set, `X-Aifeed-Profile`, and inline
`aimd1:`/`mako1:` signatures when sidecars are present.
