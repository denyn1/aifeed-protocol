# AIFeed v0.2 — MAKO Trust Profile (Extension to v0.1)

<p><a href="../en/aifeed-v0.2.md">English</a> · <a href="../id/aifeed-v0.2.md">Bahasa Indonesia</a> · <a href="../zh/aifeed-v0.2.md">中文</a></p>

**Version:** 0.2.0-draft
**Status:** Draft — not frozen (see "Status of This Document")
**Canonical language:** English (this document). Translations are informational.
**License:** CC BY 4.0 (this document) · MIT (reference implementation)

---

## Abstract

AIFeed v0.1 defines signed, DNS-anchored declarations of what AI systems may do with a
web origin's content. This extension (v0.2) binds those declarations to **MAKO
(Markdown Agent Knowledge Optimization)** — the open per-page markdown delivery format
for AI agents — and closes the verification gap MAKO leaves open by design:

> "MAKO does not provide built-in mechanisms to verify that the MAKO representation is
> faithful to the source HTML. This is intentional. […] The protocol provides verifiable
> content; it does not provide verification." — MAKO Specification v0.1.0, §10.3

AIFeed v0.2 adds three layers on top of MAKO:

1. **AIFeed-Verified MAKO** — optional Ed25519 detached signatures over the raw bytes of
   a MAKO document, bound to the page URL and to the manifest key.
2. **Permission binding** — per-page permission, limit, and licensing overrides in the
   MAKO frontmatter (`aifeed:` block), inherited from the manifest and restricted by
   default ("restrict-only").
3. **Delta consumption** — an optional, paginated MAKO index with per-entry digests so
   clients fetch only what changed (`304` / index diff) instead of crawling HTML.

AIFeed v0.2 is additive: v0.1 sections remain normative unless explicitly amended here,
and v0.2 clients MUST remain able to verify v0.1 manifests.

---

## Status of This Document

This is a draft extension for reference implementation and interoperability testing.
The specification is **not frozen**; changes are allowed until v0.2.0 final. BCP 14 key
words (RFC 2119, RFC 8174) apply.

Two external dependencies are pinned and tracked:

| Dependency | Pinned reference | Change policy |
|---|---|---|
| MAKO | Protocol `"1.0"`, specification document v0.1.0 (Draft, 2026-02-18) | See Appendix A |
| AIFeed v0.1 | `spec/en/aifeed-v0.1.md` (0.1.0-rc1) | Amended only where stated |

---

## 1. Relationship to v0.1

1. This document is an **extension specification**. Sections 1–13 and Appendices A–C of
   v0.1 remain normative for all manifests, including version `0.2.x`, except where this
   document amends them explicitly (§5, §9, §10, §14, Appendix D of this document).
2. A manifest with `version` matching `^0\.2(\.[0-9]+)?$` MUST satisfy both the v0.1
   schema (minus the version pattern) and `schema/ai-json.v0.2.json`.
3. **Version-dependent domain separation.** The signed bytes for a manifest depend on its
   `version` field:

   | Manifest `version` | Signed bytes | Signature schema |
   |---|---|---|
   | `0.1.x` | `UTF-8("aifeed.v0.1\n") \|\| JCS(manifest)` | `ai-signature.v0.1.json` |
   | `0.2.x` | `UTF-8("aifeed.v0.2\n") \|\| JCS(manifest)` | `ai-signature.v0.2.json` |

4. Version acceptance (normative): a v0.2 client MUST accept `version ∈ {0.1, 0.1.x}`);
   it MUST accept `version ∈ {0.2, 0.2.x}`; other values → `UNVERIFIED(upgrade_required)`.
   A v0.1 client encountering `0.2.x` returns `UNVERIFIED(upgrade_required)` — this is
   expected and safe.
5. MAKO-related requirements apply only to origin manifests that declare
   `content.mako` (§5.2). MAKO documents served by an origin without an AIFeed manifest
   are outside AIFeed trust semantics (`UNVERIFIED`).

---

## 2. Conventions and Terminology (additions)

- **MAKO document** — a UTF-8 markdown document with YAML frontmatter, identified by
  `Content-Type: text/mako+markdown`, conforming to the MAKO specification.
- **MAKO pair** — a MAKO document plus its optional AIFeed signature container (§7).
- **Page URL** — the absolute `https` URL of the page the MAKO document represents,
  without fragment or query, NFC-normalized.
- **mako_verified** — verification flag: the MAKO signature is present, well-formed, and
  valid against the manifest key and the page URL.
- **YAML-safe subset** — the frontmatter grammar in §6.5. Full YAML is NOT accepted.

