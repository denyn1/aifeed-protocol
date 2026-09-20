# AIFeed Markdown v1.0 (Native Content Profile)

<p><a href="../en/aifeed-aimd-v1.md">English</a> · <a href="../id/aifeed-aimd-v1.md">Bahasa Indonesia</a> · <a href="../zh/aifeed-aimd-v1.md">中文</a></p>

**Wire identifier:** `aimd` (media type `text/aifeed+markdown`, signature contexts `aimd`/`aimd-index`, CLI command `aifeed aimd`).

**Version:** 1.0 (protocol), AIFeed specification v0.2
**Status:** Draft — not frozen
**Canonical language:** English (this document). Translations are informational.
**License:** CC BY 4.0 (this document) · MIT (reference implementation)
**Media type:** `text/aifeed+markdown` · **File extension:** `.aifeed.md`

---

## Abstract

AIFeed Markdown is the native AIFeed content profile: a per-page markdown
document whose frontmatter carries the AIFeed policy block as a first-class citizen.
It is specified here so that AIFeed does not depend on any single external content
format, while remaining **dual-stack**: the same origin may also serve MAKO
(`text/mako+markdown`) documents, and the same signed bytes can satisfy both profiles.

AIFeed Markdown reuses the verification, permission, asset, triage, and delta machinery defined in
the AIFeed v0.2 specification (`spec/en/aifeed-v0.2.md`) and extends the manifest with
`content.profile` and `content.index_url`.

---

## 1. Relationship to AIFeed v0.2 and MAKO

1. This document is a **content profile** of AIFeed v0.2. Sections of v0.2 remain
   normative except where amended here.
2. MAKO remains a **compatibility profile**: AIFeed implementations MUST accept
   MAKO documents when advertised, and MAY serve them.
3. Manifests stay at `version: "0.2"` and declare the served profile:

   | `content.profile` | Meaning |
   |---|---|
   | `mako` | MAKO documents only (legacy v0.2 behavior) |
   | `aifeed-md` | AIFeed Markdown documents only |
   | `both` | Same bytes served under both media types (dual markers) |

   `content.index_url` declares the canonical delta index path
   (AIFeed Markdown default: `/.well-known/aifeed-index.json`; MAKO default:
   `/.well-known/mako-index.json`). When both are published, `content.mako.index_url`
   continues to point at the MAKO path.

---

## 2. Document Format

An AIFeed Markdown document is UTF-8 markdown with a YAML-subset frontmatter (the safe subset of
v0.2 §6.5 applies unchanged).

```markdown
---
aimd: "1.0"
mako: "1.0"          # optional; marks MAKO compatibility
type: article
entity: "Panduan AIFeed Markdown"
updated: 2026-09-15
tokens: 420
language: id
canonical: https://example.com/artikel/aimd
summary: "Dokumen native AIFeed."
aifeed:
  policy_version: "0.2"
  usage:
    training: deny
  attribution: required
  assets:
    - url: /laporan.pdf
      type: document
      title: "Laporan lengkap"
---

# Panduan AIFeed Markdown

Isi halaman sebenarnya, dikonversi jujur ke markdown.
```

Rules:

- `aimd: "1.0"` is REQUIRED and identifies the document as AIFeed Markdown.
- `mako: "1.0"` is OPTIONAL; when present the document MAY also be served as
  `text/mako+markdown` with a MAKO-context signature (unchanged bytes).
- Required fields: `type`, `entity`, `updated`, `tokens`, `language` (same vocabulary
  as MAKO). `tokens` accepts up to 1,000,000.
- The `aifeed` policy block is **first-class**: `policy_version` (`"0.2"`), `usage`,
  `attribution`, `limits`, `license`, and `assets` follow v0.2 §6 semantics, including
  restrict-only permission binding.
- Unknown top-level keys MUST be ignored unless they begin with `x_` (extensions) or
  collide with defined fields; the `aifeed` block is strict.
