# Changelog

<p><a href="CHANGELOG.md">English</a> · <a href="CHANGELOG.id.md">Bahasa Indonesia</a> · <a href="CHANGELOG.zh.md">中文</a></p>

All notable changes to the AIFeed protocol and reference implementation are documented
here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

> Evidence labels used across the project: [F] verified fact, [M] plausible,
> [E] model estimate, [S] measured in the local simulation harness, [H] needs legal
> review.

## [1.0.0-draft] — 2026-09-16

### Added

- **AIFeed Studio (local publisher app)** — `npm run studio` serves a zero-dependency
  web UI on `127.0.0.1:7777`: per-domain workspace, local HTML source ingestion,
  restrict-only policy editor (usage permissions, attribution text/URL, crawl limits,
  license, `llms.txt`, revocation interval, per-path rules), incremental builds,
  local verification of manifest/pages/indexes, and export with the `_aifeed` DNS TXT
  record; a robots-aware crawler (sitemap or link discovery, rate limits,
  ETag/Last-Modified cache) covers live sites; site-type presets (news, ecommerce,
  marketplace, government, open, restrictive, blog), per-path page types (`product`,
  `  article`, `listing`, …), and opt-in freshness metadata (page dates/tags) complete the
  site-type support. M3 adds `.tar.gz` overlay download, stack detection wired to
  `integrations/` adapter hints, one-click live verification (manifest, signature, DNS
  anchor), and a guarded key-rotation ceremony that swaps the key and re-signs every
  page. Private keys stay in the workspace
  (0600) and are never served; UI in EN/ID/ZH. The manifest builder (`lib/site.js`)
  gained optional `limits`, `license`,
  `attribution_text/url`, and `maxCheckIntervalHours` options (backward compatible).
- **Key rotation (v0.2 §14)** — replaces a manifest signing key without breaking
  verification: old-key-signed `rotation.successor_fp` directive plus an advisory DNS
  `pk2` cross-check, bounded overlap (`effective_at` → `grace_until`, 1 h hard floor),
  new-key-signed `predecessor_fp` cutover binding, then permanent revocation. Six result
  codes: `rotation_invalid`, `rotation_anchor_unverified`, `grace_accepted`,
  `rotation_denied`, `rotation_resync`, `key_revoked`. Implemented in `lib/rotation.js`,
  single-command CLI `aifeed rotate [--dry-run]`, SDK `rotation` export, Python directive
  parity, PHP manifest validation, vectors 008–011 / 119–123, and the runbook in
  `docs/rotation.md`.
- **AIFeed Markdown v1.0** — native content profile: `text/aifeed+markdown`, `.aifeed.md`,
  `aimd: "1.0"`, first-class `aifeed` policy block, token budget up to the publisher's
  choice (reference default 4,000 in AIFeed Markdown-only mode).
- **Dual-stack serving** — the same signed bytes under AIFeed Markdown and MAKO, each with its own
  signature context (`aimd` / `mako`); cross-format replay rejected.
- Manifest extensions: `content.profile` (`mako` | `aifeed-md` | `both`) and
  `content.index_url`; AIFeed Markdown index at `/.well-known/aifeed-index.json`.
- CLI: `aifeed aimd <generate|sign|verify|index|fetch>` alias, `--format` for generate,
  index, and fetch; profile auto-detection for sign/verify.
- SDK `@aifeed/verify` 1.0.0-draft: `fetchAimd`, `verifyAimdDocument`,
  `verifyAimdIndex`, media-type constants.
- WordPress plugin 1.0.0-draft: dual-stack serving, AIFeed Markdown-only mode via the
  `aifeed_dual_stack` filter, per-format signatures and indices.
- Specs: `spec/en|id|zh/aifeed-aimd-v1.md` (operating modes, IANA considerations).
- Vectors: `conformance/aimd/` (11 cases: markers, cross-format replay, tamper, assets,
  alternates, strict optional-field validation) with Python parity; fuzz corpus includes
  AIFeed Markdown.
- Repository: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `GOVERNANCE.md`,
  `spec/README.md`, SDK README, plugin LICENSE and starter `.pot`.
- **Any-platform publishing**: `aifeed site build <dir>` generates manifest, delta index,
  per-page content with signatures, and optional `llms.txt` for any static output (Hugo,
  Jekyll, Astro, Next export, plain HTML), with opt-in `<link rel="alternate">`
  injection. File naming is profile-specific — `.aifeed.md` for AIFeed Markdown, `.mako.md` for
  MAKO, both written for `--profile both` — with `{file}.sig` sidecars whose context
  matches the media type. Directory indexes (`/dir/index.html`) are addressable at the
  clean path (`/dir`) across every adapter, including nested paths.