Strict input rules from v0.1 §2 apply to all AIFeed-parsed JSON, including signature
containers and the MAKO index.

---

## 3. Discovery and File Layout (additions)

```
/.well-known/ai.json                Manifest (signed)              [v0.1]
/.well-known/ai-signature.json      Signature container            [v0.1]
/.well-known/mako                   MAKO site discovery (MAKO spec)[optional]
/.well-known/mako-index.json        MAKO delta index               [optional, §8]
{page-url}                          MAKO via content negotiation   [primary]
{page-url}.sig                      MAKO signature sidecar         [§7.2]
{path}.mako.md                      Static MAKO file               [fallback]
{path}.mako.md.sig                  Static signature sidecar       [§7.2]
```

Discovery order for MAKO-aware AIFeed clients (normative): (1) manifest
`content.mako`; (2) `Link: <...>; rel="alternate"; type="text/mako+markdown"`;
(3) MAKO `/.well-known/mako`; (4) HTML `<link rel="alternate">` /
`<script type="text/mako+markdown">`. Content negotiation (MAKO §6.1) is the primary
access method; the static file and explicit-endpoint patterns are equivalent fallbacks
for hosting that cannot negotiate (MAKO §6.3).

---

## 4. Manifest v0.2 (additions)

The v0.2 manifest is a v0.1 manifest with `version: "0.2"` plus the `content.mako`
object below. All other v0.1 constraints (size, limits, strictness) are unchanged.

### 4.1 `content.mako`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `index_url` | path | no | none | Delta index location (§8); MUST start with `/` |
| `signature` | enum | no | `optional` | `required` \| `optional` |
| `overrides` | enum | no | `restrict-only` | `restrict-only` \| `bidirectional` (§6.4) |
| `embedding` | boolean | no | `false` | Origin declares CEF embedding use; embeddings remain untrusted (MAKO §10.2) |

Presence of `content.mako` (possibly an empty object) declares MAKO support. Absence
means MAKO is not declared; clients MUST NOT interpret MAKO files from that origin as
part of an AIFeed trust profile.

### 4.2 Semantics

- `signature: "required"` asserts that every MAKO document served for this origin
  carries a valid AIFeed signature. If a client cannot verify it, high-risk uses
  (`training`, `reproduce`, `modify`, `commercial_use`, and all `actions`) MUST be denied
  and the page MUST NOT be treated as `VERIFIED` for MAKO consumption.
- `overrides` controls per-page permission binding (§6.4).
- Limits from v0.1 §4.6 apply to MAKO endpoints as well; a MAKO consumable via content
  negotiation consumes the same crawl budget as the HTML page.

---

## 5. MAKO Compatibility Profile (normative)

### 5.1 Pinned MAKO behaviour

Clients MUST follow the MAKO specification for: content negotiation (`Accept:
text/mako+markdown`), required response headers (`Content-Type`, `X-Mako-Version`,
`X-Mako-Tokens`, `X-Mako-Type`, `X-Mako-Lang`, `Vary: Accept`), HEAD pre-filtering,
conditional requests, and silent fallback to HTML (MAKO §6). AIFeed does not redefine
MAKO semantics; it only adds trust and permission layers.

- `X-Mako-Version` MUST be `1.0` for the pin in this document; other values, or a
  frontmatter `mako` value other than `"1.0"`, yield error `mako_unsupported` and the
  client falls back to HTML rules for content consumption.
- The `mako` frontmatter value MUST be treated as a string; writers MAY omit quotes
  (`mako: 1.0`) and readers MUST normalize the unquoted numeric literal to `"1.0"`.
- Unknown MAKO frontmatter keys MUST be ignored (MAKO compatibility) **except** the
  `aifeed` key defined in §6, which follows the stricter rules of this document.
- CEF embeddings (`X-Mako-Embedding*`) are treated as untrusted hints (MAKO §10.2).

### 5.2 Required and forbidden headers

For MAKO responses, servers MUST include the MAKO required headers and SHOULD include
`ETag` and `Cache-Control`. In addition:

- MAKO responses MUST NOT include `X-Aifeed-Signature` or `X-Aifeed-Signature-URL` on
  `401` or `403` responses (mirrors MAKO §10.6, extended to AIFeed headers).
- `Vary: Accept` is REQUIRED so caches do not mix HTML and MAKO representations.

### 5.3 Static and fallback patterns

When content negotiation is unavailable, publishers MAY serve `{path}.mako.md` plus a
`<link rel="alternate" type="text/mako+markdown" href="...">` element (MAKO §6.3). AIFeed
signature rules (§7) apply to the bytes actually served, regardless of transport pattern.

---

## 6. Permission Binding

### 6.1 The `aifeed` frontmatter block

