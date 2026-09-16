# Claims ledger

<p><a href="CLAIMS.md">English</a> · <a href="CLAIMS.id.md">Bahasa Indonesia</a> · <a href="CLAIMS.zh.md">中文</a></p>

Every quantitative claim in the paper is traced here. Types:
**[peer]** peer-reviewed publication · **[std]** standard/specification ·
**[ind]** industry report or vendor statement · **[meas]** our reproducible measurement ·
**[sim]** our simulation (loopback harness) · **[model]** our extrapolation ·
**[hyp]** hypothesis, not claimed as fact.

Bib keys refer to `refs.bib`. Access dates for web sources: 2026-09-14/15.

## Problem evidence (external)

| # | Claim | Value | Source | Type |
|---|---|---|---|---|
| C1 | AI-bot share of HTML requests (2025) | 4.2% avg (2.4–6.4%) | `cfRadar2025` | ind |
| C2 | Googlebot share; peak | 4.5%; 11% | `cfRadar2025` | ind |
| C3 | Growth of "user action" agent crawls in 2025 | >15× (up to ~21×) | `cfRadar2025` | ind |
| C4 | Bot vs human share of HTML requests (2025-12-02) | non-AI bots ≈44%, humans 47% | `cfRadar2025` | ind |
| C5 | Verified bot mix | AI crawlers 20%, search 40%, GPTBot 7.5% | `cfRadar2025` | ind |
| C6 | Bot-traffic projections | bots exceed humans 2029; bot activity > current total traffic 2031 | `cfContentSignals` | ind (projection) |
| C7 | AI scrapes detected, H1 2026 | 22B+ out of 987B+ visits | `tollbit` | ind |
| C8 | robots.txt bypasses, H1 2026 | 1.9B+ | `tollbit` | ind |
| C9 | Bots routed to paywall, H1 2026 | 2.6B+ | `tollbit` | ind |
| C10 | Anthropic crawl-to-refer ratio (web only, 19–26 Jun 2025) | 70,900:1 | `cfCrawlRefer` | ind |
| C11 | Relative difficulty to produce referrals vs historical search | OpenAI 750×, Anthropic 30,000× | `cfContentIndependence` | ind (vendor analysis) |
| C12 | Zero-click mobile queries | 75% | `cfContentIndependence` | ind (vendor analysis) |
| C13 | Identity gaps and stealth crawling | xAI no identification; Anthropic UA-only; Perplexity stealth | `cfBotPrinciples` | ind |
| C14 | Cryptographic bot signing in production | ChatGPT Agent signs (Ed25519 + RFC 9421); Vercel verifies | `cfBotPrinciples`, `draftWebbotauth` | ind + std |
| C15 | Content Signals adoption | 3.8M+ domains | `cfContentSignals` | ind |
| C16 | Crawl-payment market | Pay Per Crawl beta (HTTP 402); TollBit $31M+ funding; major publishers | `cfPayPerCrawl`, `tollbit` | ind |
| C17 | User click behavior with AI summaries | fewer clicks when summary present | `pew2025` | research organization report |
| C18 | EU AI Act timeline; EU TDM opt-out registry feasibility study published 2026-07-13 | — | `euAiact`, `euTdmRegistry` | official |
| C19 | Indonesia PDP Law 27/2022 in force | — | `uuPdp27` | official |
| C20 | Creator-protection study of AI crawlers | IMC 2025 | `liu2025` | peer (accepted) |
| C21 | terms.txt: consent/compensation protocol for agentic access | arXiv 2609.11152 (2026-09) | `chowdhury2026` | preprint |
| C22 | ai.txt: DSL for guiding AI interactions | arXiv 2505.07834 (2025-05) | `li2025aitxt` | preprint |
| C23 | robots.txt gatekeeping study | arXiv 2510.10315 (2025-10) | `steinacker2025` | preprint |
| C24 | Web-robot classification over 1B requests | Computers & Security 2009 | `lee2009` | peer |
| C25 | Robots exclusion and guidance protocol | Tsinghua Sci. Technol. 2016 | `ge2016` | peer |
| C26 | Pay-per-crawl pricing model | arXiv 2604.01416 (2026-04) | `archer2026` | preprint |
| C27 | Small-organization bot protection (logrip) | arXiv 2508.03130 (2025-08) | `hoetzlein2026` | preprint |
| C28 | LLM-agent compliance with in-band governance signals | arXiv 2606.06460 (2026-06) | `munirathinam2026` | preprint |
| C29 | Adjacent projects: consolidated permission manifest without signatures (`ai-policy.json`), unsigned discovery file (`agents.txt`), edge enforcement with signed ledger (`CrawlWall`), and per-purpose terms with signed exchange/payments (`terms.txt`) | inspected 2026-09-15 | `aipolicyjson`, `agentstxt`, `crawlwall`, `chowdhury2026` | inspection (GitHub repos + preprint) |
| C30 | **Combination claim:** per the inspected sources as of 2026-09-15, no single project combines publisher-signed permissions with DNS anchor and revocation, a native plus compatibility content profile over one signed payload, and a verifiable delta index | — | synthesis of C20–C29 | inspection, explicitly not exhaustive |

