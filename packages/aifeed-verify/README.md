# @aifeed/verify

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

Zero-dependency verifier for the **AIFeed protocol** — signed AI-Web content
declarations and content profiles.

## 1-Minute Quickstart

```bash
npm install @aifeed/verify
```

```js
const { verifyRemote } = require('@aifeed/verify');
const out = await verifyRemote('example.com');   // discovery → signature → DNS anchor
console.log(out.result, out.anchor.status);      // VERIFIED anchored
```

TypeScript: `import { verifyRemote } from '@aifeed/verify';`

What it verifies:

- **Manifests** (`/.well-known/ai.json`, v0.1/v0.2) with Ed25519 + JCS verification
- **Native content profile AIFeed Markdown** (`text/aifeed+markdown`, `.aifeed.md`)
- **MAKO compatibility profile** (`text/mako+markdown`) with the AIFeed trust layer
- **Delta index** (`/.well-known/aifeed-index.json` / `mako-index.json`) with per-entry
  SHA-256 digests and site/triage metadata
- **Revocation** documents (multi-signature) and **offline bundles**
- **Content-Digest** (RFC 9530) transport integrity
- **Triage selection** (`selectEntries`) for choosing pages within token budgets

Requires Node.js >= 20. No runtime dependencies.

## Install

```bash
npm install @aifeed/verify
```

## Quick start

### Verify a manifest (offline bytes)

```js
const sdk = require('@aifeed/verify');

const result = sdk.verifyAll({
  manifestText: fs.readFileSync('ai.json', 'utf8'),
  manifestBytes: fs.readFileSync('ai.json'),
  signatureText: fs.readFileSync('ai-signature.json', 'utf8'),
  domain: 'example.com'
});
console.log(result.result, result.errors);
```

### Fetch and verify native content (AIFeed Markdown)

```js
const content = await sdk.fetchAimd('https://example.com/artikel', {
  publicKeyValue: 'ed25519:...' // from the verified manifest
});
if (content.mako_verified) {
  console.log(content.frontmatter.entity, content.tokens);
}
// MAKO works the same way: sdk.fetchMako(url, options)
// or sdk.fetchMako(url, { mediaType: 'text/aifeed+markdown' })
```

### Delta consumption

```js
const delta = await sdk.fetchIndexDelta('https://example.com/.well-known/aifeed-index.json', {
  storedDigests: { '/artikel/a': '<sha-256 from last run>' }
});
const picked = sdk.selectEntries(delta.entries, { query: 'aifeed mako', maxTokens: 4000 });
for (const entry of picked.selected) {
  // fetch only what changed / matters
}
```

### Offline document verification

```js
const verified = sdk.verifyAimdDocument({
  pageUrl: 'https://example.com/artikel',
  makoBytes,                  // exact bytes as served
  containerText,              // signature container JSON
  manifestFragment            // { public_key, content_mako, permissions }
});
```

## API

| Export | Purpose |
|---|---|
| `verifyAll`, `verifyDirectory`, `checkManifest` | Manifest verification (v0.1/v0.2) |
| `fetchMako`, `fetchAimd` | Content negotiation with optional signature verification |
| `fetchIndexDelta` | Index fetch + change diff against stored digests |
| `selectEntries` | Keyword ranking with `maxPages` / `maxTokens` budgets |
| `verifyMakoDocument`, `verifyAimdDocument` | Offline document verification per profile |
| `verifyMakoIndex`, `verifyAimdIndex` | Index signature + digest validation |
| `mako.*` | Parser, sign/verify primitives, permission resolution, constants |
| `verifyRevocationDocument`, `revocation.*` | Registry revocation checks |
| `createBundle`, `verifyBundle` | Offline audit bundles |
| `digest.*` | SHA-256/512 helpers and RFC 9530 Content-Digest |
| `AIMD_MEDIA_TYPE`, `MAKO_MEDIA_TYPE` | Media type constants |

TypeScript declarations ship in `index.d.ts`.

## Licensing

MIT. Test vectors are CC0. Specification: CC BY 4.0.
