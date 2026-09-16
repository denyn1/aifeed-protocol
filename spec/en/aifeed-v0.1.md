# AIFeed v0.1 — Signed Declarations for AI-Web Content

**Version:** 0.1.0-rc1  
**Status:** Release Candidate — not yet frozen (see "Status of This Document")  
**Canonical language:** English (this document). Translations are informational.  
**License:** CC BY 4.0 (this document) · MIT (reference implementation)

---

## Abstract

AIFeed defines how a web origin declares, in a machine-readable and cryptographically
verifiable way, what automated AI systems may do with its content. The declaration is a
JSON manifest served at `/.well-known/ai.json`, signed with Ed25519, anchored with a DNS
TXT record, and subject to a registry-based revocation mechanism.

AIFeed is a trust layer: it does not replace `robots.txt`, IETF AIPREF vocabularies,
RSL licensing terms, W3C TDMRep, or `llms.txt`. It makes declarations attributable to a
domain and revocable.

---

## Status of This Document

This is a release candidate for reference implementation and interoperability testing.
The specification is **not frozen**; changes are allowed until v0.1.0 final. After
v0.1.0, breaking changes require a minor version bump (v0.2). Key words MUST, MUST NOT,
SHOULD, SHOULD NOT, and MAY are to be interpreted as described in BCP 14 (RFC 2119,
RFC 8174).

---

## 1. Introduction

Search crawlers historically exchanged content for referral traffic. AI systems consume
content and often do not send traffic back. Measured crawl-to-referral ratios (Cloudflare
Radar, 2025) and robots.txt violation volumes (TollBit, H1 2026) show that plain-text
preferences alone are frequently ignored and cannot be attributed to a domain with
confidence.

AIFeed addresses four gaps:

1. **Attribution.** A signed manifest proves that a declaration came from the holder of
   the domain's key, not from a network intermediary or a compromised path.
2. **Anchoring.** A DNS TXT record binds the signing key to the domain itself.
3. **Revocation.** A registry publishes signed revocation documents with due process.
4. **Offline verification.** Signature and schema checks require no network round trip.

---

## 2. Conventions and Terminology

- **Manifest** — the JSON document served at `/.well-known/ai.json`.
- **Signature container** — the JSON document served at `identity.signature_url`.
- **Origin** — scheme + host (this version: `https` and the default port only).
- **Publisher** — the party controlling the origin and its signing key.
- **Client** — an automated AI system verifying and consuming manifests.
- **dns_anchored** — verification flag: the manifest public key matches the DNS record.
- **Level** — one of `VERIFIED`, `UNVERIFIED`, `SUSPENDED`.

Normative behavior for clients processing untrusted input:

- Duplicate JSON object keys MUST be rejected.
- All strings MUST be NFC-normalized UTF-8; non-NFC input MUST be rejected.
- Floating-point numbers MUST be rejected anywhere in the manifest.
- Integers MUST satisfy `|n| <= 2^53 - 1`; larger values MUST be encoded as strings.
- Numbers in exponent notation MUST resolve within the same bound; out-of-range values
  MUST be rejected regardless of notation.
- Negative zero (`-0`) MUST be normalized to `0` by parsers and serializers.
- JSON nesting depth MUST NOT exceed 10.
- Field names not defined by this specification MUST be rejected unless they begin
  with `x_`; fields beginning with `x_` MUST be ignored.

---

## 3. Discovery and File Layout

```
/.well-known/ai.json            Manifest (signed)
/.well-known/ai-signature.json  Default location of the signature container
/.well-known/ai.txt             Human-readable notes (NON-NORMATIVE, MUST NOT be parsed)
/llms.txt                       Content summary for LLMs (see llms.txt v2)
```

### 3.1 Advertisement and Discovery

Origins SHOULD advertise the manifest location on every response so AIFeed-aware
clients can discover it on first contact:

- HTTP: `Link: </.well-known/ai.json>; rel="ai-feed"; type="application/json"`
- HTML: `<link rel="ai-feed" href="/.well-known/ai.json" type="application/json">`
- `robots.txt`: a comment line `# AIFeed: <absolute manifest URL>` (ignored by
  non-AI-aware parsers, visible to AIFeed-aware ones)
- `llms.txt` (v2): a link entry pointing at the manifest

