# AIFeed Specifications

Canonical language: **English** (`spec/en/`). Translations (`spec/<lang>/`) are
informational; when they diverge, English wins.

| Document | Version | Status | Scope |
|---|---|---|---|
| [`en/aifeed-v0.1.md`](en/aifeed-v0.1.md) · [id](id/aifeed-v0.1.md) · [zh](zh/aifeed-v0.1.md) | 0.1.0-rc1 | Release candidate | Signed declarations: manifest, signature, DNS anchor, revocation, bundles |
| [`en/aifeed-v0.2.md`](en/aifeed-v0.2.md) · [id](id/aifeed-v0.2.md) · [zh](zh/aifeed-v0.2.md) | 0.2.0-draft | Draft | MAKO trust profile: MAKO signatures, permission binding, delta index, assets, triage |
| [`en/aifeed-aimd-v1.md`](en/aifeed-aimd-v1.md) · [id](id/aifeed-aimd-v1.md) · [zh](zh/aifeed-aimd-v1.md) | 1.0 (protocol), AIFeed 0.2 | Draft | **AIFeed Markdown** native content profile, dual-stack operating modes, media type registration plan |

Related documents outside `spec/`:

- [`../EXTENSION.md`](../EXTENSION.md) — proposal to the MAKO community for the trust
  layer (signature + permissions + delta) as an upstream extension.
- [`../paper/main.md`](../paper/main.md) — arXiv preprint draft (working title:
  *AIFeed: Verifiable Content Permissions and Efficient Agent Delivery for the
  AI Web*), with verified bibliography and a claims ledger.
- [`../CHANGELOG.md`](../CHANGELOG.md) — protocol and reference implementation history.
- [`../GOVERNANCE.md`](../GOVERNANCE.md) — interim governance, registry process, and the
  licensing/open-core policy (what is permanently open vs private).
- [`../SECURITY.md`](../SECURITY.md) — vulnerability reporting and key compromise.

Conformance artifacts: `conformance/vectors` (manifest), `conformance/mako` (MAKO),
`conformance/aimd` (AIFeed Markdown), plus revocation and bundle fixtures.

## Status of the drafts

The v0.1.0-rc1, 0.2, and AIFeed Markdown v1 documents are **not frozen**. Changes follow
[`../CONTRIBUTING.md`](../CONTRIBUTING.md); breaking changes bump the protocol minor
version and must ship with updated conformance vectors.