- Body length: AIFeed Markdown does not mandate the MAKO 1,000-token ceiling. Reference tooling
  defaults to 4,000 tokens and publishers MAY choose lower values; converters MUST warn
  when truncating.

### 2.1 Assets

Same as v0.2: `aifeed.assets` lists media and downloadable files as reference links
(image, video, audio, document, archive, file) with optional `mime`, `size`, and
`sha-256`; fetching them follows the same permissions and limits as page content, and
clients MUST verify `size`/`sha-256` against the downloaded bytes when present.

### 2.2 Optional document fields

AIFeed Markdown inherits the MAKO-compatible optional fields so converters can round-trip content
without loss:

| Field | Meaning |
|---|---|
| `canonical` | canonical `https` URL of the page (ASCII/IDNA A-label host; see §3) |
| `summary` | short description (≤300 chars); the index triage summary is capped at 160 |
| `tags` | content tags (≤50) |
| `related` | related page paths (≤100) |
| `links.internal` / `links.external` | semantic links with context |
| `actions` | declared actions (name, description, endpoint, method, params) |
| `audience` | target audience hint |
| `freshness` | `realtime` \| `hourly` \| `daily` \| `weekly` \| `monthly` \| `static` |
| `media` | `cover {url, alt}` plus counts for images/video/audio/interactive/downloads |
| `alternates` | translations of this page: array of `{ url, lang }` (≤20) |

`alternates` is AIFeed Markdown-specific (not part of MAKO): it lets a global site declare the same
content in other languages so agents can fetch the right locale directly instead of
re-discovering it. Publishers SHOULD keep `language` as the document's own locale and
`alternates` limited to published translations.

All fields above are validated strictly: wrong types, out-of-range values, unknown keys
inside objects (for example an extra `price` inside an `alternates` item), duplicate
action names, and oversized arrays are rejected with `aimd_frontmatter_invalid`.

---

## 3. Media Type and Negotiation

- Agents request AIFeed Markdown with `Accept: text/aifeed+markdown`.
- Servers MUST respond with `Content-Type: text/aifeed+markdown; charset=utf-8` when
  serving AIFeed Markdown, and MUST include `Vary: Accept`.
- AIFeed Markdown responses reuse the MAKO header set for interoperability
  (`X-Mako-Version`, `X-Mako-Tokens`, `X-Mako-Type`, `X-Mako-Lang`) and add
  `X-Aifeed-Profile: aimd|mako`.
- Discovery order for dual-stack origins: (1) AIFeed Markdown, (2) MAKO, (3) HTML fallback.
- HTML pages SHOULD advertise both:
  `<link rel="alternate" type="text/aifeed+markdown" href="...">` and
  `<link rel="alternate" type="text/mako+markdown" href="...">`.
- HEAD requests SHOULD return the headers without a body (same rules as MAKO §6.2).

> **International URLs.** Canonical page URLs used in discovery, signatures, and
> `alternates` MUST be absolute `https` URLs with an ASCII host: internationalized
> domain names MUST be encoded as IDNA2008 A-labels (punycode, e.g.
> `xn--tko-7qa.example`). Path components follow normal percent-encoding. This keeps
> signed bytes deterministic across locales and normalizers.

### 3.1 Dual-stack operating modes

Implementations MAY run in one of two modes:

| Mode | Manifest | Shared bytes | Token budget |
|---|---|---|---|
| **AIFeed Markdown-only** | `content.profile: "aifeed-md"` | AIFeed Markdown only | AIFeed Markdown cap (reference default 4,000; schema max 1,000,000) |
| **Dual-stack** | `content.profile: "both"` | One body serves both media types | Shared body SHOULD respect the MAKO recommendation (default 1,000 tokens) |