Discovery order for AIFeed-aware clients (normative): (1) `Link` header with
`rel="ai-feed"`; (2) HTML `<link rel="ai-feed">`; (3) `robots.txt` hint; (4) fallback
`/.well-known/ai.json`. Clients MUST verify (§7) and cache (max 1 h) before acting on
any declaration.

Manifests are **per-origin**. `www.example` and `example` are distinct origins; an
origin that wants both covered MUST serve the manifest on both.

Servers SHOULD return `Content-Type: application/json`, UTF-8, and
`Cache-Control: public, max-age=3600, must-revalidate`, and SHOULD support `ETag` with
conditional requests (`If-None-Match` → `304`). Size limits apply to the decompressed
body: manifest ≤ 100 KB, signature container ≤ 2 KB, `ai.txt` ≤ 50 KB.

---

## 4. Manifest (`ai.json`)

The manifest is a JSON object. The JSON Schema is published at
`https://aifeed.md/schema/ai-json/v0.1.json` and is normative for field shapes.

### 4.1 Required top-level fields

`version`, `identity`, `validity`, `content`, `permissions`, `revocation`, `metadata`.

### 4.2 `identity`

| Field | Required | Notes |
|---|---|---|
| `domain` | yes | Host only, lowercase, A-label (IDNA2008) form; MUST equal the serving host |
| `name` | yes | Display name (≤ 256 chars) |
| `organization` | no | Legal entity |
| `type` | yes | One of `ecommerce, news, education, government, saas, portfolio, community, docs, nonprofit, personal, other` |
| `locale` | yes | BCP 47 (e.g. `id-ID`) |
| `contact` | yes | `mailto:` or `https://` URI |
| `public_key` | yes | `ed25519:` + base64 SPKI DER (44 bytes → 60 base64 chars, one `=`) |
| `key_id` | yes | Human label; revocation uses the fingerprint, not this value |
| `signature_url` | yes | Path (default `/.well-known/ai-signature.json`) |

### 4.3 `validity`

`signed_at` and `expires_at` are RFC 3339 UTC timestamps (`Z`, second precision).
`signed_at` MUST NOT be more than 300 seconds in the future; `expires_at` MUST be after
`signed_at` and MUST be in the future at verification time. Both fields are inside the
signed payload.

### 4.4 `content`

`languages` (BCP 47 array) is REQUIRED. Optional: `llms_txt` and `sitemap` (paths),
`markdown` (`template` containing `{path}`, `link_relation` boolean), and `license`
(`name`, optional `url` and `rsl_url`).

### 4.5 `permissions`

`default` (`allow` | `deny`) is REQUIRED; usage keys not present inherit it. `usage`
keys: `search, retrieval, input, training, quote, summarize, reproduce, translate,
modify, embed, commercial_use` with values `allow` | `deny`. `attribution` is
`required` | `optional` | `none`; optional `attribution_url` and `attribution_text`.

Vocabulary mapping (informational, version-pinned):

| AIFeed | IETF AIPREF (draft-ietf-aipref-vocab) | Cloudflare Content Signals |
|---|---|---|
| `search` | `search` | `search` |
| `retrieval` | `ai-use` | `ai-input` |
| `input` | `ai-use` (pending "directly provided" definition) | — |
| `training` | `train-ai` | `ai-train` |

### 4.6 `limits` (optional)

`requests_per_minute`, `concurrent`, `crawl_delay_seconds` (all integers).

### 4.7 `types`, `capabilities`, `actions`

`types` defines named return types (subset of JSON Schema). `capabilities` are
read-only operations; `actions` are side-effecting operations and add `requires_auth`,
optional `auth`, optional `payment_terms_url`, `human_confirmation_required`
(REQUIRED on actions), optional `requires_idempotency_key`, and optional
`spending_limit` (an object with integer `amount` and ISO 4217 `currency`). Parameter
types are limited to `string`, `integer`, `boolean`; `in` is `query`, `path`, or `body`.

### 4.8 `revocation`

`list_url` MUST be `https://aifeed.md/revoke/v1/{domain}.json`.
`maximum_check_interval_hours` (integer) may only shorten client intervals; clients
MUST ignore values above 168 hours.

### 4.9 `metadata`

`generated_at` (RFC 3339) REQUIRED; optional `generated_by`.

---

## 5. Signature (`ai-signature.json`)

The detached signature container is a JSON object with three required fields:

