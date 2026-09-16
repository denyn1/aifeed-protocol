# AIFeed WordPress Plugin (v1.0.0-draft)

Reference **publisher-side SDK** for AIFeed. It generates an Ed25519 keypair, builds a
schema-conformant manifest from your WordPress site data, signs it (RFC 8785 JCS +
Ed25519), serves it at `/.well-known/ai.json` with the detached signature at
`/.well-known/ai-signature.json`, and **advertises it for discovery**
(`Link: rel="ai-feed"` header, `<link rel="ai-feed">` element, and a `robots.txt`
hint) so AI clients find and follow the declaration on first contact.

Version 0.3 serves the same signed markdown bytes in **two content profiles**:
**AIFeed Markdown** — native AIFeed (`Accept: text/aifeed+markdown`, `aimd: "1.0"`) — and **MAKO**
compatibility (`Accept: text/mako+markdown`). Each media type carries its own signature
context (`aimd1:` / `mako1:`), cross-format replay is rejected, and the delta index is
published at both `/.well-known/aifeed-index.json` and `/.well-known/mako-index.json`
with the appropriate signatures. The manifest declares `content.profile: "both"` and
`content.index_url`.

Operating modes:

- **Dual-stack (default):** shared body capped at the MAKO recommendation
  (`aifeed_mako_max_tokens`, default 1,000); manifest profile `both`.
- **AIFeed Markdown-only:** add `add_filter('aifeed_dual_stack', '__return_false');` — Mako requests
  fall back to HTML, the manifest advertises `aifeed-md`, and the body budget rises to
  `aifeed_aimd_max_tokens` (default 4,000).

Images, video, audio, documents, and archives are listed as links in `aifeed.assets`
(plus a "Media & Unduhan" body section) so agents can decide what to download; the index
carries a **site resume** and **triage fields** per entry, and the plugin also serves
`/llms.txt` for non-AIFeed tooling. If the `mako-wp` plugin is detected, generation is
delegated to it and AIFeed keeps publishing the signed manifest and policy.

## Status

Release candidate. **Verified end-to-end in a real WordPress** (PHP 8.4 + the official
SQLite drop-in, installed headless): plugin activation, key generation (sodium → SPKI
DER), signing with self-verification, HTTP serving of `/.well-known/ai.json` +
signature, Settings API save, admin sign action with nonce checks, missing-nonce
rejection (403), unauthenticated request rejection (400, action not executed), and the
badge shortcode on the front end — **17/17 checks passed**, and the served manifest was
independently verified as **VERIFIED** by the Node SDK (including the `raw_digest`
layer). The MAKO layer was verified in the same environment: manifest v0.2 with
`content.mako`, content negotiation with the required MAKO headers, inline signature
verification against the manifest key (tampered bodies rejected), alternate link in
HTML, and a signed delta index with matching entry digests.

Recommended before public release:

```bash
php -l aifeed.php
php -l includes/class-aifeed-jcs.php   # and the other includes
php tests/jcs-test.php                 # cross-language JCS + Ed25519 fixture check
php tests/mako-test.php                # MAKO converter + signing round-trip
```

and one pass on a MySQL-backed host (only the SQLite drop-in has been exercised here).

## Operation modes

- **Automatic (zero-touch, default):** on activation the plugin generates keys, picks a
  detected profile, signs, serves, advertises, and re-signs automatically when the site
  name/URL changes or plugins are (de)activated, plus a monthly cron. No admin action is
  ever required.
- **Semi-automatic:** the same detection, but site changes are queued and surfaced as a
  "Review & re-sign" notice; nothing changes until you approve.
- **Manual:** full control — granular settings plus an optional custom manifest JSON
  (validity timestamps are refreshed automatically; `identity.public_key` must match the
  site's signing key or signing is rejected).

Profiles: `blog`, `news`, `ecommerce`, `marketplace`, `government`, `open`, `restrictive`.

Multisite: Network Admin → AIFeed bulk-applies profiles and signs every site in one
click (each site gets its own origin manifest).

**Scaling note:** AIFeed uses ONE manifest per origin. A site with thousands or millions
of pages still publishes a single `/.well-known/ai.json`; no per-page work is needed.

## Layout

```
wp-plugin/
├── aifeed.php                          # bootstrap, hooks, cron
├── uninstall.php
├── readme.txt                          # WordPress.org readme
├── assets/admin.css
├── includes/
│   ├── class-aifeed-jcs.php            # RFC 8785 canonicalization (UTF-16 key order)
│   ├── class-aifeed-keys.php           # keygen, SPKI DER, fingerprint, signing
│   ├── class-aifeed-mako-html.php      # HTML to Markdown conversion for MAKO
│   ├── class-aifeed-manifest.php       # manifest builder + essential validation (v0.2)
│   ├── class-aifeed-signer.php         # sign, self-verify, store, optional static write
│   ├── class-aifeed-mako.php           # AIFeed Markdown + MAKO negotiation, signing, delta index
│   ├── class-aifeed-publisher.php      # serves /.well-known/* via template_redirect
│   ├── class-aifeed-badge.php          # [aifeed_badge] shortcode
│   └── class-aifeed-admin.php          # settings screen, actions, DNS instructions
└── tests/
    ├── jcs-test.php                    # differential test vs Node-generated fixtures
    └── mako-test.php                   # MAKO conversion + signing/verification round-trip
```

## Cross-language guarantees

`tests/jcs-test.php` compares PHP canonicalization against fixtures generated by the
Node reference implementation (`tools/jcs-php-fixtures.json`) and
verifies a Node-signed manifest signature with `sodium_crypto_sign_verify_detached`.

`tests/mako-test.php` exercises the AIFeed Markdown and MAKO converters plus the signing
primitives standalone (no WordPress): separations for `aimd`/`aimd-index`/`mako`/
`mako-index` differ, signatures verify over the correct separation, tamper and
cross-URL replay are rejected, and cross-context replay (AIFeed Markdown signature presented as
MAKO) fails.

## Security notes

- Private key: option `aifeed_secret_key` (autoload disabled) or `AIFEED_SECRET_KEY`
  constant. Back up your database.
- Serving path echoes exact stored bytes (byte-level `raw_digest` integrity).
- MAKO responses carry `Vary: Accept`; `X-Mako-*` and `X-Aifeed-*` headers are never
  emitted on `401`/`403` (prevents resource enumeration).
- MAKO documents are derived from published post content only; drafts and private posts
  are never served.
- `/llms.txt` is unsigned discovery text (llms.txt v2). Permissions always come from the
  signed manifest and MAKO signatures; never treat llms.txt as a trust source.
- Post, page, and media content is never written or deleted by the plugin. Uninstall
  removes plugin options, the per-post MAKO cache (`_aifeed_mako_cache`), and the index
  and llms.txt transients — nothing else.
- All admin actions use capability checks and nonces; inputs are sanitized and outputs
  escaped.

## License and open-core policy

MIT. The AIFeed verification path (spec, schemas, verifiers, vectors, publisher tooling)
is permanently open under the project's open core + open standard policy; only secrets,
customer data, and anti-abuse tactics stay private. See
`GOVERNANCE.md` ("Licensing and open-core policy").
