# AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the AI Web

<p><a href="main.md">English</a> · <a href="main.id.md">Bahasa Indonesia</a> · <a href="main.zh.md">中文</a></p>

*Draft — collective author: AIFeed Protocol Contributors.*
*LaTeX source: [`main.tex`](main.tex) · bibliography: [`refs.bib`](refs.bib) ·
claims ledger: [`CLAIMS.md`](CLAIMS.md) · submission checklist: [`CHECKLIST.md`](CHECKLIST.md)*

## Abstract

AI systems now consume more web content than people do, and the plain-text preferences in
`robots.txt` do not hold them back: one vendor logged 1.9 billion crawls that ignored
robots rules in a single half-year, and one web-only measurement put the crawl-to-referral
ratio of a major AI provider at 70,900:1. Preference and licensing signals exist, but they
are not attributable to a domain, cannot be revoked, and do nothing about the cost of
repeated consumption. We describe AIFeed, an open trust layer built around a signed
manifest of machine-readable permissions, anchored in DNS and checked against a
multi-signature revocation registry. Two content profiles ride on the same signed bytes: a
native markdown format (AIFeed Markdown) and a compatibility profile for the external MAKO
draft. Three properties, taken together, distinguish the design from the signals we
surveyed: signed provenance of permissions, per-page binding with restrict-only overrides,
and a digest-bearing delta index that lets an agent skip pages that have not changed.

We measure the system on committed artifacts. Converting a 60-page corpus to the markdown
profiles cuts transferred bytes by 68.8% (95.7% for delta consumption), and a loopback
enforcement harness with four client profiles records publisher savings of 55.2% of bytes
and 56.2% of CPU, AI-side savings of 54.8% (72.9% for the compliant client), 14 of 18
unchanged pages skipped, and signature verification at 0.70 ms per page. The specification
is exercised by 34 manifest, 39 MAKO, and 11 AIFeed Markdown vectors under independent
JavaScript and Python verifiers, plus differential PHP fixtures and an end-to-end
WordPress deployment. We also report results that do not flatter the design: without
adoption and enforcement there are no savings at all; vendor claims of up to 94% token
reduction rely on summarization our converter does not perform; origin-plus-DNS compromise
is invisible on first contact; and the compatibility profile depends on a third-party
draft. No external cryptographic review or live pilot exists yet.

## 1. Introduction

Web content is increasingly consumed by automated agents rather than human visitors.
Cloudflare's radar puts AI bots at an average of 4.2% of HTML requests in 2025 (6.4% at
peak), with automated traffic approaching half of all HTML requests and "user action"
agent crawls growing more than 15-fold over the same period [cfRadar2025]. The
publisher-facing asymmetry is worse than those aggregates suggest: one web-only
measurement found a crawl-to-referral ratio of 70,900:1 for a major AI provider
[cfCrawlRefer], and a single vendor recorded 22 billion AI scrapes in a half-year, 1.9
billion of which ignored `robots.txt` [tollbit].

The ecosystem is not empty. RFC 9309 and the IETF AIPREF drafts cover robotic preferences;
Cloudflare's Content Signals, RSL, and the W3C TDM Reservation Protocol each express some
flavor of permission or license [rfc9309, draftAiprefVocab, draftAiprefAttach,
cfContentSignals, rsl, tdmrep]; `llms.txt` indexes a site for language models [llmstxt];
and on the other side of the exchange, Web Bot Auth is putting signed agent requests into
production [draftWebbotauth, cfBotPrinciples]. What is missing is twofold. A publisher's
declaration is not attributable: any intermediary can alter it, and nothing standard lets
the publisher revoke it. And even a declaration that is respected leaves the mechanical
cost untouched, because agents keep pulling unchanged pages as browser-shaped HTML.