MAKO documents MAY include a top-level `aifeed` mapping in the YAML frontmatter:

```yaml
aifeed:
  policy_version: "0.2"
  usage:                 # optional; restrict-only overrides by default
    training: deny
    summarize: allow
  attribution: required  # required | optional | none
  limits:
    requests_per_minute: 10
  license:               # informational (RSL/payment discovery)
    rsl_url: https://example.com/rsl.xml
    price:
      amount: 250        # integer, minor units
      currency: USD
  assets:                # media and downloadable files (links only)
    - url: /uploads/sampul.webp
      type: image
      alt: "Foto sampul"
    - url: /media/demo.mp4
      type: video
      title: "Video demo"
    - url: /laporan.pdf
      type: document
      title: "Laporan lengkap"
```

`assets` lists media and downloadable files referenced by the page (images, video,
audio, documents, archives, other files typically marked with the HTML `download`
attribute). Each entry carries `url`, `type` (`image`, `video`, `audio`, `document`,
`archive`, `file`), and optional `mime`, `title`, and `alt`. The list is **references
only**: assets are never inlined, fetching them is subject to the same permissions and
limits as page content, and the client decides whether to download them. Converters
SHOULD also keep inline references in the markdown body (for example images as
`![alt](url)`) and SHOULD emit a short "Media & Unduhan" style section listing the
asset links so non-AIFeed MAKO consumers can find them too.

### 6.2 Inheritance

Effective permissions are computed per usage key as:

```
base(usage)     = manifest.permissions.usage[usage] if present
                  else manifest.permissions.default
page(usage)     = aifeed.usage[usage] if present else unset
effective       = resolve(base, page, manifest.content.mako.overrides)
```

### 6.3 `restrict-only` (default)

Under `restrict-only`, a page value may only make the policy **more restrictive**:

- `allow` → `deny` is honored.
- `deny` → `allow` is REJECTED; clients MUST ignore it and SHOULD record
  `permission_override_rejected`.
- Attribution: `required` is stricter than `optional`, which is stricter than `none`.
  Loosening (e.g. `required` → `none`) is REJECTED.
- Limits may only be tightened: lower `requests_per_minute`/`concurrent`, higher
  `crawl_delay_seconds`. Loosening is REJECTED.
- `license`: a page MUST NOT replace the manifest license. A page MAY add a license
  only when the manifest declares none; an identical license (key order ignored) is
  accepted silently. Any other replacement is REJECTED with
  `permission_override_rejected` and the manifest license applies. A license never
  changes `usage` permissions. Rationale: otherwise a compromised or buggy page could
  relicense content the origin never granted.

### 6.4 `bidirectional`

Only when `content.mako.overrides` is explicitly `"bidirectional"` may a page grant what
the manifest denies or loosen attribution/limits. Even then, the manifest remains
authoritative for revocation and trust level.

### 6.5 YAML-safe subset (normative)

Because frontmatter parsing is a new attack surface, AIFeed v0.2 defines a strict
subset. Parsers MUST reject documents that violate any rule below:

1. Frontmatter is the block delimited by the first `---` line and the next `---` line;
   maximum 32 KiB; UTF-8, NFC-required; no BOM; LF or CRLF line endings only.
2. Mappings use block style with 2-space indentation; sequences use `- ` items.
   Flow collections (`{...}`, `[...]`) MUST be rejected.
3. Scalars: plain, single-quoted, or double-quoted only. Literal (`|`) and folded (`>`)
   block scalars MUST be rejected. Null/`~` MUST be rejected.
4. Anchors (`&`), aliases (`*`), tags (`!`), directives (`%`), multi-document markers
   (`...`), and merge keys (`<<`) MUST be rejected.
5. Duplicate keys MUST be rejected. Keys MUST match `^[A-Za-z0-9_-]{1,64}$`.
6. Integers MUST satisfy `|n| <= 2^53 - 1`; floats and exponent notation MUST be
   rejected. Booleans are `true`/`false` only.
7. Maximum nesting depth 6; maximum 512 nodes; maximum scalar length 8 KiB.
8. Comments (`#` to end of line) are allowed outside quoted scalars.
9. Control characters other than LF/CR/TAB MUST be rejected; TAB MUST NOT be used for
   indentation.
10. The `aifeed` block is validated against `schema/mako.v0.2.json`; unknown fields
    inside `aifeed` MUST be rejected unless they begin with `x_`.

Parsers MUST NOT use object-instantiation features of general YAML libraries (e.g.
`!!python/object`); a deterministic subset parser is required.

---

## 7. AIFeed-Verified MAKO

### 7.1 Signature container (`mako-signature.v0.2.json`)

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

