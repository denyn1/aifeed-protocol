# Architecture

How AIFeed is put together, what each layer owns, and where to extend it. For the
agent/human workflow rules see [`../AGENTS.md`](../AGENTS.md); for release mechanics see
[`release.md`](release.md).

## One paragraph

A publisher signs a **manifest** (JCS-canonical JSON, Ed25519) served at
`/.well-known/ai.json`, anchors the public key in DNS (`_aifeed` TXT), and optionally
serves per-page **content profiles** (native *AIFeed Markdown*, compatibility *MAKO*)
plus a signed **delta index**. A client verifies the chain and per-page signatures
offline, honours permissions and crawl limits, and re-checks a multi-signature
**revocation** registry. No runtime dependencies anywhere.

## Layers

| Layer | Code | Responsibility |
|---|---|---|
| Crypto & encoding | `lib/crypto.js`, `lib/jcs.js`, `lib/digest.js` | Ed25519 (RFC 8032) over JCS (RFC 8785) bytes; SHA-256 digests; context strings |
| Strict parsing | `lib/parse.js`, `lib/schema.js` | Duplicate keys, NFC, integer bounds, depth caps; schema-driven checks |
| Validation | `lib/validate.js` | Manifest/signature checks, trust levels, warnings vs errors |
| Content profiles | `lib/mako.js`, `lib/mako-html.js` | Safe YAML subset, document signing, permission binding, delta index, HTML→profile conversion |
| Transport | `lib/remote.js` | HTTPS fetch with pinning, TLS options, discovery, DNS anchor lookup |
| Trust docs | `lib/revocation.js`, `lib/bundle.js` | Multi-signature revocation, bounded staleness, offline bundles |
| Publisher tooling | `lib/scaffold.js`, `lib/site.js`, `bin/cli.js` | Manifest scaffolding, static-site builder, CLI surface |
| SDK | `packages/aifeed-verify/index.js`, `.d.ts` | Client API; `lib/` + `schema/` inside the package are generated copies |
| Independent verifier | `clients/python/` | Differential conformance in a second language (stdlib only) |
| Adapters | `integrations/` | nginx, Caddy, Apache, Node, Next.js, PHP, Python ASGI, Go, GitHub Action |
| WordPress publisher | `wp-plugin/` | Admin UI, key management, dual-stack serving, `/llms.txt` |
| Generators & checks | `tools/` | Vectors, benchmarks, HTML reports, fuzzers, site builder, demo generator, live checker, consistency checks |
| Demo origins | `demos/`, `tools/gen-demos.js` | Seven signed demo sites + apex artifacts; public deterministic keys |
| Edge routing | `functions/` | Cloudflare Pages Function: `<sub>.aifeed.md` → `site/demos/<sub>/`, CORS, `strict` 403/429 |
| Truth sources | `spec/`, `schema/`, `conformance/` | Normative text, schemas, vectors |

## Signature contexts

Every signed artifact declares its context; cross-context and cross-URL replay is
rejected by design.

| Artifact | Context string | Coverage |
|---|---|---|
| Manifest v0.2 | `aifeed.v0.2\n` | JCS(manifest) |
| Manifest v0.1 | `aifeed.v0.1\n` | JCS(manifest) |
| AIFeed Markdown page | `aifeed.aimd.v1\n` | url + LF + raw bytes |
| AIFeed Markdown index | `aifeed.aimd-index.v1\n` | url + LF + raw bytes |
| MAKO page | `aifeed.mako.v0.2\n` | url + LF + raw bytes |
| MAKO index | `aifeed.mako-index.v0.2\n` | url + LF + raw bytes |
| Signature container | `aimd1:` / `mako1:` base64url prefix | inline header or `{file}.sig` sidecar |

## Flows

Publish (publisher): `keygen` → scaffold manifest → sign → write
`/.well-known/ai.json` (+ `ai-signature.json`) → optional `site build` to generate
per-page `*.aifeed.md` / `*.mako.md` (+ `.sig`) and the signed delta index → DNS
`_aifeed` anchor → serve.

Verify (client): `discoverManifestUrl` → fetch manifest + signature → `verifyAll`
(strict parse → schema → domain → signature → optional raw digest) → optional
`lookupAifeedTxt` → `decideUsage` per key → `fetchAimd`/`fetchMako`
(content negotiation, per-page signature) → `fetchIndexDelta` + `selectEntries`
(skip unchanged pages) → revocation re-check. The runnable reference is
[`../examples/agent/compliant-agent.js`](../examples/agent/compliant-agent.js).

## Invariants

- **Canonical bytes**: JCS output and raw file bytes are signed; never reformat
  `conformance/`, `examples/`, or signed site files. `.gitattributes` enforces LF.
- **Restrict-only overrides**: page-level policy may only tighten the manifest.
- **Strict parsers**: duplicate keys, floats, NFD strings, oversized integers, and
  unknown fields (outside `x_*`) are rejected — in both JS and Python.
- **Determinism**: generators use fixed seeds/keys; `…:vectors:check` and `sdk:check`
  fail if committed output drifts from sources.
- **Evidence labels** ([F]/[M]/[E]/[S]/[H]) on every factual claim in docs/paper;
  measured numbers come from `benchmarks/*.json` and `paper/CLAIMS.md`.

## Extension points

| Want to… | Do this |
|---|---|
| Add a permission key | `schema/ai-json.v0.2.json` + `lib/validate.js` + both verifiers + a vector |
| Add a vector | generator in `tools/`, run it, keep `…:vectors:check` green |
| Add a CLI command | `bin/cli.js` + help + `tests/cli*.test.js` + `REFERENCE.md` |
| Add a platform adapter | new folder in `integrations/` + row in `integrations/README.md` (+ Node handler test) |
| Change content shape | `lib/mako.js` / `lib/mako-html.js` + AIMD/MAKO generators + spec mirrors + Python parity |
| Touch the SDK API | `packages/aifeed-verify/index.js` + `index.d.ts`, then `npm run build:sdk && npm run sdk:check` |
| Change the site | `site/index.html` + root `penjelasan-aifeed.html`; regenerate via `npm run verify` |
| Add a demo origin | `demos/sites.js` (+ optional `demos/verifier/` assets), then `npm run demos:check` |
| Change edge policy | `functions/[[path]].js`; helpers are unit-tested in `tests/gen-demos.test.js` |

## Generated vs hand-written

`AGENTS.md` holds the full table (artifact → source → regenerate → verify). The short
version: everything under `packages/aifeed-verify/{lib,schema}` is copied from root
`lib/`/`schema/`; `conformance/**` comes from `tools/gen-*`; report/site HTML comes from
`tools/render-html.js` + `tools/build-site.js`; the arXiv bundle is built from `paper/`.
Hand-written: `spec/`, `schema/`, `lib/`, `bin/`, `clients/`, `integrations/`,
`wp-plugin/`, `tools/`, `site/index.html`, `penjelasan-aifeed.html`, `paper/*.tex|md`,
SDK `index.js`/`index.d.ts`, and all docs.
