# Proposal: AIFeed Trust Layer for MAKO (Extension Specification)

**Status:** Draft for discussion (intended for the `mako-spec` community via CONTRIBUTING)
**Author:** AIFeed Protocol Contributors
**Date:** 2026-09-15
**Reference implementation:** this repository (`spec/`, `lib/`, `bin/`), `wp-plugin/`

---

## 1. Summary

MAKO defines how web pages serve semantically optimized markdown to AI agents. The MAKO
specification deliberately leaves content authenticity and verification out of scope:

> "MAKO does not provide built-in mechanisms to verify that the MAKO representation is
> faithful to the source HTML. This is intentional. […] The protocol provides verifiable
> content; it does not provide verification." — MAKO Specification v0.1.0, §10.3

This proposal specifies an **optional trust layer** that adds exactly that missing piece
without changing MAKO's required behaviour:

1. **AIFeed-Verified MAKO** — Ed25519 detached signatures over the raw MAKO bytes, bound
   to the page URL and to a DNS-anchored origin key.
2. **Permission binding** — an optional `aifeed` frontmatter block that binds usage
   permissions, rate limits, and licensing to individual pages, inherited from a signed
   origin manifest and restricted by default.
3. **Delta index** — an optional, pageable index with per-entry SHA-256 digests so agents
   fetch only what changed (`304`/digest diff), instead of re-crawling.

MAKO documents without this extension remain fully valid and unchanged. The extension is
confined to an optional frontmatter key and optional HTTP headers, so existing MAKO
parsers and agents keep working (unknown keys are ignored per MAKO §5.1 guidance).

**Dual-stack note.** AIFeed also defines its own native content profile, **AIFeed Markdown**
(`text/aifeed+markdown`, `.aifeed.md`, `aimd: "1.0"`), specified in
`spec/en/aifeed-aimd-v1.md`. MAKO remains a first-class **compatibility profile**: the
same signed bytes can be served under both media types, each with its own signature
context (`aimd` / `mako`), and cross-format replay is rejected. This proposal stays
useful either way — if the `aifeed` extension is adopted upstream, MAKO gains the trust
layer; if not, the same trust layer lives in the native profile without blocking
interoperability.

---

## 2. Motivation

- **Attribution.** MAKO §10.4 acknowledges that publishers can generate arbitrary
  content and that consumers must defend themselves. Signatures make MAKO documents
  attributable to a domain key: spam and manipulation become traceable to a real
  origin, with a revocation path.
- **Permission clarity.** MAKO carries content; AIFeed carries the *rules* for that
  content (training, retrieval, quoting, summarization, attribution, rate limits,
  licensing). Signed rules are enforceable and auditable; unsigned prose in HTML terms
  is not.
- **Efficiency.** MAKO already removes markup noise. Signatures and an index remove the
  remaining waste: re-downloading unchanged pages and re-validating unknown content.
  Measured on a 60-page news corpus: MAKO conversion −68.8% bytes vs HTML, delta
  consumption −95.7% vs re-crawling HTML, verification ≈0.28 ms/page
  (`benchmarks/mako-report.md`).
- **Complementarity.** The proposal is compatible with CEF embeddings (treated as
  untrusted hints per MAKO §10.2) and with `/.well-known/mako` discovery.

---

## 3. Non-goals

- Not a replacement for MAKO's content format, discovery, or headers.
- Not a payment protocol; licensing references (RSL/prices) are declarations only.
- Not a consumer-side ranking or spam filter.
- No changes to MAKO required fields, media type, or negotiation semantics.

---

## 4. Extension A — `aifeed` frontmatter block (optional)

```yaml
---
mako: "1.0"
type: article
entity: "Panduan Protokol AIFeed"
updated: 2026-09-14
tokens: 280
language: id
aifeed:
  policy_version: "0.2"
  usage:                # restrict-only overrides by default
    training: deny
    summarize: allow
  attribution: required
  limits:
    requests_per_minute: 30
    concurrent: 2
  license:              # informational (RSL/payment discovery)
    rsl_url: https://example.com/rsl.xml
    price: { amount: 250, currency: USD }
  assets:               # media and downloadable file links (optional)
    - { url: /uploads/cover.webp, type: image, alt: "Cover" }
    - { url: /laporan.pdf, type: document, title: "Full report" }
---
```

Rules:

- The block is **optional**; absence means "inherit the origin manifest".
- Overrides are **restrict-only** unless the origin manifest declares
  `content.mako.overrides: "bidirectional"`. A page cannot grant what the origin denies.
- Attribution strictness is `required > optional > none`; limits may only tighten.
- `assets` lists media and downloadable files (images, video, audio, documents,
  archives, `file`) as references only — they are never inlined, fetching them follows
  the same permissions and limits as content, and the agent decides whether to download.
- Parsers MUST use a safe YAML subset: no anchors, aliases, tags, flow collections,
  block scalars, or merge keys; bounded depth (6), nodes (512), and scalar size (8 KiB).

---

## 5. Extension B — Detached signature container (optional)

```json
{
  "algorithm": "ed25519",
  "context": "mako",
  "url": "https://example.com/product/123",
  "key_fingerprint": "sha256:<43 chars>",
  "signed_at": "2026-09-15T08:00:00Z",
  "signature": "base64url:<86 chars>",
  "raw_digest": { "sha-256": "<43 chars + '='>", "applies_to": "raw-bytes" }
}
```

