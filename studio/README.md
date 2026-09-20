# AIFeed Studio

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

A local, zero-dependency app that turns a website into a signed AIFeed origin —
manifest, per-page AIFeed Markdown/MAKO, signatures, delta index, and `llms.txt` —
with a policy editor for what AI may take and how sources must be tagged.

The private key never leaves your machine. The server binds to `127.0.0.1`, requires a
session token for every API call, and never exposes a private key endpoint.

## Run

```bash
npm run studio                          # http://127.0.0.1:7777/
npm run studio -- --port 8080 --workspace ./studio-data
```

Open the URL, create a project for your domain, point it at your site's local HTML
directory (a static build/export, or the page tree of your CMS), configure the policy,
build, verify, and export.

## What it does (current)

- **Project workspace** per domain: identity, policy, key pair, incremental state.
- **Local source ingestion**: scans an HTML directory, converts pages with the same
  converter as `aifeed site build`, and writes output to a separate `build/` overlay —
  your source files are never modified.
- **Live site crawl**: discovers pages from `sitemap.xml` (sitemap indexes supported) or
  link crawling, respects `robots.txt` (including `Crawl-delay`), rate-limits and caches
  every fetch with ETag/Last-Modified so re-scans reuse unchanged pages.
- **Policy editor**: usage permissions (search, retrieval, input, training, quote,
  summarize, reproduce, translate, modify, embed, commercial use), attribution
  requirement plus text/URL, crawl limits, license, `llms.txt`, revocation check
  interval, and per-path rules that can only restrict (spec `restrict-only`).
- **Site-type presets**: news, ecommerce, marketplace, government, open, restrictive,
  and blog policies derived from `lib/scaffold.js`, applied at project creation or from
  the Policy tab.
- **Page types per path**: map path patterns to frontmatter types (`product`, `article`,
  `listing`, `faq`, …) with longest-pattern precedence; delta index entries inherit the
  type.
- **Freshness metadata**: page `updated` dates from `article:modified_time` /
  `og:updated_time` / `<time datetime>` and tags from `<meta name="keywords">`,
  toggleable per project (off by default in the library, on in Studio).
- **Deploy helpers**: `.tar.gz` download of the build overlay, detected stack
  (WordPress, nginx, Caddy, Apache, Next.js, Node, PHP, Python, Go, Cloudflare) with the
  matching `integrations/` adapter shown in Export, and one-click **live verification**
  (manifest, signature, DNS anchor).
- **Key rotation ceremony**: guarded prepare (successor + overlap manifest), confirmed
  cutover, automatic key swap, and a full re-sign of every page with the new key. The
  upload overlay never contains a private key.
- **Advanced manifest fields**: `types`, `capabilities`, and `actions` JSON editors
  validated against the v0.2 schema, plus OpenAPI import (paste a spec) to draft
  capabilities and purchase-style actions for e-commerce agents.
- **Audit journal**: every project keeps a `journal.ndjson` (project created, source,
  scan, build, verify, rotation, advanced fields) for traceability.
- **Incremental builds**: unchanged pages (by HTML hash) are skipped; the state file
  keeps a per-page index entry so rebuilds stay fast for large sites.
- **Verify**: manifest, every page signature, and both indexes are verified locally
  before you publish.
- **Export**: overlay directory ready to upload, the exact `_aifeed` DNS TXT record,
  and step-by-step instructions.
- **UI in English, Indonesian, and Chinese.**

## Workspace layout

```
~/.aifeed-studio/                 (or --workspace)
  projects.json
  projects/<domain>/
    project.json                  identity, source, profile
    policy.json                   global policy + path rules
    aifeed-private.pem            0600, never served
    aifeed-public.txt
    state.json                    incremental build state
    build/                        upload this overlay to your web root
```

## Policy semantics (important)

- One manifest per origin. The manifest carries the global policy.
- Per-path rules are injected into each page's signed `aifeed` frontmatter block and
  can **only tighten** what the manifest allows (deny over allow, stricter attribution,
  tighter limits); loosening is rejected, matching AIFeed v0.2 §6.3.
- The UI previews the effective policy for any URL before you build.

## Security

- Binds `127.0.0.1` by default; API calls require the per-session token injected into
  the UI page.
- No dependencies, no external calls except the pages you explicitly build.
- Private keys are stored only in the workspace directory with owner-only permissions.

## API (for scripts and tests)

`GET /api/info`, `GET|POST /api/projects`, `GET|PUT /api/projects/:id`,
`PUT /api/projects/:id/policy`, `PUT /api/projects/:id/source`,
`POST /api/projects/:id/build` (returns a job id), `GET /api/projects/:id/jobs/:id`,
`GET /api/projects/:id/events?job=` (SSE), `POST /api/projects/:id/verify`,
`GET /api/projects/:id/preview?path=`, `GET /api/projects/:id/export`.

All API calls need the `x-studio-token` header (SSE uses `?token=`).

## Roadmap

- **M2 (done):** crawl a live site via `sitemap.xml` or links (robots-aware,
  rate-limited, cached with conditional requests) and build from the cache.
- **M2.5 (done):** site-type presets, per-path page types, and freshness metadata
  extraction for news and e-commerce sites.
- **M3 (done):** `.tar.gz` export, stack detection with adapter hints, live verification
  from the UI, and the guarded key-rotation ceremony with page re-signing.
- **M4 (mostly done):** advanced editor, OpenAPI import, friendly error hints, and the
  audit journal shipped; screenshots remain.

## Related

- Publisher AI guide (agent-driven setup): [`../docs/publisher-ai-guide.md`](../docs/publisher-ai-guide.md)
- Command reference: [`../REFERENCE.md`](../REFERENCE.md)
- Rotation runbook: [`../docs/rotation.md`](../docs/rotation.md)