- **Server adapters** in `integrations/`: nginx, Caddy, Apache, Node/Express, Next.js,
  PHP, Python ASGI, Go, and a GitHub Action (with tests for the Node handler).
- **Licensing and open-core policy** documented in `GOVERNANCE.md`: the verification path
  (spec, schemas, verifiers, vectors, publisher tooling) is permanently open with no
  proprietary verification extensions; only secrets, customer data, and anti-abuse
  tactics stay private. Contribution licensing (inbound=outbound) added to
  `CONTRIBUTING.md`.
- **arXiv preprint draft** (`paper/`): LaTeX source + Markdown mirror, `refs.bib` with
  metadata verified against primary sources (17 RFCs, pinned IETF drafts, Crossref DOIs,
  publisher pages), `CLAIMS.md` claim→source ledger, `CHECKLIST.md` submission readiness,
  and `npm run paper:check` for citation/environment cross-checks (52/52 cited).

### Changed

- **Release renumbered to `1.0.0-draft`** (was `0.3.0-draft`) across the protocol package,
  SDK, CLI, WordPress plugin, docs, and site. Wire/spec versions are unchanged: manifest
  `0.1` / `0.2`, AIFeed Markdown `1.0`, external MAKO `0.2` — the renumbering does not
  change any signed bytes or compatibility claims.
- Manifest verification accepts `0.1.x` and `0.2.x`; other versions report
  `upgrade_required`.
- Enforcement/HTML reports and pilot kit are self-contained and offline.
- **Canonical domain migrated** from `aifeed.org` (third-party) to `aifeed.md` across
  specs, schemas, registry/revocation URLs, docs, tests, SDK, and the WordPress plugin —
  including escaped regex forms in JSON schemas and PHP. All signed vectors, fixtures,
  and indexes were regenerated and the full regression re-run. The migration is
  repeatable via `node tools/replace-domain.js --domain aifeed.md` (dry-run by default).
- **Canonical domain `aifeed.md` registered** (maintainer, 2026-09-16). DNS and the
  spec/docs site are the next configuration step; normative URLs in specs, schemas, and
  registry links already point at `aifeed.md`.
- **Static site deployment assets** for `aifeed.md`: `site/` (landing page),
  `npm run build:site` (`tools/build-site.js`) to refresh the copied artifacts,
  `.github/workflows/pages-cf.yml` for Cloudflare Pages, and `docs/deploy-site.md`
  covering the DNS, deploy, and demo-subdomain layout.
- **Landing page redesigned** with a Groq-console-inspired, dark-first aesthetic: warm-black
  surfaces, vermilion accent, Inter/Montserrat typography, top nav, hero with inline mark,
  icon feature grid, grouped spec/tooling columns, info banner, and a light/dark toggle.
- **SEO kit**: per-page metadata (canonical, Open Graph, Twitter cards, `max-image-preview`),
  JSON-LD on the landing and every demo page, apex `robots.txt` + `sitemap.xml` covering
  all demo pages, a zero-dependency 1200×630 `og-image.png` generator
  (`tools/gen-og-image.js`), and `docs/seo.md` with the Google Search Console runbook.
- **Live demo origins**: seven signed demo sites (`demo`, `news`, `shop`, `gov`,
  `strict`, `revoked`, `verify`) generated deterministically from `demos/sites.js` with
  public demo keys, served on Cloudflare Pages through `functions/[[path]].js`
  (host routing, CORS, live 403/429 enforcement on `strict`, browser verifier on
  `verify`, multi-signature revocation registry under `site/revoke/`). The apex
  `aifeed.md` now dogfoods AIFeed with its own signed manifest. New tooling:
  `npm run demos`, `npm run demos:check` (in `verify`), `npm run verify:live`.
- **Maintainability kit**: `AGENTS.md` (agent/dev contract: generated files, version
  locations, pitfalls), `docs/architecture.md` (module map, invariants, extension
  points), `docs/release.md` (release/upgrade checklist), and zero-dependency checkers
  (`npm run lint:syntax`, `npm run check:consistency`) rolled into one gate:
  `npm run verify`.