- **Signed bytes:** `UTF-8("aifeed.mako.v0.2\n") || ASCII(url) || 0x0A || raw bytes`
  where `raw bytes` are the MAKO document bytes exactly as served (after transfer
  decoding), and `url` is the canonical page URL (lowercase host, no fragment/query).
  The URL MUST be an absolute `https` URL; implementations MAY accept `http://` URLs
  **only** for loopback hosts (`127.0.0.1`, `[::1]`, `localhost`, optional port) in test
  environments.
- **Key:** the Ed25519 key from the origin manifest (`identity.public_key`);
  `key_fingerprint` MUST match `sha256:` + base64url(SHA-256(SPKI DER)).
- **`raw_digest`:** SHA-256 (standard base64) over the same raw bytes; it is a transport
  integrity check, not a substitute for the signature (v0.1 §5.1 rules apply).
- Container size ≤ 2 KB; strict JSON rules apply (v0.1 §2).

### 7.2 Delivery (precedence)

1. **Inline header (preferred).** `X-Aifeed-Signature: mako1:<base64url>` where the
   payload is `JCS(container)`. Clients decode, then verify §7.1. No extra request.
2. **Declared sidecar.** `X-Aifeed-Signature-URL: </path.sig>` or
   `Link: </path.sig>; rel="aifeed-signature"`; clients GET it (≤2 KB, conditional GET
   allowed).
3. **Default suffix.** If none of the above is present, the client MAY try the default:
   MAKO URL + `.sig` (negotiated: `{page-url}.sig`; static file: `{file}.mako.md.sig`).

Servers that declare `signature: "required"` SHOULD use (1) or (2). Missing signature →
`mako_verified = false`; if the manifest requires signatures, high-risk uses MUST be
denied (§4.2) and the client SHOULD surface `mako_signature_missing`.

### 7.3 Verification procedure

```
INPUT : MAKO bytes B, page URL U, manifest M (VERIFIED), container C (optional)
1. Strict-parse C (≤2 KiB). If absent → mako_verified=false; stop.
2. C.context == "mako" and C.algorithm == "ed25519" → else fail.
3. C.url == U → else fail (replay across URLs).
4. C.key_fingerprint == fingerprint(M.identity.public_key) → else fail.
5. SHA-256(B) == C.raw_digest["sha-256"] → else fail (mako_digest_mismatch).
6. Ed25519 verify("aifeed.mako.v0.2\n" || U || LF || B, C.signature, M key) → else fail.
7. mako_verified = true
```

### 7.4 Signer requirements

Signers MUST validate the MAKO document (frontmatter subset + required MAKO fields),
sign only bytes they serve, verify that `identity.public_key` matches the signing key,
and self-verify before publishing. Signers MUST NOT sign documents served differently to
different clients.

---

## 8. Delta Consumption (MAKO Index)

### 8.1 Index document (`mako-index.v0.2.json`)

```json
{
  "version": "0.2",
  "domain": "example.com",
  "site": {
    "name": "Example News",
    "description": "Independent daily news, technology and business desks.",
    "type": "news",
    "languages": ["en"],
    "license": "All Rights Reserved",
    "updated_at": "2026-09-15T08:00:00Z"
  },
  "generated_at": "2026-09-15T08:00:00Z",
  "page": 1,
  "page_count": 3,
  "entries": [
    {
      "url": "/product/123",
      "type": "product",
      "tokens": 280,
      "title": "Nike Air Max 90",
      "summary": "Casual running shoe, 79.99 EUR, in stock.",
      "tags": ["running", "shoes"],
      "lang": "en",
      "related": ["/product/adidas-ultraboost"],
      "updated": "2026-09-14T12:00:00Z",
      "etag": "\"mako-a1b2c3\"",
      "sha-256": "<43 chars + '='>"
    }
  ]
}
```

Rules: `domain` MUST equal the serving host **name** (URL hostname, without port); entries
per page 1–50 000; document ≤ 5 MB decompressed; pagination via
`Link: <...>; rel="next"`; servers SHOULD support `If-None-Match` and MAY support
`?since=<RFC3339>` (clients MUST tolerate a full `200` response when `since` is
unsupported). The index MAY be signed using the §7.1 container
with `context: "mako-index"` and signed bytes
`UTF-8("aifeed.mako-index.v0.2\n") || ASCII(url) || 0x0A || raw bytes`. The index
signature is delivered as a **sidecar** at `{index-url}.sig` (default) or via
`X-Aifeed-Signature-URL` / `Link: rel="aifeed-signature"`; it MUST NOT be embedded in
the index document itself (self-referential signatures are undefined).

