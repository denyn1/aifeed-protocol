=== AIFeed ===
Contributors: aifeed
Tags: ai, ai.txt, llms.txt, permissions, ed25519, robots
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.2
Stable tag: 1.0.0-draft
License: MIT
License URI: https://opensource.org/licenses/MIT

Publish a signed, verifiable declaration of how AI systems may use your content — no API keys, no scraping guesswork.

== Description ==

AIFeed lets your site declare, in a machine-readable and cryptographically verifiable
way, what AI systems may do with its content. The plugin publishes a manifest at
/.well-known/ai.json, signs it with Ed25519, and serves the detached signature at
/.well-known/ai-signature.json.

Key features:

* One-click Ed25519 key generation (PHP sodium extension).
* Granular permissions: search, retrieval, input, training, quote, summarize,
  reproduce, translate, modify, embed, commercial_use.
* Rate-limit hints (requests per minute, concurrency, crawl delay).
* Automatic monthly re-signing so the declaration never expires.
* Optional DNS anchor instructions for strong verification.
* Optional writing of physical files into the WordPress root.
* "AIFeed Verified" badge shortcode.
* **MAKO (v0.2):** per-page markdown for AI agents via content negotiation
  (`Accept: text/mako+markdown`), signed MAKO documents (Ed25519), permission block in
  the frontmatter, asset links (images, video, audio, documents, archives) in
  `aifeed.assets` plus a "Media & Unduhan" section, and a signed delta index at
  /.well-known/mako-index.json.

The declaration follows the open AIFeed specification (v0.2, manifest version 0.2) and
interoperates with robots.txt, Cloudflare Content Signals, IETF AIPREF vocabulary, RSL,
TDMRep, llms.txt, and MAKO.

== Installation ==

1. Upload the plugin folder to /wp-content/plugins/ and activate it.
2. Go to Settings > AIFeed, review the declaration settings, and save.
3. Click "Generate signing keys", then "Sign and publish now".
4. Optional but recommended: add the shown DNS TXT record `_aifeed.yourdomain` at your
   DNS provider.

== Frequently Asked Questions ==

= Why does the key live in the database? =

The signing key is stored in the WordPress options table (autoload disabled). Keep
regular database backups. Advanced setups can define AIFEED_SECRET_KEY in wp-config.php
instead.

= What happens without the DNS record? =

Verification still works (signature checks pass), but high-risk AI actions require a
DNS-anchored declaration. Adding the TXT record raises the trust level.

= Does this change my robots.txt? =

No. AIFeed is complementary to robots.txt and other signals.

== Screenshots ==

1. Settings > AIFeed — site profile, permissions (training/retrieval/quote), and crawl limits.
2. Signed manifest preview with DNS anchor instructions for `_aifeed`.
3. Discovery status: manifest, content negotiation (AIFeed Markdown/MAKO), and the AIFeed Verified badge.

== Privacy ==

This plugin does **not** collect, store, or transmit any personal data, and it does not
contact external services.

Data it stores locally:

* Signing keys, plugin settings, and the signed manifest in the WordPress options table.
* Derived content caches (rendered AIFeed Markdown/MAKO text and signatures, index and llms.txt
  transients) in post meta and transients.

Uninstalling the plugin deletes all of the above. Post, page, and media content is never
modified or removed. See `pilot/instrumentation.md` in the protocol repository for
guidance if you run the optional 30-day measurement pilot (aggregated, anonymized logs,
30-day retention).

== Upgrade Notice ==

= 1.0.0-draft =
Adds native AIFeed Markdown serving (text/aifeed+markdown) alongside MAKO, per-format signatures,
and the AIFeed Markdown delta index. Existing MAKO setups keep working; the first request after
upgrade re-signs and re-caches content automatically.

== Changelog ==

= 1.0.0-draft =
* Dual-stack serving: native AIFeed Markdown (`Accept: text/aifeed+markdown`) plus MAKO compatibility (`Accept: text/mako+markdown`) from the same signed bytes, each with its own signature context.
* Manifest declares `content.profile: "both"` and `content.index_url` (AIFeed Markdown index at /.well-known/aifeed-index.json).
* AIFeed Markdown and MAKO delta indices signed at both paths; HTML advertises both alternate links.

= 0.2.0-draft =
* Manifest version 0.2 with `content.mako` (index, signature policy, restrict-only overrides).
* MAKO content negotiation: per-page markdown with the required X-Mako-* headers and Vary: Accept.
* Ed25519-signed MAKO documents delivered inline (`X-Aifeed-Signature: mako1:...`).
* Signed delta index at /.well-known/mako-index.json (+ .sig) with per-entry SHA-256 digests.
* Site resume (`site`) and per-entry triage fields (title, summary, tags, language,
  related) so AI agents can rank pages before fetching.
* Serves /llms.txt (llms.txt v2 format) for non-AIFeed tooling.
* HTML alternate link for MAKO discovery.
* Coexistence: generation is delegated when the mako-wp plugin is detected.
* Uninstall also removes derived MAKO caches; post/page/media content is never touched.

= 0.1.0-rc1 =
* Initial release candidate: key management, manifest builder, JCS canonicalization,
  Ed25519 signing, virtual + static publishing, admin screen, badge, monthly re-sign.
