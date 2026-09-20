# Integrasi AIFeed — platform apa pun, bukan hanya WordPress

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

`aifeed site build <dir>` mengubah output statis **apa pun** (Hugo, Jekyll, Astro,
Eleventy, ekspor Next.js, Vite, HTML polos, …) menjadi origin AIFeed: manifest bertanda
tangan, indeks delta, dokumen AIFeed Markdown per halaman, sidecar tanda tangan, dan
`llms.txt` opsional. Adapter server lalu menambahkan negosiasi konten dan tanda tangan
inline untuk stack dinamis.

```bash
aifeed keygen --out .aifeed
aifeed site build public --domain example.com --key .aifeed/aifeed-private.pem \
  --profile both --llms --inject
```

## Matriks

| Platform | Menyajikan (negosiasi) | File yang dipakai |
|---|---|---|
| Hosting statis (Netlify, GitHub Pages, S3, …) | endpoint eksplisit (`/path.aifeed.md`, `/path.mako.md` + `<link rel="alternate">`; `--inject` menulisnya) | output `aifeed site build` |
| nginx | Accept → rewrite `.aifeed.md` / `.mako.md` | [`nginx/aifeed-content.conf`](nginx/aifeed-content.conf) |
| Caddy | Accept → rewrite `.aifeed.md` / `.mako.md` | [`caddy/Caddyfile`](caddy/Caddyfile) |
| Apache | mod_rewrite + ForceType | [`apache/.htaccess`](apache/.htaccess) |
| Traefik (v2/v3) | Accept → rewrite `.aifeed.md` / `.mako.md` | [`traefik/aifeed.yml`](traefik/aifeed.yml) |
| Node / Express / http polos | handler + tanda tangan inline | [`node/aifeed-serve.js`](node/aifeed-serve.js) |
| Next.js (App Router) | middleware + route handler | [`nextjs/middleware.js`](nextjs/middleware.js), [`nextjs/app/api/aifeed/route.js`](nextjs/app/api/aifeed/route.js) |
| PHP (non-WordPress) | cek front-controller `aifeed_serve()` | [`php/aifeed-serve.php`](php/aifeed-serve.php) |
| Python ASGI (FastAPI/Starlette/Django) | `AifeedMiddleware` | [`python/aifeed_middleware.py`](python/aifeed_middleware.py) |
| Go (net/http) | `aifeed.Handler(next, root, aimd, mako)` | [`go/aifeed.go`](go/aifeed.go) |
| Cloudflare Workers (aset statis) | Accept → `.aifeed.md` / `.mako.md` via binding `ASSETS` | [`cloudflare/worker.mjs`](cloudflare/worker.mjs), [`cloudflare/wrangler.template.toml`](cloudflare/wrangler.template.toml) |
| CI/CD | build + tanda tangan + verifikasi sebelum deploy | [`github-action/aifeed.yml`](github-action/aifeed.yml) |
| WordPress | plugin dengan penyajian dual-stack + admin | `wp-plugin/` |

## Catatan hosting statis

Host file biasa tidak dapat menegosiasikan `Accept`. Gunakan pola **endpoint eksplisit**
yang diizinkan spec: setiap halaman HTML menautkan file markdown-nya
(`<link rel="alternate" type="text/aifeed+markdown" href="/path.aifeed.md">` dan, untuk
profil MAKO, `type="text/mako+markdown" href="/path.mako.md"`). `aifeed site build
--inject` menambahkan tag link itu secara otomatis. Tanda tangan berada di sidecar
`{file}.sig` (misalnya `/artikel/satu.aifeed.md.sig`) dan konteksnya cocok dengan media
type.

## Penamaan file

`aifeed site build` sadar-profil:

| `--profile` | File per halaman | Indeks | Manifest |
|---|---|---|---|
| `aimd` (default) | `{path}.aifeed.md` + `.sig` | `/.well-known/aifeed-index.json` (+`.sig`) | `content.profile: aifeed-md` |
| `mako` | `{path}.mako.md` + `.sig` | `/.well-known/mako-index.json` (+`.sig`) | `content.profile: mako` |
| `both` | kedua file, masing-masing dengan `.sig` | kedua indeks | `content.profile: both` |