#### Site resume and triage fields (optional)

The optional `site` object is the site-level resume: `name`, `description` (≤500 chars),
`type` (manifest vocabulary), `languages`, `license`, and `updated_at`. It lets an agent
understand what the origin publishes before fetching any page. Descriptions MUST be
public information (the same text a publisher would show to visitors).

Entries MAY carry triage fields so an agent can decide **which pages to fetch** without
downloading them: `title` (≤500), `summary` (≤160), `tags` (≤10), `lang`, and `related`
(≤20 URL paths). Rules:

- Triage fields MUST be derived from published content only; drafts, private pages, and
  unpublished metadata MUST NOT appear.
- Triage fields are **untrusted hints**, like index entries: a client MUST still verify
  the per-entry `sha-256` (and the index signature when present) before use.
- Clients SHOULD use triage fields to rank and select entries (for example by title,
  tags, and summary relevance within a token or page budget) and SHOULD then fetch only
  the selected MAKO documents.

### 8.2 Consumption algorithm (normative)

```
1. Fetch manifest (v0.1 §7). If content.mako absent → HTML rules only.
2. If index_url present: GET index (conditional). 304 → no change; done.
3. Rank and select entries using the site resume and triage fields (title, summary,
   tags, related) within the client's page/token budget. Selection is a client policy:
   the protocol only supplies the hints.
4. Diff the selected entries against the client's stored digests; keep changed/new URLs.
5. For each kept URL: GET with Accept: text/mako+markdown (+ If-None-Match).
6. Verify signature (§7.3) per manifest.content.mako.signature.
7. Compute effective permissions (§6.2) and enforce limits.
8. Store {url, digest, etag, updated} for the next cycle.
```

Index entries are **untrusted claims**: clients MUST verify the per-item `sha-256`
against the fetched MAKO bytes before use, and MUST NOT treat the index as proof of
permission or authenticity.

---

## 9. Verification Procedure v0.2 (amendments to v0.1 §7)

1. Steps 1–4 of v0.1 §7 are unchanged, with two additions: after strict parsing, the
   MANIFEST schema selection is version-driven (§1.3 of this document); and a v0.2
   manifest MUST additionally satisfy `schema/ai-json.v0.2.json`.
2. Step 5 of v0.1 §7 is replaced by the version acceptance rules in §1.4.
3. Step 9 of v0.1 §7 uses the version-dependent domain separation of §1.3.
4. After step 15, if `content.mako` is present and the client intends MAKO consumption,
   run the MAKO subprocedure of §5–§8. Result adds flags: `mako_verified`,
   `mako_signature_present`, and warnings (`mako_unsupported`, `mako_signature_missing`,
   `mako_digest_mismatch`, `permission_override_rejected`, `mako_stale`).
5. High-risk uses require `level = VERIFIED`, `dns_anchored = true`, and — when
   `content.mako.signature == "required"` — `mako_verified = true` (v0.1 §8 extended to
   MAKO).
6. If `content.mako.signature == "required"` and `mako_verified = false`, MAKO content
   MUST be treated with UNVERIFIED semantics (search/retrieval/input only, conservative
   limits, attribution).

### 9.1 MAKO error codes (normative subset)

Conformance vectors are authoritative for exact codes; implementations MUST use these
codes for interoperability:

| Group | Codes |
|---|---|
| Frontmatter | `mako_frontmatter_missing`, `mako_frontmatter_invalid`, `mako_unsupported`, `frontmatter_missing`, `frontmatter_too_large`, `bom_forbidden`, `invalid_utf8`, `not_nfc`, `duplicate_key`, `float_not_allowed`, `integer_out_of_range`, `scalar_too_long`, `node_limit_exceeded` |
| YAML subset | `yaml_anchor_forbidden`, `yaml_alias_forbidden`, `yaml_tag_forbidden`, `yaml_directive_forbidden`, `yaml_block_scalar_forbidden`, `yaml_flow_forbidden`, `yaml_merge_forbidden`, `yaml_null_forbidden`, `yaml_tab_indent`, `yaml_indent_invalid`, `yaml_max_depth`, `yaml_key_invalid`, `yaml_parse_error`, `yaml_empty_value`, `yaml_control_char`, `yaml_inline_mapping_forbidden`, `yaml_document_marker_forbidden` |
| Permission binding | `aifeed_invalid`, `aifeed_unknown_field`, `permission_override_rejected` (warning) |
| Signature | `mako_container_malformed`, `mako_context_invalid`, `mako_url_mismatch`, `mako_url_invalid`, `mako_manifest_key_invalid`, `mako_key_mismatch`, `mako_digest_mismatch`, `mako_bad_signature`, `mako_signature_missing` |
| Index | `mako_index_malformed`, `mako_index_invalid`, `mako_index_domain_mismatch`, `mako_index_digest_mismatch` |
| Freshness | `mako_stale` (warning) |

