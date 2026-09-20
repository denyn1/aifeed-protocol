# AIFeed 集成 —— 任意平台，不只是 WordPress

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

`aifeed site build <dir>` 可把**任意**静态输出（Hugo、Jekyll、Astro、Eleventy、
Next.js 导出、Vite、纯 HTML……）变成 AIFeed 源站：签名 manifest、增量索引、逐页
AIFeed Markdown 文档、签名边车，以及可选的 `llms.txt`。服务器适配器随后为动态栈
添加内容协商与内联签名。

```bash
aifeed keygen --out .aifeed
aifeed site build public --domain example.com --key .aifeed/aifeed-private.pem \
  --profile both --llms --inject
```

## 矩阵

| 平台 | 服务方式（协商） | 使用的文件 |
|---|---|---|
| 静态托管（Netlify、GitHub Pages、S3……） | 显式端点（`/path.aifeed.md`、`/path.mako.md` + `<link rel="alternate">`；`--inject` 会写入） | `aifeed site build` 输出 |
| nginx | Accept → `.aifeed.md` / `.mako.md` 重写 | [`nginx/aifeed-content.conf`](nginx/aifeed-content.conf) |
| Caddy | Accept → `.aifeed.md` / `.mako.md` 重写 | [`caddy/Caddyfile`](caddy/Caddyfile) |
| Apache | mod_rewrite + ForceType | [`apache/.htaccess`](apache/.htaccess) |
| Traefik（v2/v3） | Accept → `.aifeed.md` / `.mako.md` 重写 | [`traefik/aifeed.yml`](traefik/aifeed.yml) |
| Node / Express / 纯 http | handler + 内联签名 | [`node/aifeed-serve.js`](node/aifeed-serve.js) |
| Next.js（App Router） | middleware + route handler | [`nextjs/middleware.js`](nextjs/middleware.js), [`nextjs/app/api/aifeed/route.js`](nextjs/app/api/aifeed/route.js) |
| PHP（非 WordPress） | `aifeed_serve()` 前端控制器检查 | [`php/aifeed-serve.php`](php/aifeed-serve.php) |
| Python ASGI（FastAPI/Starlette/Django） | `AifeedMiddleware` | [`python/aifeed_middleware.py`](python/aifeed_middleware.py) |
| Go（net/http） | `aifeed.Handler(next, root, aimd, mako)` | [`go/aifeed.go`](go/aifeed.go) |
| Cloudflare Workers（静态资源） | Accept → 通过 `ASSETS` binding 返回 `.aifeed.md` / `.mako.md` | [`cloudflare/worker.mjs`](cloudflare/worker.mjs), [`cloudflare/wrangler.template.toml`](cloudflare/wrangler.template.toml) |
| CI/CD | 部署前 build + 签名 + 验证 | [`github-action/aifeed.yml`](github-action/aifeed.yml) |
| WordPress | 双栈服务 + 管理界面的插件 | `wp-plugin/` |

## 静态托管说明

普通文件主机无法协商 `Accept`。请使用规范允许的**显式端点**模式：每个 HTML 页面链接到
其 markdown 文件（`<link rel="alternate" type="text/aifeed+markdown" href="/path.aifeed.md">`，
MAKO 配置则用 `type="text/mako+markdown" href="/path.mako.md"`）。`aifeed site build
--inject` 会自动添加这些 link 标签。签名位于 `{file}.sig` 边车（例如
`/artikel/satu.aifeed.md.sig`），其上下文与媒体类型匹配。

## 文件命名

`aifeed site build` 感知配置：

| `--profile` | 每页写入的文件 | 索引 | Manifest |
|---|---|---|---|
| `aimd`（默认） | `{path}.aifeed.md` + `.sig` | `/.well-known/aifeed-index.json`（+`.sig`） | `content.profile: aifeed-md` |
| `mako` | `{path}.mako.md` + `.sig` | `/.well-known/mako-index.json`（+`.sig`） | `content.profile: mako` |
| `both` | 两个文件，各带 `.sig` | 两个索引 | `content.profile: both` |

目录索引使用 `{dir}/index.aifeed.md`（或 `.mako.md`），通过干净路径（`/dir`）访问。
每个 `.sig` 内的签名上下文与其媒体类型匹配（`aimd` / `mako`）；跨上下文重放会被
SDK 拒绝。