## Our measurements and simulations (artifacts in this repository)

| # | Claim | Value | Artifact | Type |
|---|---|---|---|---|
| M1 | AIFeed Markdown/MAKO conversion vs HTML, bytes | −68.83% (60-page synthetic corpus, 1,205,292 → 375,630 B incl. signatures) | `benchmarks/mako-benchmark.json` | meas |
| M2 | Token estimate reduction (ceil(bytes/4)) | −68.8% | idem | meas (heuristic) |
| M3 | Delta consumption vs full HTML crawl | −95.73% | idem (10% pages changed; unchanged assumed `304`) | sim |
| M4 | Delta vs full MAKO fetch | −86.31% | idem | sim |
| M5 | Signing and verification cost | sign 0.25 ms/page; verify 0.34–0.70 ms/page; index verify measured | idem + `benchmarks/enforcement-report.json` | meas (machine-specific) |
| M6 | Publisher savings under enforcement (S3) | bytes −55.19%, origin CPU −56.23%, peak concurrency −88.24% | `benchmarks/enforcement-report.json` | sim |
| M7 | AI-side savings under enforcement (S3) | all profiles −54.84%; compliant client −72.93% | idem | sim |
| M8 | Unchanged pages skipped via delta (18-page site) | 14/18 | idem | sim |
| M9 | 100-tenant scale, S0 vs S3 | origin bytes 962,373 → 451,038; per-1,000-tenant projection in artifact | idem | meas + model |
| M10 | Conformance vectors passing, cross-language | 34 manifest + 39 MAKO + 11 AIFeed Markdown in JS and Python | `conformance/` | meas |
| M11 | Parser/verifier fuzzing | 90,000+ executions, zero invariant failures | `tools/fuzz*.js` | meas |
| M12 | Signature verification correctness | 0 failures; cross-format/context replay rejected (E2E WordPress + vectors) | `tests/`, E2E scripts | meas |
| M13 | Vendor claim vs faithful conversion | MAKO claims up to −94% tokens (semantic optimization); our faithful converter measures −68.8% bytes — the gap is publisher-chosen summarization, not achieved by the protocol | `makoSpec` vs `benchmarks/` | comparison |
| M14 | Key rotation (v0.2 §14) | 4 positive + 5 negative conformance vectors; successor bound by an old-key-signed directive with an advisory DNS `pk2` cross-check; 1 h hard overlap floor | `conformance/vectors/*/0{08..11,119..123}-rotation*` | meas |
| M15 | Savings without adoption/enforcement | ≈0 (baseline S0 serves everything; bypass evidence C8) | idem | analysis |

## Non-quantitative claims (stated with scope)

- The verification chain (TLS → domain match → Ed25519 → DNS anchor) is only as strong
  as its weakest layer; origin+DNS compromise on first contact is undetectable (TOFU).
- Signatures attest provenance, not fidelity of markdown to HTML rendering.
- AIFeed depends on a third-party draft (MAKO) for the compatibility profile; the AIFeed Markdown
  profile is independent.
- No external cryptographic review or live 30-day pilot has been completed at preprint
  time; both are planned and their status is disclosed in the paper.
- Legal statements are labeled **[H]** and are not legal advice.

## Unfavorable results included

- M13 (vendor-claim gap), M15 (zero savings without enforcement), TOFU limits,
  single-machine synthetic evaluation, no production CDN data, dependence on draft
  specifications, and the two-sided adoption cold-start.
