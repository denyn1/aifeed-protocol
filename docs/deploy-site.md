# Deploying the AIFeed site on `aifeed.md`

The site is a plain static bundle in `site/` — landing page, logo, the process
animation, the enforcement report, the Indonesian explainer, and the generated demo
origins. No build framework, no runtime dependencies.

Status 2026-09-16: live on **Cloudflare Pages** (project `aifeed`). The apex
`aifeed.md`, `www.aifeed.md` (redirect), and the seven demo subdomains are custom
domains of that project; Cloudflare manages DNS and TLS (`always_use_https` on). The
old GitHub Pages flow (workflow + `site/CNAME`) has been removed.

## Local deploy (used for every change)

```bash
npm run verify   # gate: builds reports + site + demos and verifies everything
npx wrangler@latest pages deploy site --project-name aifeed --branch main --commit-dirty=true
```

`--branch main` is required: without it the deploy lands on a preview alias instead of
production. `CLOUDFLARE_API_TOKEN` (and `CLOUDFLARE_ACCOUNT_ID`) must be set in the
environment; never commit them.

## CI deploy (activates when the secrets exist)

`.github/workflows/pages-cf.yml` runs on every push to `main`: `render-html` →
`build-site` → `gen-demos --check` → `wrangler pages deploy`. It skips itself until the
repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are added
(Settings → Secrets and variables → Actions).

## DNS

All records live in Cloudflare (`etienne.ns.cloudflare.com`, `leia.ns.cloudflare.com`):

- `aifeed.md` and `www.aifeed.md` → Cloudflare Pages custom domains (TLS automatic).
- `demo`, `news`, `shop`, `gov`, `strict`, `revoked`, `verify` subdomains → the same
  Pages project; `functions/[[path]].js` routes by host.
- `_aifeed.<domain>` TXT records anchor each manifest signing key (AIFeed v0.1 §6);
  the demo anchors are listed in `docs/demos.md`.

## Email

`contact@aifeed.md` is routed via Cloudflare Email Routing; keep the address in sync
with `paper/main.tex`, `paper/main.md`, and `SECURITY.md`.