---

## 10. Trust Levels and Conformance

### 10.1 Trust levels (v0.1 §8 extended)

| Level | MAKO additions |
|---|---|
| VERIFIED | Manifest checks pass; `mako_verified` reported separately |
| UNVERIFIED | As v0.1; MAKO content: declarative only, high-risk denied |
| SUSPENDED | As v0.1; cached MAKO documents are purged with cached content |

### 10.2 AIFeed v0.2 conformance levels

| Level | Requirements |
|---|---|
| `AIFeed-C1` | v0.1 client + validates v0.2 manifests (schema) |
| `AIFeed-C2` | C1 + consumes MAKO via content negotiation + restrict-only permission binding (§6) |
| `AIFeed-C3` | C2 + verifies AIFeed MAKO signatures (all delivery modes, §7) + downgrade handling (§9.6) |
| `AIFeed-C4` | C3 + delta index consumption (§8) + revocation + offline bundles with `mako/` snapshots |

Offline bundles (v0.1 Appendix B) MAY include a `mako/` directory containing raw MAKO
bytes, signature containers, and fetch metadata; `BUNDLE-MANIFEST.json` lists SHA-256
and size for each file.

---

## 11. Security Considerations (additions)

- **YAML attacks.** Anchors/aliases/tags and mixed types are rejected by the safe subset
  (§6.5); implementations MUST enforce depth, node, and size caps before allocation.
- **Signature stripping / downgrade.** A client that requires signatures per manifest
  policy treats missing signatures as high-risk denial (§9.6). Origin operators that
  later set `signature: "optional"` cannot replay old signed files to bypass new
  permissions, because permissions come from the manifest, not the MAKO file.
- **Cross-URL replay.** Signatures are bound to the page URL (§7.1); a valid signed MAKO
  for `/a` MUST be rejected on `/b`.
- **Index poisoning.** Index entries are untrusted claims; per-item digests are verified
  against fetched bytes (§8.2 step 7). Signed indices are optional and add attribution,
  not truth.
- **Cloaking.** An AIFeed signature attests that MAKO bytes came from the domain key; it
  does not prove fidelity to the HTML rendering. Clients SHOULD cross-check `updated` /
  `Last-Modified` where available and MAY diff MAKO against HTML for sensitive uses.
- **Metadata leakage.** `X-Aifeed-Signature*` headers MUST NOT appear on `401`/`403`
  (mirrors MAKO §10.6).
- **Embeddings.** CEF embeddings remain untrusted publisher hints; never use them as the
  sole relevance or ranking input (MAKO §10.2).
- **Freshness.** Content negotiated MAKO is fresher than embedded `<script>` content
  (MAKO §6.4); clients SHOULD prefer negotiation and honor `ETag` semantics.

---

## 12. IANA Considerations (additions)

No new well-known URIs are defined here. `X-Aifeed-Signature` and
`X-Aifeed-Signature-URL` are experimental headers; registration is not required for
operation and may be pursued with the `ai-feed` link relation (v0.1 §12). The
`text/mako+markdown` media type is defined by MAKO, not by this document.

---

## 13. References (additions)

- MAKO Specification v0.1.0 (Draft, 2026-02-18) and MAKO HTTP Headers Reference —
  `github.com/juanisidoro/mako-spec`
- RFC 3339, RFC 8032, RFC 8785, RFC 9530 (as v0.1 §13)
- MAKO §6 (content negotiation), §7 (headers), §9 (conformance), §10 (security)

---

## 14. Key Rotation

Every signing key has a lifetime. This OPTIONAL ceremony replaces a manifest signing
key without breaking verification, and amends v0.1 §6 (DNS anchor) and §7
(verification). Manifests that never rotate are unaffected.

### 14.1 The `rotation` directive

`rotation` is an OPTIONAL top-level object, valid only in `version: "0.2"` manifests.
It carries exactly one of `successor_fp` (announcement, signed by the current key) or
`predecessor_fp` (cutover, signed by the new key):

| Field | Required with | Rule |
|---|---|---|
| `successor_fp` | announcement | `sha256:` fingerprint of the successor key |
| `effective_at` | `successor_fp` | cutover instant (UTC, RFC 3339) |
| `grace_until` | `successor_fp` | old-key deadline; MUST exceed `effective_at` by ≥ 1 h (RECOMMENDED ≥ 2 × (DNS TTL + 24 h)) |
| `predecessor_fp` | cutover | fingerprint of the retired key |
| `supersedes_at` | `predecessor_fp` | MUST NOT exceed `signed_at` + 300 s |