- **Signed bytes:** `UTF-8("aifeed.mako.v0.2\n") || ASCII(url) || LF || raw bytes`,
  where `raw bytes` are the MAKO document bytes exactly as served and `url` is the
  canonical page URL (host lowercase, no fragment/query). `https` is required;
  implementations MAY accept loopback `http` only for testing.
- **Delivery (precedence):**
  1. Inline header: `X-Aifeed-Signature: mako1:<base64url(JCS(container))>`
  2. Declared sidecar: `X-Aifeed-Signature-URL` or `Link: rel="aifeed-signature"`
  3. Default sidecar: `{mako-url}.sig`
- The signature key is the origin's Ed25519 key published in its AIFeed manifest
  (`/.well-known/ai.json`, itself signed and DNS-anchored via `_aifeed` TXT).
- The index MAY be signed with `context: "mako-index"` and
  `UTF-8("aifeed.mako-index.v0.2\n") || ASCII(url) || LF || raw bytes`, delivered as a
  sidecar (`{index-url}.sig`). Self-referential embedded signatures are undefined.

---

## 6. Extension C — Delta index (optional)

`/.well-known/mako-index.json` (path declared by the manifest):

```json
{
  "version": "0.2",
  "domain": "example.com",
  "site": {
    "name": "Example News",
    "description": "Independent daily news, technology and business desks.",
    "type": "news",
    "languages": ["en"],
    "updated_at": "2026-09-15T08:00:00Z"
  },
  "generated_at": "2026-09-15T08:00:00Z",
  "page": 1,
  "page_count": 1,
  "entries": [
    { "url": "/product/123", "type": "product", "tokens": 280,
      "title": "Nike Air Max 90", "summary": "Casual running shoe, 79.99 EUR.",
      "tags": ["running", "shoes"], "lang": "en",
      "updated": "2026-09-14", "etag": "\"mako-a1b2c3\"",
      "sha-256": "<43 chars + '='>" }
  ]
}
```

- The optional `site` object is a site-level resume (name, description ≤500, type,
  languages, license, updated_at) so agents understand the origin before fetching.
- Entries may carry triage fields (`title`, `summary` ≤160, `tags` ≤10, `lang`,
  `related` ≤20) so agents can rank and select pages without downloading them; all
  triage fields must come from published content only.
- Pageable (`Link: rel="next"`), conditional (`If-None-Match`), `?since=` optional.
- Publishers MAY also serve `/llms.txt` (llms.txt v2) as unsigned discovery text for
  non-AIFeed tooling; permissions always come from the signed manifest, never from
  llms.txt.
- Entries and triage fields are **untrusted claims**: clients MUST verify each
  `sha-256` against fetched bytes before use.

---

## 7. Conformance levels (proposed)

| Level | Requirements |
|---|---|
| `AIFeed-C1` | Validates signed origin manifests (v0.1/v0.2) |
| `AIFeed-C2` | C1 + consumes MAKO via negotiation + restrict-only permission binding |
| `AIFeed-C3` | C2 + verifies MAKO signatures (all delivery modes) + downgrade handling |
| `AIFeed-C4` | C3 + delta index + revocation + offline bundles with MAKO snapshots |

---

## 8. Security considerations (summary)

- Safe YAML subset required (frontmatter is attacker-reachable input).
- URL binding prevents cross-page replay; digest mismatch and bad signatures are hard
  failures.
- Manifest `signature: "required"` prevents silent stripping; missing signature yields
  high-risk denial for that origin.
- Index poisoning is mitigated by per-entry digests and optional index signatures.
- CEF embeddings remain untrusted pre-filter hints (MAKO §10.2).
- `X-Mako-*` and `X-Aifeed-*` headers MUST NOT be present on `401`/`403` (extends
  MAKO §10.6).

---

## 9. Backward compatibility

- MAKO required fields, media type, negotiation, and headers are untouched.
- The extension adds one optional frontmatter key (`aifeed`) and optional headers
  (`X-Aifeed-*`), plus optional well-known documents.
- MAKO parsers that ignore unknown frontmatter keys require no changes.
- Degradation is graceful: unsigned MAKO remains valid MAKO; the trust layer simply
  reports `mako_verified = false`.

---

## 10. Reference implementation

- Specification (EN + ID): `spec/en/aifeed-v0.2.md`, `spec/id/aifeed-v0.2.md`
- Schemas: `schema/ai-json.v0.2.json`, `schema/mako.v0.2.json`,
  `schema/mako-signature.v0.2.json`, `schema/mako-index.v0.2.json`
- Conformance vectors: `conformance/mako/` (33 cases) — verified by independent
  JavaScript and Python implementations.
- CLI: `aifeed mako generate|sign|verify|index|fetch`
- SDK: `packages/aifeed-verify` (`fetchMako`, `fetchIndexDelta`, `mako.*`)
- Publisher: `wp-plugin/` (WordPress, content negotiation + signing + index)
- Benchmark: `benchmarks/mako-report.md`

The extension text is released under CC BY 4.0; code under MIT. We welcome review,
naming feedback, and alignment with the MAKO roadmap (site-level manifests, §13).