```json
{
  "algorithm": "ed25519",
  "canonicalization": "jcs-rfc8785",
  "signature": "base64url:<86 chars>"
}
```

- **Algorithm:** Ed25519 pure (RFC 8032 §5.1). Ed25519ph and Ed25519ctx are NOT used.
- **Canonicalization:** JSON Canonicalization Scheme (RFC 8785) over the parsed manifest.
- **Signed bytes:** `UTF-8("aifeed.v0.1\n") || JCS(manifest)` (domain separation).
- **Signature encoding:** base64url of the 64-byte signature, 86 characters, no padding.
- **Key fingerprint:** `sha256:` + base64url(SHA-256(SPKI DER)) — 43 characters.

Clients MUST ignore fields in the signature container other than the fields above, with one exception: `raw_digest` (defined below) is meaningful when present.

### 5.1 `raw_digest` (optional)

`raw_digest` provides byte-level integrity for locally stored or cached manifests:

```json
{
  "sha-256": "<standard base64 of SHA-256 over the raw bytes of ai.json>",
  "applies_to": "raw-bytes"
}
```

- Computed over the **raw bytes** of `ai.json` exactly as served (after transfer
  decoding); AIFeed servers SHOULD honor `Accept-Encoding: identity`. It is not
  computed over the canonical (JCS) form.
- It detects corruption, bit rot, or byte-level reformatting of stored files. It is
  **not** an authenticity mechanism and MUST NOT be treated as a substitute for the
  Ed25519 signature: a party able to modify files can modify a stored digest too.
- Located in the signature container (never inside `ai.json`) to avoid circularity.
- Clients verifying stored or offline bytes MUST verify `raw_digest` when present; a
  mismatch yields `raw_digest_mismatch`. Verification of `raw_digest` and of the
  Ed25519 signature are independent: a reformatted-but-semantically-identical file can
  fail `raw_digest` while still passing signature verification.

Signers MUST validate the manifest, verify that `identity.public_key` matches the
signing key, and verify their own signature before publishing.

---

## 6. DNS Anchor

```
_aifeed.example. 3600 IN TXT "v=aifeed1; pk=ed25519:<key>; fp=sha256:<fingerprint>; manifest=https://example/.well-known/ai.json"
```

Rules: concatenate all strings of a single TXT record; `pk` MUST match
`identity.public_key`; if `fp` is present it MUST match the fingerprint; multiple
records with different `pk` values → UNVERIFIED; absence of the record → VERIFIED with
`dns_anchored=false`; `pk2` is reserved for rotation. Within a single record,
duplicate keys (e.g. two `pk` fields) MUST be rejected (`txt_duplicate_key`) and the
record treated as unusable — never silently last-wins.

---

## 7. Verification Procedure (normative)

```
INPUT : host (normalized: lowercase, A-label, no trailing dot, no port, no userinfo;
each label 1–63 chars, no leading/trailing hyphen, total ≤253 chars)
OUTPUT: { level, dns_anchored, dnssec_validated, warnings[] }

1.  Fetch https://{host}/.well-known/ai.json
    (HTTPS only, no redirects, 10 s timeout, ≤100 KB as received, application/json,
    Accept-Encoding: identity). If a Content-Digest field is present, verify it over
    the bytes as received (RFC 9530) before parsing; mismatch → UNVERIFIED
    (content_digest_mismatch); absence → warning content_digest_absent.
2.  404/error → UNVERIFIED(reason=no_manifest)
3.  Strict parse (duplicate keys, NFC, integers, depth) → else UNVERIFIED(parse code)
4.  JSON Schema validation → else UNVERIFIED(schema_violation)
5.  version ∈ {0.1, 0.1.x} → else UNVERIFIED(upgrade_required)
6.  identity.domain == host → else UNVERIFIED(domain_mismatch)
7.  validity checks (signed_at, expires_at) → else UNVERIFIED(validity code)
8.  Fetch signature_url (≤2 KB) → 404 → UNVERIFIED(no_signature)
9.  msg = "aifeed.v0.1\n" || JCS(manifest)
10. Ed25519 verify → else UNVERIFIED(bad_signature)
11. Resolve _aifeed TXT: match → dns_anchored=true; mismatch → UNVERIFIED(dns_mismatch);
    absent → dns_anchored=false (warning)
12. Fetch revocation (canonical URL, cache ≤1 h):
      suspended → SUSPENDED · under_review → UNVERIFIED · active → continue
13. Registry unreachable: ≤24 h → VERIFIED (+warning);
    24–168 h → VERIFIED (warning revocation_stale);
    >168 h → UNVERIFIED(revocation_unavailable)
14. Matching key fingerprint in revocation.keys[] → UNVERIFIED(key_revoked)
15. Return level + flags + warnings
```