Indeks direktori memakai `{dir}/index.aifeed.md` (atau `.mako.md`) dan disajikan di path
bersih (`/dir`). Konteks tanda tangan di dalam tiap `.sig` cocok dengan media type-nya
(`aimd` / `mako`); replay lintas konteks ditolak oleh SDK.

## Quickstart platform

### Statis / SSG (Hugo, Jekyll, Astro, Eleventy, Vite, Next export)

```bash
aifeed site build public --domain example.com --key .aifeed/aifeed-private.pem \
  --profile both --llms --inject
# deploy ./public apa adanya: .well-known/, *.aifeed.md, *.mako.md, *.sig, llms.txt
```

Endpoint eksplisit (tanpa negosiasi Accept):
`https://example.com/artikel/satu.aifeed.md` dan `.../satu.mako.md`.

### nginx / Caddy / Apache

1. Build seperti di atas (taruh output di web root Anda).
2. Salin konfigurasinya: `nginx/aifeed-content.conf`, `caddy/Caddyfile`, atau
   `apache/.htaccess` (sesuaikan `root`/`server_name`/`ORIGIN`).
3. Reload dan verifikasi:

```bash
curl -sI -H 'Accept: text/aifeed+markdown' https://example.com/artikel/satu \
  | grep -Ei 'HTTP|content-type|vary|x-aifeed|x-mako'
curl -sI -H 'Accept: text/mako+markdown' https://example.com/artikel/satu \
  | grep -Ei 'content-type|x-aifeed'
curl -sI https://example.com/.well-known/ai.json | grep -Ei 'HTTP|content-type'
curl -sI https://example.com/artikel | grep -Ei 'HTTP|content-type'   # indeks bersarang
```

### Node / Express / Fastify / http polos

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

Salin [`nextjs/middleware.js`](nextjs/middleware.js) dan
[`nextjs/app/api/aifeed/route.js`](nextjs/app/api/aifeed/route.js) ke aplikasi Anda.
Ekspor statis tidak dapat bernegosiasi: gunakan `--inject` dan endpoint eksplisit.

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

### Traefik (v2/v3)

```bash
traefik --providers.file.filename=integrations/traefik/aifeed.yml
# set ORIGIN_HOST / ORIGIN_PORT di dalam berkas dulu
```

### Cloudflare Workers (aset statis)

```bash
cp integrations/cloudflare/worker.mjs ./worker.mjs
cp integrations/cloudflare/wrangler.template.toml ./wrangler.toml   # arahkan [assets].directory ke output build Anda
npx wrangler deploy
```

Minta URL direktori dengan trailing slash (`/dir/`) untuk menerima markdown; `/dir`
jatuh ke aset HTML.

## Verifikasi setelah deploy

```bash
aifeed validate public --domain example.com --json          # manifest offline
curl -s https://example.com/.well-known/aifeed-index.json.sig | head -c 200
aifeed aimd fetch https://example.com/artikel/satu --key .aifeed/aifeed-public.txt --json
aifeed mako fetch https://example.com/artikel/satu --key .aifeed/aifeed-public.txt --json --format mako
```

`aifeed keygen --out .aifeed` menulis `.aifeed/aifeed-public.txt`; private key tidak
pernah meninggalkan mesin Anda kecuali lewat secret CI.

## Bagaimana verifikasi bekerja untuk klien

1. Fetch `/.well-known/ai.json` (bertanda tangan, ber-anchor DNS) → izin dan batas.
2. Fetch indeks delta (`/.well-known/aifeed-index.json` + `.sig`).
3. Minta halaman dengan `Accept: text/aifeed+markdown` (atau `text/mako+markdown`), atau
   fetch URL eksplisit `.aifeed.md` / `.mako.md`, lalu verifikasi
   `X-Aifeed-Signature` inline atau sidecar `{file}.sig` terhadap kunci manifest.

Adapter menyetel `Vary: Accept`, set header MAKO, `X-Aifeed-Profile`, dan tanda tangan
inline `aimd1:`/`mako1:` saat sidecar tersedia.