## 平台快速上手

### 静态 / SSG（Hugo、Jekyll、Astro、Eleventy、Vite、Next export）

```bash
aifeed site build public --domain example.com --key .aifeed/aifeed-private.pem \
  --profile both --llms --inject
# 原样部署 ./public：.well-known/、*.aifeed.md、*.mako.md、*.sig、llms.txt
```

显式端点（无需 Accept 协商）：
`https://example.com/artikel/satu.aifeed.md` 与 `.../satu.mako.md`。

### nginx / Caddy / Apache

1. 按上述方式构建（把输出放到 Web 根目录）。
2. 复制配置：`nginx/aifeed-content.conf`、`caddy/Caddyfile` 或 `apache/.htaccess`
   （调整 `root`/`server_name`/`ORIGIN`）。
3. 重载并验证：

```bash
curl -sI -H 'Accept: text/aifeed+markdown' https://example.com/artikel/satu \
  | grep -Ei 'HTTP|content-type|vary|x-aifeed|x-mako'
curl -sI -H 'Accept: text/mako+markdown' https://example.com/artikel/satu \
  | grep -Ei 'content-type|x-aifeed'
curl -sI https://example.com/.well-known/ai.json | grep -Ei 'HTTP|content-type'
curl -sI https://example.com/artikel | grep -Ei 'HTTP|content-type'   # 嵌套索引
```

### Node / Express / Fastify / 纯 http

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

### Next.js（App Router）

把 [`nextjs/middleware.js`](nextjs/middleware.js) 与
[`nextjs/app/api/aifeed/route.js`](nextjs/app/api/aifeed/route.js) 复制进你的应用。
静态导出无法协商：改用 `--inject` 与显式端点。

### PHP（非 WordPress）

```php
require __DIR__ . '/integrations/php/aifeed-serve.php';
if (aifeed_serve(__DIR__ . '/public', ['mako' => true])) {
    exit; // served by AIFeed before your normal routing
}
```

### Python ASGI（FastAPI、Starlette、Django）

```python
from aifeed_middleware import AifeedMiddleware
app.add_middleware(AifeedMiddleware, root="public", mako=True)
```

### Go（net/http）

```go
http.Handle("/", aifeed.Handler(http.FileServer(http.Dir("public")), "public", true, true))
```

### Traefik（v2/v3）

```bash
traefik --providers.file.filename=integrations/traefik/aifeed.yml
# 先在文件中设置 ORIGIN_HOST / ORIGIN_PORT
```

### Cloudflare Workers（静态资源）

```bash
cp integrations/cloudflare/worker.mjs ./worker.mjs
cp integrations/cloudflare/wrangler.template.toml ./wrangler.toml   # 把 [assets].directory 指向你的构建输出
npx wrangler deploy
```

请求目录 URL 时请带尾部斜杠（`/dir/`）以获得 markdown；`/dir` 会回退到 HTML 资源。

## 部署后验证

```bash
aifeed validate public --domain example.com --json          # 离线 manifest
curl -s https://example.com/.well-known/aifeed-index.json.sig | head -c 200
aifeed aimd fetch https://example.com/artikel/satu --key .aifeed/aifeed-public.txt --json
aifeed mako fetch https://example.com/artikel/satu --key .aifeed/aifeed-public.txt --json --format mako
```

`aifeed keygen --out .aifeed` 写入 `.aifeed/aifeed-public.txt`；私钥永不离开你的机器，
除非通过 CI 密钥传递。

## 客户端的验证流程

1. 抓取 `/.well-known/ai.json`（签名、DNS 锚定）→ 许可与限额。
2. 抓取增量索引（`/.well-known/aifeed-index.json` + `.sig`）。
3. 用 `Accept: text/aifeed+markdown`（或 `text/mako+markdown`）请求页面，或抓取显式
   的 `.aifeed.md` / `.mako.md` URL，然后用 manifest 密钥验证内联
   `X-Aifeed-Signature` 或边车 `{file}.sig`。

适配器会设置 `Vary: Accept`、MAKO 响应头集合、`X-Aifeed-Profile`，并在存在边车时
提供内联 `aimd1:`/`mako1:` 签名。