**Contributions.** (1) Design of AIFeed v0.1: Ed25519-signed, JCS-canonicalized manifest
at `/.well-known/ai.json`, DNS-anchored, offline-verifiable, with multi-signature
revocation and bounded staleness. (2) Content profiles: AIFeed Markdown v1.0 (native) and MAKO
compatibility over the same signed bytes, restrict-only per-page overrides, and a
digest-bearing delta index with site resume and triage fields. (3) A zero-dependency
reference stack: CLI, JavaScript SDK, independent Python verifier, WordPress plugin,
static-site builder, and eight server adapters. (4) Reproducible evaluation with
committed artifacts, conformance vectors, fuzzing, and differential cross-language
tests; unfavorable results are reported alongside.

## 2. Background and Related Work

- **Preference and permission signals.** Robots preferences were standardized in RFC 9309
  [rfc9309], and the IETF AIPREF working group is now assembling a vocabulary for AI usage
  preferences with an attachment mechanism for HTTP responses [draftAiprefVocab,
  draftAiprefAttach]. Industry has moved faster: Cloudflare's Content Signals Policy
  reports adoption on more than 3.8M domains through managed robots files
  [cfContentSignals], with pay-per-crawl billing at the same edge [cfPayPerCrawl]; RSL
  adds licensing and compensation terms [rsl]; W3C TDMRep handles
  text-and-data-mining reservations [tdmrep]; `llms.txt` gives language models a site-level
  index [llmstxt]. What none of these provides is attribution of the declaration to the
  domain, a revocation path, or verification independent of the transport channel.
- **Agent-side authentication.** Web Bot Auth [draftWebbotauth, draftWebbotArch] builds on
  RFC 9421 and Ed25519 [rfc9421, rfc8032], with production deployments [cfBotPrinciples].
  AIFeed applies the same primitives in the opposite direction (publisher signs).
- **Content formats for agents.** MAKO defines per-page markdown and explicitly leaves
  authenticity verification out of scope [makoSpec]. Several projects from 2026 occupy
  adjacent ground: `ai-policy.json` gathers permission declarations at a well-known URL,
  without signatures, anchoring, or revocation [aipolicyjson]; `agents.txt` puts identity,
  terms, and endpoints in a root file [agentstxt]; CrawlWall enforces crawler policy at
  the edge with a signed audit ledger and receipts [crawlwall]; `terms.txt` goes furthest,
  specifying per-path, per-purpose terms with a signed exchange, delegation tokens, and
  payment negotiation [chowdhury2026]; on the academic side, `ai.txt` proposes a DSL for
  guiding AI interactions [li2025aitxt]. As of our inspection (2026-09-15), we did not
  find a single project that combines publisher-signed permissions with a DNS anchor and
  revocation, dual content profiles over one signed payload, and a verifiable delta index
  — our claim is to that combination, not to having invented any of its parts.
- **Measurement and economics.** A substantial empirical literature studies robots at
  scale: classifier-based analysis of robots usage [lee2009], exclusion as a guidance
  protocol [ge2016], robots-based gatekeeping [steinacker2025], creator protection
  efficacy (IMC 2025) [liu2025], small-organization protection [hoetzlein2026], agent
  compliance with in-band signals [munirathinam2026], pay-per-crawl pricing [archer2026].
  Industry reports supply the traffic asymmetry [cfRadar2025, tollbit, cfCrawlRefer,
  cfContentIndependence], and a research center documents how AI summaries affect users
  [pew2025]. Regulatory context: EU AI Act and the 2026 TDM opt-out registry feasibility
  study [euAiact, euTdmRegistry]; Indonesian PDP law as a national example [uuPdp27].
  Legal remarks are open questions, not legal advice.

## 3. Design

**Trust chain.** TLS → domain match → Ed25519 signature over JCS canonical form with
domain separation (`aifeed.v0.2\n`) → DNS TXT anchor (`_aifeed`). Well-known URI
[rfc8615]; strict JSON/I-JSON [rfc8259, rfc7493]; RFC 3339 timestamps [rfc3339]; JCS
[rfc8785]; BCP 14 keywords [rfc2119, rfc8174]; transparency log pattern [rfc9162]. Key
pinning detects replacement; first-contact origin+DNS compromise is not detectable.

