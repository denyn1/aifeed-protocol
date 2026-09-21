# Paper submission checklist (arXiv → IETF later)

<p><a href="CHECKLIST.md">English</a> · <a href="CHECKLIST.id.md">Bahasa Indonesia</a> · <a href="CHECKLIST.zh.md">中文</a></p>

Status keys: **[x]** done and verified · **[ ]** pending · **[!]** blocker for submission.

## Metadata

- **[x]** Title: *AIFeed: Verifiable Content Permissions and Efficient Agent
  Delivery for the AI Web* (working title).
- **[x]** Collective author: `AIFeed Protocol Contributors`.
- **[!]** Contact email for the collective author — confirm before upload
  (`contact@aifeed.md` placeholder in the draft).
- **[x]** Primary category: `cs.CR` (cryptography and security); cross-list `cs.CY`
  (computers and society) and optionally `cs.NI`.
- **[x]** License for the preprint: **CC BY 4.0** (matches the specification).
- **[x]** Abstract length kept under 1,920 characters (checked in `main.tex`).
- **[!]** arXiv account + endorsement for `cs.CR` — required for first submission from a
  new author; start early, it can take days.

## References (precision audit)

- **[x]** RFCs verified against rfc-editor.org headers (17 entries: 2119, 8174, 3339,
  8032, 8259, 7493, 8615, 9110, 9309, 9421, 9530, 9162, 8288, 6838, 7763, 7231 + DOI
  `10.17487/*`).
- **[x]** IETF drafts pinned to revision + date:
  `draft-ietf-aipref-vocab-08` (2026-09-14), `draft-ietf-aipref-attach-05` (2026-08-19),
  `draft-ietf-webbotauth-httpsig-protocol-00` (2026-09-01),
  `draft-meunier-web-bot-auth-architecture-05` (2026-03-02).
- **[x]** MAKO specification pinned to commit `de7c0d59` (2026-02-18, Apache-2.0).
- **[x]** Industry sources verified reachable with dates: Cloudflare Radar 2025, Cloudflare
  crawl-to-refer (2025-07-01), Content Signals (2025-09), Responsible AI Bot Principles
  (2025-09-24), Pay Per Crawl (2025-07-01), TollBit H1 2026 (homepage), Pew Research
  (2025-07-22).
- **[x]** Peer-reviewed / academic citations verified with authors, years, DOIs/arXiv IDs:
  Liu et al. (IMC 2025), Lee et al. (C&S 2009, `10.1016/j.cose.2009.05.004`), Ge & Ding
  (TST 2016, `10.1109/tst.2016.7787007`), Chowdhury (2026), Steinacker-Olsztyn et al.
  (2025), Li et al. (2025), Munirathinam (2026), Archer et al. (2026), Hoetzlein (2026).
- **[x]** Prior-art inspection (2026-09-15) of adjacent projects recorded in `CLAIMS.md`
  (C29/C30): `ai-policy.json`, `agents.txt`, `CrawlWall`, `terms.txt`; paper states a
  combination claim, not exclusivity.
- **[ ]** Add the ACM DOI for Liu et al. IMC 2025 once located (currently cited as
  "arXiv:2411.15091, accepted at IMC 2025").
- **[ ]** Re-check all pins/URLs one final time on the submission day (drafts move).

## Claims ledger

- **[x]** `CLAIMS.md` covers every quantitative claim with source + type
  (measurement / simulation / industry report / peer-reviewed / standard).
- **[x]** Unfavorable results included: vendor-claim gap (−94% tokens vs −68.8% byte
  conversion), zero savings without adoption/enforcement, TOFU limits, third-party draft
  dependency.
- **[x]** Company/COI disclosure drafted: authors are the protocol designers; mitigations
  listed (open artifacts, reproduction commands, external review pending).

## Artifacts and reproducibility

- **[x]** Local git repository initialized with `.gitignore` excluding keys and caches.
- **[x]** Public repository URL (GitHub) — https://github.com/denyn1/aifeed-protocol
  (public, pinned tag `v1.0.0-draft`). Optional: transfer to the `aifeed` organization
  later and update the URL in `paper/main.tex` and this checklist.
- **[!]** Canonical domain — **`aifeed.md` purchased (2026-09-16)**. The migration
  `aifeed.org` → `aifeed.md` is applied and regression-tested (see
  `docs/namespace-setup.md`). Remaining before submission: configure DNS (A/AAAA +
  `www`, see the doc), create `contact@aifeed.md`, and update the contact email in this
  draft if it differs from the placeholder.
- **[ ]** Tag the submitted snapshot (e.g., `paper-v1`, `v1.0.0-draft`) so reviewers can pin.
- **[x]** Reproduction commands documented: `npm test`, `npm run test:py`,
  `npm run {vectors,mako:vectors,aimd:vectors}:check`, `npm run bench:mako`,
  `npm run bench:enforcement`, `npm run render:html`.
- **[x]** Honest environment notes: single machine, loopback harness, synthetic corpus,
  deterministic seeds; no production CDN/pilot data.

## Manuscript mechanics

- **[x]** LaTeX source (`paper/main.tex`, `paper/refs.bib`) + Markdown mirror for review.
- **[x]** Structural cross-check: `npm run paper:check` — 52/52 citation keys resolve in
  `refs.bib`, all LaTeX environments balanced.
- **[!]** Compile check: no local TeX distribution detected on the authoring machine;
  compile on Overleaf or after installing TeX Live before upload.
- **[x]** Figures: none external — tables plus one inline TikZ diagram, so there are no
  missing asset files at compile time.
- **[ ]** Final proofread pass for bias language (no marketing adjectives in claims).

## After arXiv

- **[ ]** Submit `docs/EXTENSION.md` to mako-spec (upstream trust-layer proposal).
- **[ ]** Convert the protocol core into an IETF Internet-Draft (with the AIFeed Markdown/MAKO
  profiles as appendices).
- **[ ]** Publish the open-core licensing policy summary alongside the paper (already in
  `GOVERNANCE.md`).
