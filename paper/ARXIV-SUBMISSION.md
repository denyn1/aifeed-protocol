# arXiv submission package

Ready-to-upload bundle for the preprint:

> **AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the AI Web**

## Files to upload

| File | Purpose |
|---|---|
| `paper/main.tex` | LaTeX source (self-contained; TikZ diagrams inline) |
| `paper/refs.bib` | Bibliography (52 verified entries, natbib/plainnat) |
| `paper/00README.json` | Tells arXiv's AutoTeX to use `pdflatex` |
| `paper/aifeed-arxiv.tar.gz` | **Upload this** (arXiv prefers `.tar.gz`) |

Regenerate the bundle after editing the paper:

```bash
cd paper
tar -czf aifeed-arxiv.tar.gz main.tex refs.bib 00README.json
```

No LaTeX is installed locally; arXiv runs `pdflatex` + BibTeX itself. If a
bibliography error occurs, open the project on Overleaf, compile once, download the
generated `main.bbl`, and re-upload it together with `main.tex` and `refs.bib`
(that is the only common failure mode for `plainnat`).

## Metadata for the submission form

**Title:** AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the AI Web

**Authors:** AIFeed Protocol Contributors

**Primary category:** `cs.CR` (Cryptography and Security)
**Cross-list:** `cs.AI` (Artificial Intelligence), `cs.IR` (Information Retrieval),
`cs.NI` (Networking and Internet Architecture)

**Comments:** Preprint, 13 sections. Reference implementation, schemas, and 75
conformance vectors: https://github.com/denyn1/aifeed-protocol

**License:** recommend **CC BY 4.0** (the specifications are CC BY 4.0; code is MIT).

**Abstract (plain text for the form):**

AI systems now consume more web content than people do, and the plain-text preferences in
robots.txt do not hold them back: one vendor logged 1.9 billion crawls that ignored robots
rules in a single half-year, and one web-only measurement put the crawl-to-referral ratio
of a major AI provider at 70,900:1. Preference and licensing signals exist, but they are
not attributable to a domain, cannot be revoked, and do nothing about the cost of repeated
consumption. We describe AIFeed, an open trust layer built around a signed manifest of
machine-readable permissions, anchored in DNS and checked against a multi-signature
revocation registry. Two content profiles ride on the same signed bytes: a native markdown
format (AIFeed Markdown) and a compatibility profile for the external MAKO draft. Three
properties, taken together, distinguish the design from the signals we surveyed: signed
provenance of permissions, per-page binding with restrict-only overrides, and a
digest-bearing delta index that lets an agent skip pages that have not changed.

We measure the system on committed artifacts. Converting a 60-page corpus to the markdown
profiles cuts transferred bytes by 68.8% (95.7% for delta consumption), and a loopback
enforcement harness with four client profiles records publisher savings of 55.2% of bytes
and 56.2% of CPU, AI-side savings of 54.8% (72.9% for the compliant client), 14 of 18
unchanged pages skipped, and signature verification at 0.70 ms per page. The specification
is exercised by 25 manifest, 39 MAKO, and 11 AIFeed Markdown vectors under independent
JavaScript and Python verifiers, plus differential PHP fixtures and an end-to-end
WordPress deployment. We also report results that do not flatter the design: without
adoption and enforcement there are no savings at all; vendor claims of up to 94% token
reduction rely on summarization our converter does not perform; origin-plus-DNS compromise
is invisible on first contact; and the compatibility profile depends on a third-party
draft. No external cryptographic review or live pilot exists yet.

## Before you press submit

- [x] Public repository with a pinned tag (`v1.0.0-draft`) —
      https://github.com/denyn1/aifeed-protocol
- [ ] Confirm the contact email (`contact@aifeed.md` is still a placeholder in the
      author footnote; create the mailbox or replace it with a real address)
- [ ] arXiv account + any required endorsement for `cs.CR` (first-time submitters may
      need an endorser; the submission form will say so)
- [ ] Optional: transfer the repository to the `aifeed` organization and update the
      artifact URL in `main.tex` (one `replace` + bundle rebuild)
- [ ] After acceptance: add the arXiv ID to `paper/CHECKLIST.md` and the site footer

## Post-submission

1. The arXiv listing URL and DOI (if assigned) go into `paper/CHECKLIST.md`.
2. Cite the preprint from the landing page footer if desired.
3. Keep `v1.0.0-draft` as the pinned artifact version for reviewers; the wire
   versions inside the paper (manifest 0.1/0.2, AIFeed Markdown 1.0, MAKO 0.2) are
   independent of the release number.