**Permissions and revocability.** Per-usage permissions (search, retrieval, input,
training, quote, summarize, reproduce, translate, modify, embed, commercial use),
attribution, and crawl limits. Revocation registry with multi-signature documents,
due-process statuses (`active`, `under_review`, `suspended`), bounded staleness (168 h).
Trust levels `VERIFIED` / `UNVERIFIED` / `SUSPENDED`.

**Content profiles.** AIFeed Markdown v1.0 (`text/aifeed+markdown`, `.aifeed.md`, marker
`aimd: "1.0"`, media-type procedures [rfc6838, rfc7763]) and MAKO 1.0
(`text/mako+markdown`) [makoSpec]. Dual-stack servers deliver identical bytes under both
media types with distinct signature contexts (`aimd` / `mako`), preventing cross-format
replay. Per-page `aifeed` block is restrict-only by default; asset links let agents
choose what to fetch; the frontmatter parser accepts only a safe YAML subset.

**Delta consumption.** `/.well-known/aifeed-index.json` (+ `.sig`, context
`aimd-index`) with per-page `sha-256`, ETag, tokens, site resume, and triage fields
(title, summary, tags, language, related). Clients diff digests and fetch only changed
pages; unchanged pages cost zero bytes (conditional requests [rfc9110, rfc7231], digest
fields [rfc9530], linking [rfc8288]). Index entries are untrusted claims until verified.

## 4. Threat Model

Covered by conformance: foreign-domain manifests, post-signature edits, key replacement,
origin/DNS compromise, network modification, stale CDNs, replays, transport corruption,
local reformatting, tampered documents, digest mismatch, cross-URL and cross-context
replay, stripped signatures when policy requires them, fail-open overrides, and YAML
parser abuses. Explicitly not claimed: first-contact origin+DNS compromise; fidelity of
the markdown derivative to HTML rendering. Enforcement is required for effect: 1.9B
bypass events show unenforced preferences are advisory [tollbit]. Key replacement is
handled by a rotation ceremony (v0.2 §14): an old-key-signed successor directive plus an
advisory DNS `pk2` cross-check, a bounded overlap window, then permanent revocation
after cutover. This bounds, but does not eliminate, the acceptance window of a
compromised key; it does not defend against an attacker who already controls origin
content and DNS.

## 5. Implementation

Zero-dependency reference stack [aifeedRepo]: strict parser + safe YAML subset; JCS +
Ed25519; CLI (`keygen`, `sign`, `validate`, `bundle`,
`aimd|mako generate|sign|verify|index|fetch`, `site build`); npm SDK `@aifeed/verify`;
independent Python verifier; WordPress plugin (dual-stack serving, signed indices,
assets, triage, `llms.txt`); static-site builder; eight server adapters. Specifications:
AIFeed v0.1 [aifeedSpec01], v0.2 [aifeedSpec02], AIFeed Markdown v1.0 [aimdSpec]. Conformance:
34 manifest + 39 MAKO + 11 AIFeed Markdown vectors in JavaScript and Python; differential PHP
fixtures; WordPress end-to-end test.

## 6. Evaluation

All numbers reproduce from committed artifacts (`benchmarks/*.json`,
`npm run bench:mako`, `npm run bench:enforcement`); fixed seeds; single machine; loopback
networking; synthetic corpus with navigation, ads, comments, and scripts.

**Content efficiency (60 pages).** Bytes 1,205,292 → 375,630 including signatures:
**−68.83%**; token estimate −68.8%; sign 0.25 ms/page; verify 0.34–0.70 ms/page. Delta
with 10% changed pages: 51,408 bytes, **−95.73%** vs HTML crawl (unchanged assumed 304).
MAKO's up-to-94% claim presumes publisher summarization; our faithful converter measures
68.8% and we report the smaller value.

**Enforcement harness (18-page site, four client profiles).**