Client hardening requirements: only port 443 (`port_not_allowed` otherwise; test
fixtures with `allowPrivate` are exempt); reject userinfo in URLs
(`credentials_not_allowed`); reject IP literals; resolve then block private,
loopback, link-local, ULA, CGNAT-shared, multicast, and metadata addresses; pin the
resolved address through connection setup and abort on change
(`dns_rebinding_detected`); no redirects; verify `Content-Type`; require
`Accept-Encoding: identity`; stream with size caps; SNI MUST equal the host.

---

## 8. Trust Levels

| Level | Conditions | Client behavior |
|---|---|---|
| VERIFIED | Schema + signature + domain + validity pass; revocation active | Honor declared permissions |
| UNVERIFIED | Any check fails, or status under_review | Treat as advisory; high-risk uses (`training`, `reproduce`, `modify`, `commercial_use`) MUST be denied |
| SUSPENDED | Revocation status suspended | Do not fetch; purge cached content within 24 h; warn users |

Flags: `dns_anchored` (boolean), `dnssec_validated` (boolean), warnings array.

The AIFeed trust chain consists of four mutually reinforcing layers: TLS (transport
identity), domain match (reference integrity), Ed25519 signature (content integrity),
and DNS anchor (key ownership). No layer suffices alone. Conforming clients MUST NOT
perform high-risk actions (`training`, `reproduce`, `modify`, `commercial_use`,
`purchase`/`actions`) without `level=VERIFIED` and `dns_anchored=true`; without the
anchor, only `search`, `retrieval`, and `input` are permitted, with conservative rate
limits and attribution.

---

## 9. Revocation

`GET https://aifeed.md/revoke/v1/{domain}.json` — signed, multi-signature document:

- **Signed bytes:** `"aifeed-revoke.v0.1\n" || JCS(document without the signatures array)`.
- **Signatures:** array of Ed25519 signatures; threshold 2-of-3 (interim) → 3-of-5 (foundation).
- **Status:** `active` | `under_review` | `suspended` (any other value →
  `revocation_status_invalid`); reason codes: `repeated_spam`,
  `malware_distribution`, `identity_fraud`, `terms_violation`, `user_reports`.
- **Expiry:** `expires_at` is REQUIRED (`revocation_expires_invalid` if missing or
  unparsable); lifetimes over 30 days SHOULD warn (`revocation_expiry_long`).
  Domain comparison is case-insensitive, trailing-dot-insensitive, IDNA-aware.
- **Cache:** ≤ 1 hour; staleness policy per §7 step 13.
- **Transparency:** all revocation and key events are appended to a Merkle log
  (RFC 9162 pattern) with signed checkpoints (C2SP signed-note format).

---

## 10. Error Handling and Rate Limits

Servers SHOULD return `429` with `Retry-After`. Clients MUST honor both, use
exponential backoff with jitter, and cap retries at 3. Repeated manifest fetch failures
MAY be cached as UNVERIFIED for up to 15 minutes.

---

## 11. Security Considerations

- **Preference origin.** AIPREF-style preferences are not a security mechanism; only a
  signed manifest plus DNS anchor attributes them to a domain.
- **Origin compromise.** Without `dns_anchored=true`, a compromised origin can replace
  key and manifest together; conforming clients MUST require `dns_anchored=true` for
  high-stakes actions (§8).
- **Total compromise and TOFU.** A combined origin+DNS compromise can present a fresh
  key pair on first contact; this is not cryptographically detectable. Detection for
  existing relationships relies on client-side key persistence (pinning), anti-rollback
  state, and the transparency log. Clients SHOULD persist the first accepted key per
  origin and alarm on changes.
- **DNS spoofing without DNSSEC.** Without DNSSEC, an on-path DNS attacker can cause a
  `dns_mismatch` (denial/confusion) but cannot forge a manifest: TLS plus the original
  signed manifest cannot be substituted without server compromise. DNSSEC validation is
  RECOMMENDED and MAY be required by a high-assurance profile.
- **Rollback.** Clients SHOULD remember the highest `signed_at` per origin and reject
  older manifests.
