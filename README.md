<p align="center">
  <img src="aifeed-logo.svg" width="92" alt="AIFeed logo">
</p>

<h1 align="center">AIFeed</h1>

<p align="center"><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

<p align="center"><strong>Signed content permissions for the AI web.</strong><br>
Declare, sign, and revoke what AI agents may do with your content — and let agents prove it.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@aifeed/verify"><img src="https://img.shields.io/npm/v/@aifeed/verify?color=f55036&label=npm" alt="npm version"></a>
  <img src="https://img.shields.io/badge/tests-243%20JS%20%C2%B7%2044%20Python-3ddc97" alt="test suites">
  <img src="https://img.shields.io/badge/conformance-84%20vectors-f55036" alt="conformance vectors">
  <img src="https://img.shields.io/badge/specs-CC%20BY%204.0-6ea8fe" alt="spec license">
  <img src="https://img.shields.io/badge/code-MIT-3ddc97" alt="code license">
  <img src="https://img.shields.io/badge/status-1.0.0--draft-ffb454" alt="status">
</p>

<p align="center">
  <a href="https://aifeed.md">Website</a> ·
  <a href="https://aifeed.md/process.html">Protocol flow</a> ·
  <a href="https://aifeed.md/enforcement-report.html">Benchmark</a> ·
  <a href="https://aifeed.md/penjelasan.html">Complete guide</a> ·
  <a href="paper/aifeed-preprint.pdf">Paper (PDF)</a>
</p>

---

## Why AIFeed?

AI agents now drive a large and growing share of web traffic, but the signals that say
what they may do are **unsigned text files**. Anyone can edit them, nothing binds them to
a domain, and there is no way to revoke them. The asymmetry is measurable:

- **1.9 billion** crawls ignored `robots.txt` rules in a single half-year (one vendor).
- A **70,900 : 1** crawl-to-referral ratio was measured for a major AI provider.
- AI bots averaged **4.2 %** of HTML requests in 2025, peaking at 6.4 %.

AIFeed replaces "please respect this file" with a cryptographically verifiable
declaration, plus lean agent-ready content that cuts cost on **both** sides.

## How it works

1. **Generate an Ed25519 key pair** — the private key never leaves the origin.
2. **Publish a signed manifest** at `/.well-known/ai.json`: per-use permissions
   (training, retrieval, quote, …), crawl limits, license, revision.
3. **Anchor the key in DNS** (`_aifeed` TXT) so a manifest cannot be spoofed by another
   domain.
4. **Agents verify the chain** — TLS → domain → signature (JCS + Ed25519) → DNS anchor —
   and re-check a **multi-signature revocation registry** on every use.
5. **Rotate keys safely** — announce the successor with an old-key-signed directive (plus
   an advisory DNS `pk2` cross-check), keep a bounded overlap, cut over, then revoke the
   old key permanently. Runbook: [`docs/rotation.md`](docs/rotation.md).
6. **Serve lean content** under one of two profiles (below), with a signed **delta index**
   so unchanged pages cost 0 bytes.

**For AI agents:** the check-first guide (discovery → verification → permission
decisions → delta → failure handling) is in
[`docs/agent-quickstart.md`](docs/agent-quickstart.md),
with a runnable example at
[`examples/agent/compliant-agent.js`](examples/agent/compliant-agent.js).

## Try it

```bash
npm install @aifeed/verify
```

```js
const sdk = require('@aifeed/verify');

const base = 'https://example.com/.well-known/';
const manifest = await sdk.fetchText(base + 'ai.json');
const signature = await sdk.fetchText(base + 'ai-signature.json');

const result = sdk.verifyAll({
  manifestText: manifest.text,
  manifestBytes: manifest.buffer,
  signatureText: signature.text,
  domain: 'example.com'
});
console.log(result.result, result.errors);
```

The CLI lives in this repository (zero dependencies, Node ≥ 20):

```bash
cd aifeed-protocol
node bin/cli.js keygen --out keys/
node bin/cli.js validate https://example.com
node bin/cli.js site build ./public --domain example.com --key keys/aifeed-private.pem
```

## Two content profiles