Any other combination, missing field, or malformed timestamp → `rotation_invalid`.

### 14.2 DNS `pk2` (advisory, amends v0.1 §6)

During the overlap the TXT record SHOULD carry the successor:

```
_aifeed.example. 3600 IN TXT "v=aifeed1; pk=<old>; pk2=<new>; effective_at=<ts>; manifest=https://example/.well-known/ai.json"
```

`pk` MUST match the served manifest key (existing rule). `pk2` is an advisory
cross-check: a missing, mismatching, or unannounced `pk2` yields warning
`rotation_anchor_unverified`, never a rejection — the trust anchor is the old-key
signature on the directive, so a forged `pk2` alone changes nothing. High-risk
clients MAY treat the warning as an error.

### 14.3 Phases

- `announced` — `now` < `effective_at`: old key fully accepted.
- `grace` — `effective_at` ≤ `now` < `grace_until`: accepted with warning
  `grace_accepted`.
- `completed` — `now` ≥ `grace_until`: rejected (`rotation_denied`), unless the key is
  revoked (`key_revoked`).

A publisher that never cuts over has misconfigured its rotation: after `grace_until`
its own manifest is rejected. Re-issue rather than extend silently.

### 14.4 Verification (amends v0.1 §7)

1. Directive rules (§14.1) run inside manifest validation.
2. The DNS cross-check (§14.2) runs wherever DNS is available; offline verifiers report
   state from the directive alone.
3. Clients that persist a key pin MUST NOT accept a change the pinned key did not
   announce or bind via `predecessor_fp` (`rotation_denied`); a dormant pin that missed
   the announcement MAY re-pin when `predecessor_fp` matches it (warning
   `rotation_resync`). SDK helper: `rotation.evaluateContinuity`.
4. If the signing key fingerprint appears in the `keys[]` of a valid revocation
   document → `key_revoked` (error). Revocation beats grace.

### 14.5 Emergency rotation

A suspected key compromise does not call for instant revocation — that opens an outage.
Use `aifeed rotate --accelerated` (compressed window, e.g. 6 h), cut over immediately,
then publish the old fingerprint. This does not eliminate risk; it bounds it: the
possibly-compromised key stays accepted for at most the window. Rotation protects keys,
not origins; pathological DNS TTLs and HSM/KMS storage are out of scope. The full
runbook is in `docs/rotation.md`.

### 14.6 Codes

| Code | Kind | Meaning |
|---|---|---|
| `rotation_invalid` | error | Directive malformed or inconsistent (including window < 1 h) |
| `rotation_anchor_unverified` | warning | DNS `pk2` missing, mismatching, or unannounced (advisory) |
| `grace_accepted` | warning | Old-key signature accepted inside the grace window |
| `rotation_denied` | error | Retired key past grace, unannounced change, or rollback |
| `rotation_resync` | warning | Dormant pin re-pinned through `predecessor_fp` |
| `key_revoked` | error | Signing key fingerprint listed in a valid revocation document (v0.1 §7 step 14) |

---

## Appendix A — MAKO Compatibility and Pinning

| MAKO element | AIFeed v0.2 stance |
|---|---|
| Protocol version `"1.0"` | Required exact match; others unsupported |
| Spec document v0.1.0 draft | Pinned; tracked for changes |
| Frontmatter required fields | Validated (`mako`, `type`, `entity`, `updated`, `tokens`, `language`) |
| Optional fields | Passed through; `aifeed` handled per §6 |
| CEF embeddings | Untrusted, optional, `embedding` flag informational |
| `/.well-known/mako` | Optional discovery signal; manifest remains authoritative |
| Levels 1–3 | Independent of AIFeed levels (`AIFeed-C1..C4`) |

If MAKO changes a normative behaviour (headers, negotiation, required frontmatter), this
document is amended with a new appendix entry; breaking MAKO changes trigger an AIFeed
minor bump. AIFeed extension fields MUST remain confined to the `aifeed` frontmatter key
and `X-Aifeed-*` headers to avoid collisions.

---

## Appendix B — YAML-Safe Frontmatter Grammar (informative summary)

```
document      = "---" LF *(line) "---" LF
line          = mapping | sequence-item | comment | blank
mapping       = indent key ":" [ " " scalar ] LF
sequence-item = indent "- " (scalar | nested) LF
scalar        = plain | "'" *(char) "'" | '"' *(char) '"'
key           = 1*64( ALPHA / DIGIT / "_" / "-" )
indent        = 2 spaces per level, maximum 6 levels
```