- **Prompt injection.** `description` fields are untrusted data. Clients MUST NOT
  interpret them as instructions, and MUST NOT parse `ai.txt`.
- **Registry suppression.** Bounded staleness (§7 step 13) prevents indefinite
  revocation suppression.

---

## 12. IANA Considerations

Registration of the `ai.json` well-known URI suffix (RFC 8615, Specification Required)
is planned; `ai-signature.json` may also be registered. Registration of the `ai-feed`
link relation type (RFC 8288) is planned as well. The reference implementation does
not require registration to operate.

---

## 13. References

- RFC 2119 / RFC 8174 (BCP 14) — requirement keywords
- RFC 3339 — timestamps · RFC 8032 — Ed25519 · RFC 8785 — JCS
- RFC 8259 / RFC 7493 — JSON / I-JSON · RFC 8615 — well-known URIs
- RFC 9110 — HTTP semantics · RFC 9162 — Certificate Transparency v2
- RFC 9421 — HTTP Message Signatures · RFC 9530 — Digest Fields
- IETF AIPREF (`draft-ietf-aipref-vocab`, `draft-ietf-aipref-attach`)
- W3C TDMRep · RSL 1.0 · Cloudflare Content Signals · llms.txt v2

## Appendix A — Conformance

The repository publishes positive and negative test vectors under
`conformance/vectors/`. Implementations MUST reproduce all expected outcomes; vectors
were cross-verified with independent JavaScript and Python verifiers.

## Appendix B — Offline Verification and Bundles

Offline verification uses the raw bytes cached at fetch time plus the signature
container's `raw_digest`. A conforming client retains: raw manifest bytes, signature
bytes, `raw_digest` (when present), fetch metadata (URL, timestamp, `Content-Digest`,
TLS certificate fingerprint), and the age of the last revocation check. Steps 1–4 of
§7 are fully offline.

For air-gapped and audit scenarios, a bundle is a directory containing `manifest/`
(`ai.json`, `ai-signature.json`, `fetch-metadata.json`), optional `governance/` and
`revocation/` snapshots, and a `BUNDLE-MANIFEST.json` listing SHA-256 and size of every
file plus an optional Ed25519 bundler signature over `"aifeed-bundle.v0.1\n" || JCS` of
the manifest without the `bundler` field. A bundle older than 168 hours reduces trust
(UNVERIFIED `bundle_stale`); bundles never replace online revocation freshness.
Verifiers MUST reject bundle entries with absolute paths, `..` segments, or paths
resolving outside the bundle directory (`bundle_manifest_invalid`) — a malicious
bundle must never cause reads outside its root.

## Appendix C — Attack Scenarios

| # | Scenario | Layer that catches it | Outcome |
|---|---|---|---|
| 1 | Valid manifest hosted on a different domain | Domain match | UNVERIFIED |
| 2 | Content edited after signing | Ed25519 signature | UNVERIFIED |
| 3 | Key replaced and re-signed by attacker | DNS cross-check (`dns_mismatch`) | UNVERIFIED |
| 4 | Origin compromised, new key pair | DNS cross-check (`dns_mismatch`) | UNVERIFIED |
| 5 | DNS compromised, TXT key replaced | DNS/manifest cross-check; manifest signature still valid | UNVERIFIED |
| 6 | Origin **and** DNS compromised (fresh key pair) | Nothing on first contact (TOFU); detected via key pinning/anti-rollback + transparency log for existing relationships | VERIFIED (new peers) / detected (existing peers) |
| 7 | Network MITM modifies body | TLS (+ signature) | UNVERIFIED |
| 8 | CDN serves stale copy | Anti-rollback `signed_at` (client state) | UNVERIFIED |
| 9 | Replay of an older valid file | Anti-rollback `signed_at` | UNVERIFIED |
| 10 | Fake manifest on attacker-controlled domain | TLS + domain match | UNVERIFIED |
| 11 | Transport corruption (bit flip) | `Content-Digest` (RFC 9530) | UNVERIFIED |
| 12 | Local file corruption/reformatting | `raw_digest` | UNVERIFIED |

Full forgery requires a combined origin+DNS compromise; for existing relationships this
is detectable through key pinning and the transparency log. DNSSEC closes on-path DNS
spoofing; without it, DNS spoofing alone yields `dns_mismatch`, not forgery.