| Metric | S0 | S1 | S2 | S3 |
|---|---:|---:|---:|---:|
| Origin requests | 63 | 45 | 42 | 30 |
| Origin bytes | 177,537 | 104,084 | 95,580 | 79,555 |
| Origin CPU (ms) | 46.6 | 31.1 | 28.6 | 20.4 |
| Peak concurrency | 17 | 4 | 2 | 2 |
| 403 blocks / 429 limits | 0 / 0 | 18 / 0 | 18 / 11 | 18 / 11 |
| Client bytes received | 177,537 | 104,570 | 96,198 | 80,173 |
| Human p95 latency (ms) | 20.0 | 23.2 | 19.9 | 19.3 |
| Publisher byte saving | — | 41.4% | 46.2% | **55.2%** |
| Publisher CPU saving | — | 33.4% | 38.8% | **56.2%** |
| AI byte saving (all / compliant) | — | 41.1% / 42.5% | 45.8% / 42.5% | **54.8% / 72.9%** |

100-tenant run: origin bytes 962,373 → 451,038 enforced; per-1,000-tenant projections are
linear extrapolations (labeled as such). Without enforcement, savings are zero by
construction.

**Correctness and robustness.** Zero signature-verification failures; cross-context and
cross-URL replay rejected; tampering caught by digest mismatch; 90,000+ fuzz executions
with no invariant violations; WordPress end-to-end passes negotiation, inline and index
signatures, assets, triage, and `llms.txt`.

## 7. Discussion and Limitations

- **Two-sided, enforcement-dependent adoption.** Declarations matter only if consumed or
  enforced; AIFeed is verifiable input to CDNs, WAFs, and hosting platforms.
- **Compatibility dependency.** MAKO is a third-party draft (pinned); AIFeed Markdown provides an
  independent native profile.
- **Trust-on-first-use.** Pinning, anti-rollback, and the transparency log mitigate but do
  not remove first-contact compromise.
- **Evaluation scope.** Single-machine, loopback, synthetic; no live pilot yet (pilot kit
  published); human-latency effects bounded by harness policy only.
- **Legal questions open.** TDM opt-out regimes and national laws need counsel; labels
  mark hypotheses.
- **Conflicts of interest.** Authors are the designers; mitigations are open artifacts and
  reproduction commands; external cryptographic review pending.

## 8. Conclusion and Future Work

Publisher-side, cryptographically attributable permissions are specifiable, implementable
without dependencies, and measurable: 55–56% publisher-side byte/CPU savings under
enforcement, 55–73% AI-side byte savings, 95.7% steady-state delta savings, sub-millisecond
verification. Remaining work is institutional: independent cryptographic review, a live
pilot, upstream standardization (MAKO extension; IETF Internet-Draft for the protocol
core), and multi-stakeholder registry governance. All artifacts are released for
reproduction and challenge.

## Ethics and artifact availability

Synthetic pages only; no personal data. Specifications and schemas CC BY 4.0; code MIT;
vectors CC0. Public repository URL is recorded in `CHECKLIST.md`.

## References

BibTeX entries with verified metadata live in [`refs.bib`](refs.bib). Keys used above:
`rfc2119`, `rfc3339`, `rfc6838`, `rfc7231`, `rfc7493`, `rfc7763`, `rfc8174`, `rfc8259`,
`rfc8288`, `rfc8615`, `rfc8785`, `rfc8032`, `rfc9110`, `rfc9162`, `rfc9309`, `rfc9421`,
`rfc9530`, `draftAiprefVocab`, `draftAiprefAttach`, `draftWebbotauth`, `draftWebbotArch`,
`makoSpec`, `rsl`, `llmstxt`, `tdmrep`, `cfRadar2025`, `cfCrawlRefer`, `cfContentSignals`,
`cfContentIndependence`, `cfBotPrinciples`, `cfPayPerCrawl`, `tollbit`, `pew2025`,
`euAiact`, `euTdmRegistry`, `uuPdp27`, `liu2025`, `chowdhury2026`, `li2025aitxt`,
`steinacker2025`, `lee2009`, `ge2016`, `archer2026`, `hoetzlein2026`, `munirathinam2026`,
`aifeedRepo`, `aifeedSpec01`, `aifeedSpec02`, `aimdSpec`, `aipolicyjson`, `agentstxt`, `crawlwall`.