- **Repository flattened**: the protocol project now lives at the repository root (was
  `aifeed-protocol/`), the WordPress plugin at `wp-plugin/`, and the Indonesian project
  documents under `docs/`. Canonical paths are now
  `github.com/denyn1/aifeed-protocol/tree/main/<path>` (no doubled prefix); the CI
  workflow, site links, and documentation were updated accordingly.
- **CI fix**: the Pages workflow now runs the report renderer before the site builder
  (`render-html` → `build-site`), so `/process.html` and `/enforcement-report.html` ship
  again; `build-site` now fails loudly when a generated source is missing instead of
  silently skipping it (both were gitignored during the cleanup).
- **Agent-side quickstart**: `docs/agent-quickstart.md` (check-first flow and failure
  handling) plus a runnable compliant-agent example
  (`examples/agent/compliant-agent.js`) covered by `tests/agent-example.test.js`. The SDK
  now forwards `allowPrivate`/`ca` through `fetchMako`, `fetchIndexDelta`, and sidecar
  signature fetching (for local, self-signed test environments).
- **Repository cleanup**: removed obsolete proposal/review drafts and committed
  build artifacts (report HTML, site copies, duplicate PDF, arXiv staging/ZIP); those
  are regenerated on demand (`npm run render:html`, `npm run build:site`) and are now
  gitignored. The arXiv bundle is built directly from `paper/`.
- **SDK published to npm**: `@aifeed/verify@1.0.0-draft` (dist-tags `latest` and
  `next`), 27 files, 44.7 kB packed; `npm install @aifeed/verify` resolves out of the
  box. Updated to **`1.0.0-draft.1`** (2026-09-16) with the TLS/private-fetch option
  forwarding fix; both dist-tags now point at it. The monorepo package is marked
  `"private": true` to prevent accidental publishes.
- **Logo simplified** to a static flat 2D mark (vermilion shield + white check,
  378 bytes, no gradients/filters/animation), replacing the animated badge. The site,
  favicon, and the complete guide all use it via `site/logo.svg`.
- **Report pages rebuilt in the landing-page design system and in English**: the protocol
  flow (`docs/process.html`), the enforcement benchmark
  (`benchmarks/enforcement-report.html`), and the long-form complete guide
  (`penjelasan-aifeed.html` → `site/penjelasan.html`) now share the warm dark-first
  palette, vermilion accent, and a light/dark toggle; all remain self-contained/offline
  with no external resources.
- **Human-facing naming unified to "AIFeed Markdown"** across docs, CLI/SDK output, and
  reports; wire identifiers are unchanged (`aimd`, `aimd-index`, `AIMD-C1..C4` level
  codes, `AIMD_*` constants, `.aifeed.md`). EN/ID spec headings now state the wire
  identifier explicitly.
- **PHP JCS fixture drift fixed**: `npm run jcs:fixtures`
  (`tools/gen-jcs-php-fixtures.js`) rebuilds `tools/jcs-php-fixtures.json` from
  conformance vector 001, so the plugin's cross-language JCS/Ed25519 test
  (`tests/jcs-test.php`) can no longer go stale after regeneration.
- Paper title aligned to *AIFeed: Verifiable Content Permissions and Efficient Agent
  Delivery for the AI Web*; `paper/CHECKLIST.md` domain item updated to reflect the
  applied migration.

## [0.2.0-draft] — 2026-09-15

### Added

- MAKO trust profile: signed MAKO documents (`aifeed.mako.v0.2`), permission binding
  (restrict-only), YAML-safe subset, delta index with per-entry digests.
- Assets as links (`aifeed.assets`), site resume and triage fields in the index,
  `/llms.txt` (v2) publishing in the WordPress plugin.
- CLI `aifeed mako generate|sign|verify|index|fetch`; SDK `fetchMako`,
  `fetchIndexDelta`, `selectEntries`, `decideUsage`.
- Enforcement harness (S0–S3, four client profiles, 100-tenant scale) with two-sided
  savings [S]; nginx/Caddy parity templates; animated HTML reports; 30-day pilot kit.
- 39 MAKO conformance vectors; Python parity; fuzz targets for MAKO.

## [0.1.0-rc1] — 2026-09-14

### Added

- AIFeed v0.1: signed manifests at `/.well-known/ai.json`, Ed25519 + JCS, DNS anchor
  (`_aifeed`), revocation with multi-signature documents, offline bundles.
- Reference CLI (`keygen|sign|validate|bundle|init|import-openapi`), 24 manifest
  vectors, independent JavaScript and Python verifiers, WordPress publisher plugin
  (0.1.0-rc1) verified end-to-end (17/17 admin checks).
