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
- **Policy editor**: usage permissions (search, retrieval, input, training, quote,
  summarize, reproduce, translate, modify, embed, commercial use), attribution
  requirement plus text/URL, crawl limits, license, `llms.txt`, revocation check
  interval, and per-path rules that can only restrict (spec `restrict-only`).
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

- **M2 (next):** crawl a live site via `sitemap.xml` (robots-aware, rate-limited,
  cached), per-path rules in the UI flow for crawled sources, resumable jobs.
- **M3:** tar.gz export, stack detection for adapter instructions, live verification
  from the UI, key rotation ceremony.
- **M4:** friendlier diagnostics, audit journal, screenshots.

## Related

- Publisher AI guide (agent-driven setup): [`../docs/publisher-ai-guide.md`](../docs/publisher-ai-guide.md)
- Command reference: [`../REFERENCE.md`](../REFERENCE.md)
- Rotation runbook: [`../docs/rotation.md`](../docs/rotation.md)