| Profile | Media type | Extension | Notes |
|---|---|---|---|
| **AIFeed Markdown** (native) | `text/aifeed+markdown` | `.aifeed.md` | In-band signed policy block, token budget, translation `alternates`, triage metadata |
| **MAKO** (compatibility) | `text/mako+markdown` | `.mako.md` | External MAKO trust profile, served from the same signed bytes with its own signature context |

Dual-stack origins serve both; cross-format replay is rejected by design.

## Measured results

All numbers are reproducible from committed artifacts (`npm run bench:mako`,
`npm run bench:enforcement`); the test environment is a single machine on loopback
networking with a synthetic 60-page corpus. Honest baseline included.

| What | Result | Label |
|---|---|---|
| Conversion to markdown profiles vs HTML | **−68.83 %** transferred bytes | measured |
| Delta consumption (10 % pages changed) | **−95.73 %** vs HTML crawl | measured |
| Publisher egress bytes / CPU / peak connections | **−55.19 % / −56.23 % / −88.24 %** | measured (simulation) |
| AI-side received bytes (all profiles / compliant client) | **−54.84 % / −72.93 %** | measured (simulation) |
| Unchanged pages skipped | 14 of 18 | measured (simulation) |
| Signature verification cost | **0.70 ms / page** | measured |

The 30-day live pilot has **not** run yet; projections per 1,000 tenants are labeled as
model extrapolations, and vendor claims of up to 94 % token reduction require semantic
summarization this project does not perform automatically.

## What's in this repository

| Path | Contents |
|---|---|
| [`lib/`](lib/) + [`bin/`](bin/) | Zero-dependency reference implementation and CLI |
| [`conformance/`](conformance/) | Conformance vectors: 34 manifest · 39 MAKO · 11 AIFeed Markdown |
| [`wp-plugin/`](wp-plugin/) | WordPress plugin: signed manifest, AIFeed Markdown + MAKO dual-stack, `/llms.txt` |
| [`spec/`](spec/) | Specifications EN/ID: manifest v0.1/v0.2, AIFeed Markdown v1.0 |
| [`schema/`](schema/) | JSON Schemas for manifests, signatures, AIFeed Markdown, MAKO |
| [`paper/`](paper/) | Preprint: LaTeX source, PDF, claim ledger, arXiv bundle |
| [`docs/`](docs/) | Agent quickstart, deploy and namespace guides, Indonesian project notes |
| [`REFERENCE.md`](REFERENCE.md) | Reference implementation details, what gets verified, CLI quickstart |

## Documentation

- Specifications: [`spec/en`](spec/en) · [`spec/id`](spec/id) · [schemas](schema)
- Reference implementation: [`REFERENCE.md`](REFERENCE.md)
- Maintenance contract (AI agents & devs): [`AGENTS.md`](AGENTS.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md) · Release guide: [`docs/release.md`](docs/release.md)
- Agent quickstart (client side): [`docs/agent-quickstart.md`](docs/agent-quickstart.md)
- Publisher AI guide (owner side): [`docs/publisher-ai-guide.md`](docs/publisher-ai-guide.md)
- Publisher Studio (local app): [`studio/README.md`](studio/README.md)
- Complete guide: [`penjelasan-aifeed.html`](penjelasan-aifeed.html) (source of <https://aifeed.md/penjelasan.html>)
- Security policy: [`SECURITY.md`](SECURITY.md)
- Governance & open-core policy: [`GOVERNANCE.md`](GOVERNANCE.md)
- Deploying the site: [`docs/deploy-site.md`](docs/deploy-site.md)
- arXiv submission notes: [`paper/ARXIV-SUBMISSION.md`](paper/ARXIV-SUBMISSION.md)

## Status

- Release **`1.0.0-draft`** — the specifications are **not frozen** yet. Wire versions:
  manifest `0.1`/`0.2`, AIFeed Markdown `1.0`, MAKO `0.2`.
- Conformance: 34 manifest + 39 MAKO + 11 AIFeed Markdown vectors, executed by
  independent JavaScript and Python verifiers, plus PHP differential fixtures, 90,000+
  fuzz executions, and a WordPress end-to-end test.
- Not claimed: external cryptographic review and a live pilot (both pending);
  origin+DNS compromise is undetectable on first contact.

## License and contact

Specifications **CC BY 4.0** · reference code and plugin **MIT** · vectors **CC0**.
Contact: <contact@aifeed.md> — security reports per
[`SECURITY.md`](SECURITY.md).