Dual-stack keeps the "one signed body, two profiles" guarantee, including a single delta
index digest per page. Implementations MAY serve that body from one URL under both media
types (content negotiation) or as per-profile files with identical bytes
(`{path}.aifeed.md` and `{path}.mako.md`, each with its own `.sig` sidecar and matching
signature context); both layouts MUST meet the same conformance requirements. Publishers
that need longer bodies and still want MAKO compatibility SHOULD publish separate
pages/endpoints rather than diverge the shared body; implementations MUST NOT advertise
`both` while serving bodies that exceed the MAKO recommendation.

---

## 4. Signatures

AIFeed Markdown reuses the v0.2 signature container (`schema/mako-signature.v0.2.json`) with new
contexts and separations:

| Document | context | Signed bytes |
|---|---|---|
| AIFeed Markdown page | `aimd` | `UTF-8("aifeed.aimd.v1\n") \|\| url \|\| 0x0A \|\| raw bytes` |
| AIFeed Markdown index | `aimd-index` | `UTF-8("aifeed.aimd-index.v1\n") \|\| url \|\| 0x0A \|\| raw bytes` |

- Delivery precedence is unchanged from v0.2 §7.2; AIFeed Markdown inline headers use the
  `aimd1:<base64url(JCS(container))>` prefix (`mako1:` remains for MAKO).
- Contexts and separations are distinct: a MAKO signature MUST NOT verify as AIFeed Markdown and
  vice versa (cross-format replay protection).
- Sidecars (`{url}.sig`) and declared signature URLs behave as in v0.2.

---

## 5. Permissions, Limits, and Trust

- Effective permissions are computed exactly as v0.2 §6.2 with `restrict-only` as the
  default override mode.
- The manifest `content.index_url` identifies the delta index; index schema, triage
  fields (`title`, `summary`, `tags`, `lang`, `related`), and the `site` resume are
  unchanged from v0.2 §8.
- Trust levels and downgrade behavior apply as v0.2 §9. When
  `content.mako.signature == "required"`, dual-stack origins MUST sign both media
  types; missing AIFeed Markdown signatures lower MAKO consumption the same way.

---

## 6. Conformance Levels

| Level | Requirements |
|---|---|
| `AIMD-C1` | Parses and validates AIFeed Markdown documents (frontmatter + policy block) |
| `AIMD-C2` | Serves/consumes AIFeed Markdown via `text/aifeed+markdown` with the required headers |
| `AIMD-C3` | Verifies `aimd` / `aimd-index` signatures and rejects cross-context replay |
| `AIMD-C4` | Delta index + triage + revocation + offline bundles over AIFeed Markdown |

A conforming dual-stack implementation SHOULD additionally meet `AIMD-C3` for MAKO
documents (v0.2 conformance).

---

## 7. Security Considerations

- The v0.2 YAML-safe subset, size caps, and strict parsing rules apply unchanged.
- Separate separations prevent signature reuse across profiles even for identical bytes.
- Dual markers do not weaken verification: each media type carries the signature
  container of its own context.
- The `aifeed` block is not a license by itself; licensing references follow v0.2.

---

## 8. References

- AIFeed v0.2 (`spec/en/aifeed-v0.2.md`): trust layer, MAKO profile, index, assets,
  triage, security.
- MAKO Specification v0.1.0 (draft): compatibility profile.
- RFC 2119/8174, RFC 8032, RFC 8785, RFC 9530.
- Reference implementation: `aifeed-protocol` (CLI `mako generate --format aimd`,
  `verifyAimdDocument`, `verifyAimdIndex`), WordPress plugin `1.0.0-draft`.

---

## 9. IANA Considerations

This document defines the media type `text/aifeed+markdown` and the conventional file
extension `.aifeed.md`. Registration of the media type with IANA is planned
(RFC 6838, Specification Required). Until registration, servers MUST still emit
`Content-Type: text/aifeed+markdown` on the wire; unrecognized types degrade safely to
HTML fallback per §3. The `aifeed` frontmatter key and `X-Aifeed-*` headers are
experimental and may be registered alongside the `ai-feed` link relation (v0.2 §12).