Rejected constructs: anchors, aliases, tags, merge keys, directives, flow collections,
block scalars, null, floats, multi-document markers, tabs for indentation.

---

## Appendix C — Two-Party Benefits (Efficiency, Security, Legality)

Evidence labels: **[F]** verified fact, **[M]** plausible, needs measurement,
**[E]** model estimate, **[S]** measured in the local simulation harness
(loopback, reproducible), **[H]** needs legal review.

| Dimension | Web owner | AI side |
|---|---|---|
| **Efficiency** | Measured in the enforcement harness: **−55.2% bytes and −56.2% origin CPU** at S3, peak origin concurrency **−88.2%** **[S]**; 55–80% remains the edge/CDN deployment model range **[E]**; CDN offload via `304` and index diff **[M]** | Measured: **−54.8% bytes** across all profiles and **−72.9%** for the compliant client; **14/18 unchanged pages skipped** via delta; verification **0.70 ms/page** **[S]**; ~90%+ fewer tokens per page (MAKO claim −94%) **[M]**; HEAD pre-filter downloads no body **[F]**; no JS rendering **[F]** |
| **Security** | Signed permissions + DNS anchor: declarations cannot be forged or silently altered **[F]**; revocation is attributable **[F]**; cloaking becomes detectable by diffing HTML vs MAKO **[M]** | Provenance of consumed MAKO is verifiable; cross-URL replay, digest mismatch, and downgrade are detected **[F]**; embeddings treated as untrusted **[F]**; signed spam is attributable **[M]** |
| **Legality** | Machine-readable reservation of rights (aligns with TDM opt-out regimes, e.g. EU DSM Art. 4(3)) **[H]**; per-page licensing via RSL/pricing **[H]**; non-repudiable audit trail **[M]** | Documented good-faith compliance and license receipt trail; per-page certainty reduces exposure **[H]**; enforcement remains the gating factor **[F]** |

Explicit non-claims: signatures are not a contract; MAKO alone is not a license;
efficiency figures are model estimates until the benchmark track (§ Fase 5) publishes
measurements; nothing here is legal advice.

---

## Appendix D — Attack Scenarios (additions to v0.1 Appendix C)

| # | Scenario | Layer that catches it | Outcome |
|---|---|---|---|
| 13 | MAKO signature stripped in transit | Manifest `signature: required` policy | High-risk uses denied (`mako_signature_missing`) |
| 14 | Signed MAKO replayed on another URL | URL binding in signed bytes | `mako_verified=false` |
| 15 | Version rollback to an older v0.1 manifest | Anti-rollback `signed_at` (v0.1) | `UNVERIFIED` |
| 16 | Poisoned index entry pointing at attacker bytes | Per-item SHA-256 + signature verification | Entry rejected |
| 17 | YAML bomb / alias expansion in frontmatter | Safe subset caps (§6.5) | Document rejected |
| 18 | Page override attempts to allow denied training | `restrict-only` resolution | Override ignored (+warning) |
| 19 | Stale MAKO served while HTML changed | `updated`/`Last-Modified` cross-check (best effort) | `mako_stale` warning |
| 20 | Auth failure response leaks MAKO metadata | §5.2 no-leak rule | Header omitted |
| 21 | Forged `pk2` in DNS with no matching manifest directive | Directive signature is the anchor; `pk2` is advisory (§14.2) | warning `rotation_anchor_unverified` |
| 22 | Stale old-key manifest presented past grace | Directive window (§14.3) | `rotation_denied` |
| 23 | Old-key content after registry publication | Revocation `keys[]` match (§14.4) | `UNVERIFIED(key_revoked)` |
| 24 | Rollback to a retired key after cutover | Pin continuity (§14.4) | `rotation_denied` |

---

## Appendix E — Changelog v0.1 → v0.2

1. New `content.mako` manifest object (index, signature policy, overrides, embedding).
2. Version-dependent manifest domain separation (`aifeed.v0.2\n`).
3. MAKO compatibility profile with pinned MAKO protocol `1.0` (spec doc v0.1.0).
4. AIFeed-Verified MAKO: detached signature container, delivery precedence, verification.
5. Permission binding: `aifeed` frontmatter block, restrict-only default, YAML-safe subset.
6. Delta consumption: paginated MAKO index with per-entry digests.
7. Conformance levels `AIFeed-C1..C4`; extended trust-level behaviour for MAKO.
8. Security additions (YAML, downgrade, replay, index poisoning, header leakage).
9. Two-party benefits appendix and MAKO compatibility/pinning appendix.
10. Key rotation: `rotation` directive, advisory DNS `pk2` cross-check, overlap and
    grace phases, pin continuity, revocation precedence.
