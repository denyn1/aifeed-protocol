# AIFeed Protocol — Reference Implementation (v1.0.0-draft)

<p><a href="REFERENCE.md">English</a> · <a href="REFERENCE.id.md">Bahasa Indonesia</a> · <a href="REFERENCE.zh.md">中文</a></p>

AIFeed is an open trust layer for the AI-Web: origins publish a signed declaration at
`/.well-known/ai.json` describing what AI systems may do with their content. Declarations
are verifiable offline (Ed25519 + JCS), anchored in DNS (`_aifeed` TXT), and revocable
through a signed public registry.

Version 0.2 adds the **MAKO trust profile**: origins that serve per-page markdown
(`Accept: text/mako+markdown`, [MAKO protocol 1.0](https://github.com/juanisidoro/mako-spec))
can bind their signed permissions to individual pages, sign MAKO documents
(Ed25519 detached, `aifeed.mako.v0.2` domain separation), and publish a digest-bearing
delta index so clients fetch only what changed.

AIFeed also defines its **native content profile, AIFeed Markdown** —
`text/aifeed+markdown`, `.aifeed.md`, `aimd: "1.0"` — so the protocol does not depend on
any single external format. Dual-stack origins serve the same signed bytes under both
media types, each with its own signature context (`aimd` / `mako`); MAKO stays fully
supported as a compatibility profile. Origins MAY instead run **AIFeed Markdown-only**
(`content.profile: "aifeed-md"`, longer bodies up to the publisher's budget), which the
WordPress plugin exposes through the `aifeed_dual_stack` filter. AIFeed Markdown also carries
`alternates` (published translations) for global sites and documents IDN/punycode and
BCP 47 rules for deterministic signatures across locales. See
`spec/en/aifeed-aimd-v1.md`.

This repository is the reference implementation: spec, schemas, CLI, conformance
vectors, benchmarks, and two independent verifiers (JavaScript and Python) that pass the
same vectors.

> Status: draft. The specification is not frozen. See `spec/en/aifeed-v0.2.md`
> (extension to `spec/en/aifeed-v0.1.md`).

---

## Repository layout

```
    ├── bin/                 CLI: keygen | sign | rotate | validate | bundle | init | import-openapi | mako
├── lib/                 strict parser, JCS (RFC 8785), Ed25519, schema engine, rules
├── lib/mako.js          MAKO trust layer: safe YAML subset, signatures, permissions, index
├── lib/mako-html.js     HTML to MAKO conversion (zero dependencies)
├── schema/              v0.1 + v0.2 manifests, signatures, AIFeed Markdown v1, MAKO frontmatter/signature/index
├── spec/en/             canonical specifications (English; includes AIFeed Markdown v1)
├── spec/id/             official translations (Bahasa Indonesia)
├── conformance/         vectors (incl. conformance/mako and conformance/aimd), revocation, fixtures
├── examples/            six site categories incl. a full-scale marketplace
├── clients/python/      zero-dependency Python verifier (manifests, revocation, bundles, MAKO)
├── packages/aifeed-verify/  built npm package @aifeed/verify
├── benchmarks/          MAKO + enforcement reports (JSON/MD/HTML) and edge/ templates
├── docs/                process.html (animated protocol walkthrough)
├── integrations/        platform adapters: nginx, Caddy, Apache, Node, Next.js, PHP, Python, Go, GitHub Action
├── pilot/               pilot kit: plan, instrumentation, weekly template
├── tools/               vector generators, fuzzers, SDK builder, benchmark/report harnesses
└── tests/               Node test suite (node --test)
```

---

## Quickstart

No dependencies required (Node >= 20 for the JS tooling, Python >= 3.10 for the Python
verifier). The published CLI is `npx aifeed` (repo equivalent: `node bin/cli.js`).

```bash
# 0. One-step scaffold: keys + signed manifest + setup guide
npx aifeed init --domain example.com --dir ./my-site
npx aifeed validate ./my-site --domain example.com

# 1. Generate an Ed25519 keypair
node bin/cli.js keygen --out ./my-site

# 2. Write or generate ai.json, then sign it (self-verified before writing)
node bin/cli.js sign ./my-site/ai.json

# 3. Verify locally
node bin/cli.js validate ./my-site

# 4. Verify a live domain (HTTPS + DNS anchor + optional revocation)
node bin/cli.js validate tokobuku.example --revocation-url https://aifeed.md/revoke/v1/tokobuku.example.json

# 5. Same check with the independent Python verifier (`pip install aifeed`)
aifeed-verify ./my-site --json    # or: python clients/python/aifeed_verify.py ./my-site --json

# 6. Offline bundle (air-gapped / audit)
node bin/cli.js bundle create ./my-site --out ./my-bundle --domain example.com
node bin/cli.js bundle verify ./my-bundle --json

# 7. Zero-touch setup for any stack (no WordPress required)
node bin/cli.js init --domain example.com --profile news --dir ./site

# 8. Draft capabilities/actions from an OpenAPI spec (semi-automatic)
node bin/cli.js import-openapi ./openapi.json --out ./fragment.json

# 9. Any platform: build AIFeed Markdown + manifest + index for a static site
node bin/cli.js site build ./public --domain example.com --key ./my-site/aifeed-private.pem --llms --inject

# 10. MAKO: convert HTML to a MAKO document (zero dependencies)
node bin/cli.js mako generate ./artikel.html --out ./artikel.mako.md --url https://example.com/artikel

# 11. AIFeed Markdown (native): generate, sign, verify, and index native AIFeed markdown
node bin/cli.js aimd generate ./artikel.html --out ./artikel.aifeed.md --url https://example.com/artikel
node bin/cli.js aimd sign ./artikel.aifeed.md --url https://example.com/artikel
node bin/cli.js aimd verify ./artikel.aifeed.md --url https://example.com/artikel --key ./my-site/aifeed-public.txt
node bin/cli.js aimd index ./site --domain example.com --sign --key ./my-site/aifeed-private.pem
node bin/cli.js aimd fetch https://example.com/artikel --key ./my-site/aifeed-public.txt

# 12. MAKO: sign, verify, index, and fetch with content negotiation
node bin/cli.js mako sign ./artikel.mako.md --url https://example.com/artikel
node bin/cli.js mako verify ./artikel.mako.md --url https://example.com/artikel --key ./my-site/aifeed-public.txt
node bin/cli.js mako index ./site --domain example.com --sign --key ./my-site/aifeed-private.pem
node bin/cli.js mako fetch https://example.com/artikel --key ./my-site/aifeed-public.txt

# 13. Rotate the signing key (v0.2 manifests): announce, wait out the overlap, cut over
node bin/cli.js rotate --dir ./my-site --window 72
# publish the overlap manifest + advisory DNS pk2 record, then after effective_at:
node bin/cli.js rotate --dir ./my-site
```

Exit codes: `0` VERIFIED, `1` UNVERIFIED/SUSPENDED, `2` usage or internal error.

---

## What gets verified

- Strict JSON: duplicate keys rejected, NFC required, integers only (`|n| <= 2^53-1`),
  max depth 10, `x_` extension fields ignored.
- Discovery: `discoverManifestUrl()` finds the manifest via `Link: rel="ai-feed"`,
  HTML `<link rel="ai-feed">`, then falls back to `/.well-known/ai.json`.
- Schema conformance (`schema/ai-json.v0.1.json`).
- `identity.domain` equals the serving host (IDNA2008 A-label, case-insensitive).
- `validity.signed_at` / `expires_at` inside the signed payload.
- Ed25519 pure (RFC 8032) over `"aifeed.v0.1\n" || JCS(manifest)` with SPKI DER keys.
- DNS anchor `_aifeed` (public key and optional fingerprint match).
- Canonical revocation URL and bounded staleness policy.
- Transport integrity: `Content-Digest` (RFC 9530) verified when present; fetch uses
  identity encoding.
- Byte integrity: optional `raw_digest` in the signature container detects byte-level
  corruption or reformatting (corruption detection, not authenticity).
- Offline bundles: hashed file lists with optional bundler signature; stale bundles
  (>168 h) reduce trust.
- MAKO documents (v0.2): safe YAML-subset frontmatter (anchors, aliases, tags, and flow
  collections are rejected), Ed25519 signatures over
  `"aifeed.mako.v0.2\n" || url || LF || raw bytes`, permission binding with
  restrict-only overrides, a paginated delta index with per-entry SHA-256 digests, and
  an `aifeed.assets` link list (images, video, audio, documents, archives) with optional
  `mime`, `size`, and `sha-256` so agents can decide what to download and verify the
  bytes they get (`sdk.verifyAsset`); converters also emit a "Media & Unduhan" section.
- Site triage (v0.2): the delta index carries an optional `site` resume
  (name, description, type, languages) and per-entry triage fields
  (`title`, `summary`, `tags`, `lang`, `related`, `assets`) so agents can rank and select
  pages before fetching; the SDK exposes `selectEntries()` for that ranking.

---

## Tests

```bash
npm test                 # Node test suite (283 tests: unit, vectors, AIFeed Markdown/MAKO, global i18n, site builder, server adapter, triage selection, enforcement, HTML reports, pilot kit, fuzz smoke, SDK, CLI, bundle, integration, key rotation, MCP server)
npm run test:py          # Python verifier suite (56 tests: vectors, AIFeed Markdown/MAKO parity, revocation, bundles, examples)
npm run vectors          # regenerate deterministic manifest vectors and self-check (34)
npm run mako:vectors     # regenerate MAKO conformance vectors and self-check (39)
npm run aimd:vectors     # regenerate AIFeed Markdown conformance vectors and self-check (11)
npm run fuzz -- --iterations 50000 --seed 42    # deterministic parser fuzzer (invariants + pollution checks)
npm run fuzz:mako -- --iterations 30000         # MAKO frontmatter/container/index fuzzer
npm run bench:mako       # MAKO benchmark, writes benchmarks/mako-report.md
npm run bench:enforcement # enforcement harness (PDP + four client profiles + 100-tenant scale), writes benchmarks/enforcement-report.{md,json}
npm run render:html      # renders benchmarks/enforcement-report.html and docs/process.html (offline, animated)
npm run build:sdk        # rebuild packages/aifeed-verify from lib/ + schema/
npm run sdk:check        # verify the built SDK is in sync with sources
```

Fetch integration tests run against a local TLS fixture server (`tests/fixtures/tls/`,
self-signed, test-only) and cover Content-Digest, redirects, content encodings, size
limits, timeouts, private-address blocking, and untrusted-certificate rejection.

The 34 manifest conformance vectors, the 39 MAKO vectors (positive and negative:
signatures, digests, permission overrides, YAML attacks, assets, index triage), the
11 AIFeed Markdown vectors (native markers, dual markers, cross-format replay, tamper, assets,
alternates, strict optional-field validation), plus revocation, bundle, and example
fixtures (news, e-commerce, blog, government, SaaS, and a full-scale marketplace with
9 capabilities, 5 OAuth2 actions, and 10 types) are verified by both the JavaScript and
Python implementations — differential (cross-language) interoperability tests.

### Any platform (not just WordPress)

`aifeed site build <dir>` turns any static output into a signed AIFeed origin —
manifest, delta index, per-page content (`.aifeed.md` for AIFeed Markdown, `.mako.md` for MAKO,
both for `--profile both`), `{file}.sig` sidecars with matching signature contexts, and
optional `llms.txt` — with opt-in `--inject` that adds `<link rel="alternate">` tags for
hosts without content negotiation. Nested directory indexes (`/dir/index.html`) are
addressable at the clean path (`/dir`) on every adapter. `integrations/` ships ready
adapters for nginx, Caddy, Apache, Node/Express, Next.js, PHP, Python ASGI, Go, and a
GitHub Action; see `integrations/README.md` for the matrix and quickstarts.

Verify a built directory before or after deploy:

```bash
aifeed validate ./public --domain example.com --json                     # manifest
aifeed aimd verify ./public/artikel/satu.aifeed.md \
  --url https://example.com/artikel/satu \
  --key ./.aifeed/aifeed-public.txt --json                               # page + signature
```

### Enforcement evidence and pilot kit

`npm run bench:enforcement` runs a loopback harness with a real HTTP origin and a PDP
edge (training denial, `429 + Retry-After`, MAKO/delta) across four client profiles and
a 100-tenant hosting scenario, producing two-sided savings for the publisher and the AI
side (`benchmarks/enforcement-report.md`). `benchmarks/edge/` contains nginx/Caddy
parity templates, and `pilot/` contains a ready-to-run 30-day pilot kit with an access
log schema and `tools/pilot-report.js`. The animated reports (`benchmarks/enforcement-report.html`,
`docs/process.html`) are self-contained and offline.

### End-to-end WordPress verification (manual)

A real WordPress (PHP 8.4 + the official SQLite drop-in) was used to validate the
publisher plugin end to end: activate → generate keys → sign → serve over HTTP →
**VERIFIED** by this SDK and by `bin/cli.js validate`, including the `raw_digest` layer;
unknown `/.well-known/ai*` paths return 404 JSON. The admin flow was simulated over
HTTP as well (login, Settings API save, sign action with nonce, missing-nonce rejection,
unauthenticated rejection, badge shortcode): **17/17 checks passed**.

The MAKO layer was verified in the same environment: the manifest advertises
`content.mako` (v0.2), `GET` with `Accept: text/mako+markdown` returns
`text/mako+markdown` with the MAKO required headers, the inline
`X-Aifeed-Signature: mako1:...` container verifies against the manifest key
(tampered bodies are rejected), HTML pages advertise the alternate link, and the signed
delta index verifies with matching per-entry digests. See `wp-plugin/README.md`.

---

## Agent-side quickstart

Before crawling, an agent should discover and verify the publisher's declaration, honour
permissions and crawl limits, and use the delta index. Guide:
[`agent-quickstart.md`](agent-quickstart.md); runnable example:
[`../examples/agent/compliant-agent.js`](../examples/agent/compliant-agent.js) —
`node examples/agent/compliant-agent.js https://example.com --use retrieval --fetch`.

## Publisher AI guide

Website owners: hand your AI coding agent this guide and it installs AIFeed end-to-end:
[`publisher-ai-guide.md`](publisher-ai-guide.md) — one track each for small,
medium, large, and giant sites, every track ending in a verified manifest.

## SDKs

- **Publisher CLI — `aifeed`** (`packages/aifeed-cli/`): zero-dependency `npx aifeed`
  (keygen, init, sign, validate, rotate, bundle, `site build`, AIFeed Markdown/MAKO
  tools); `bin/`, `lib/`, and `schema/` are generated copies via `npm run build:cli`.
- **AI client — `@aifeed/verify`** (`packages/aifeed-verify/`): self-contained npm
  package built from `lib/` and `schema/` via `npm run build:sdk`; ships TypeScript
  declarations (`index.d.ts`) and the v0.2 MAKO API (`verifyRemote`, `fetchMako`,
  `fetchIndexDelta`, `selectEntries`, `decideUsage`, `listAssets`, `verifyAsset`,
  `mako.*` primitives, v0.2 schemas); packaging is tested with `npm pack --dry-run`.
- **AI client — `aifeed-mcp-server`** (`packages/aifeed-mcp-server/`): zero-dependency
  Model Context Protocol server over stdio, built from `lib/` and `schema/` via
  `npm run build:mcp`; tools `verify_manifest`, `fetch_aifeed`, `list_assets`,
  `verify_asset`, `select_index`, `decide_usage`; run with `npm run mcp` or
  `npx aifeed-mcp-server`.
- **Build plugins — `@aifeed/frameworks`** (`packages/aifeed-frameworks/`): drop-in Vite,
  Astro, and Next.js plugins plus the `aifeed-build`/`aifeed-next` binaries that sign the
  static build output (manifest, per-page markdown, delta index, `llms.txt`) with
  environment fallbacks (`AIFEED_DOMAIN`, `AIFEED_KEY`, `AIFEED_BASE_URL`); engine copies
  are generated via `npm run build:fw`.
- **Independent verifier — Python (`aifeed`)** (`clients/python/`): standard-library-only
  package published on PyPI (`pip install aifeed`, pre-release); modules `aifeed.verify`
  (manifests, JCS, Ed25519, revocation, bundles, Content-Digest) and `aifeed.mako`
  (AIFEED Markdown/MAKO frontmatter, containers, indices), plus the `aifeed-verify` and
  `aifeed-mako` console scripts; historical `aifeed_verify`/`aifeed_mako` imports remain
  as aliases.
- **Publisher — WordPress** (`wp-plugin/`): reference publisher SDK (key
  management, manifest builder, JCS in PHP, signing, `/.well-known` serving, admin UI,
  DNS instructions, badge, monthly re-sign) plus the v0.2 MAKO layer (content
  negotiation, signed MAKO documents, delta index, mako-wp coexistence). Verified in a
  real WordPress; `php -l` and `php tests/jcs-test.php` plus `php tests/mako-test.php`
  run standalone.

---

## Specs and related standards

AIFeed complements: `robots.txt` (RFC 9309), IETF AIPREF vocabulary/attachment drafts,
Cloudflare Content Signals, RSL 1.0, W3C TDMRep, `llms.txt` v2, and **MAKO** (per-page
markdown for AI agents). AIPREF states that preferences are not a security mechanism;
AIFeed provides the missing attribution, permission binding, and revocation layer; MAKO
states that it does not provide verification — AIFeed provides it.

Language policy: the specification is canonical in English. Documentation is planned in
10 priority languages (UN official six plus Indonesian, Portuguese, Hindi, Kiswahili).

---

## Publications

- `paper/` — arXiv preprint draft *AIFeed: Verifiable Content Permissions and
  Efficient Agent Delivery for the AI Web* (working title): LaTeX source + Markdown
  mirror, `refs.bib` with verified metadata, `CLAIMS.md` (claim→source ledger), and
  `CHECKLIST.md` (submission readiness). Structural checks: `npm run paper:check`.

## License

Specification: CC BY 4.0 · Code and schemas: MIT. Test vectors are released into the
public domain (CC0) for implementation testing.

AIFeed follows an **open core + open standard** policy: the verification path (spec,
schemas, verifiers, vectors, publisher tooling) is permanently open, with no proprietary
extensions; only secrets, customer data, and anti-abuse tactics stay private. Details in
`GOVERNANCE.md` ("Licensing and open-core policy").

## Governance and contributing

`CONTRIBUTING.md` (workflow, translation policy, conformance requirements, contribution
licensing), `GOVERNANCE.md` (interim decision making, licensing/open-core policy, path to
a foundation), `SECURITY.md` (vulnerability reporting, key compromise, disclosure), and
`CODE_OF_CONDUCT.md`. Specification history: `CHANGELOG.md`; spec index:
`spec/README.md`.
