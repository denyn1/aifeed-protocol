# Agent quickstart — check AIFeed before you crawl

This is the client side of the protocol: what an AI system, crawler, or agent should do
**before its first request** to a site, so it acts on signed permissions instead of
guessing from unsigned files.

## The rule

1. **Discover the declaration.** `GET /.well-known/ai.json` (or follow
   `Link: rel="ai-feed"` / `<link rel="ai-feed">`). Do this before fetching content
   pages, the same way you would read `robots.txt`.
2. **Verify the chain.** TLS → domain match → Ed25519 signature over JCS bytes →
   optional DNS anchor (`_aifeed`). An unverified declaration grants nothing.
3. **Read permissions and limits.** Decide per use — `training`, `retrieval`,
   `summarize`, `quote`, … — and honour crawl limits. `deny` is an instruction, not a
   suggestion.
4. **Fetch compliantly.** Negotiate `Accept: text/aifeed+markdown` (native) or
   `text/mako+markdown` (compatibility), then verify the per-page signature.
5. **Use the delta index.** `/.well-known/aifeed-index.json` carries per-page digests;
   fetch only pages that changed. Unchanged pages cost 0 bytes.
6. **Re-check revocation and attribute.** Before reuse, re-check the signed revocation
   registry; include the attribution the manifest requires.

## Runnable example

```bash
node examples/agent/compliant-agent.js https://example.com --use retrieval --fetch
```

Output (verified site):

```
AIFeed check — example.com
discovery : https://example.com/.well-known/ai.json (fallback)
verify    : VERIFIED
use       : retrieval → allowed (attribution required)
training  : denied
index     : /.well-known/aifeed-index.json
content   : text/aifeed+markdown · 4218 bytes · tokens=1024 · signature verified
```

Exit codes: `0` verified, `1` unverified/denied, `2` usage error. `--json` prints the
full structured report.

## Code

```js
const sdk = require('@aifeed/verify');

const discovery = await sdk.discoverManifestUrl('https://example.com');
const manifest = await sdk.fetchText(discovery.manifestUrl);
const signature = await sdk.fetchText(discovery.manifestUrl.replace(/ai\.json$/, 'ai-signature.json'));

const verified = sdk.verifyAll({
  manifestText: manifest.text,
  manifestBytes: manifest.buffer,
  signatureText: signature.text,
  domain: 'example.com'
});
if (verified.result !== 'VERIFIED') {
  // no permission: stop, or fall back to the site's HTML under normal rules
}

const permissions = verified.manifest.permissions;
const training = sdk.decideUsage(permissions, 'training');   // { allowed, attribution, reason }
const retrieval = sdk.decideUsage(permissions, 'retrieval');

if (retrieval.allowed) {
  const page = await sdk.fetchAimd('https://example.com/artikel/satu', {
    publicKeyValue: verified.manifest.identity.public_key
  });
  if (page.mako_verified) {
    // use page.frontmatter / page.body within the declared permissions
  }
}
```

Delta consumption and triage:

```js
const delta = await sdk.fetchIndexDelta('https://example.com/.well-known/aifeed-index.json', {
  storedDigests: { '/artikel/satu': '<sha-256 from your last run>' }
});
const picked = sdk.selectEntries(delta.entries, { query: 'topic', maxTokens: 4000 });
for (const entry of picked.selected) { /* fetch only what changed or matters */ }
```

## Failure handling

| Situation | What a compliant agent does |
|---|---|
| No `/.well-known/ai.json` | Treat the site as having no AIFeed policy; fall back to normal rules (`robots.txt`, terms) — do not assume permission. |
| `VERIFIED` but `training: deny` | Do not train on the content, even if it is publicly reachable. |
| `UNVERIFIED` / `SUSPENDED` | Act as if no permission was granted; do not use the content for restricted purposes. |
| `403` from the edge | Stop. The publisher's enforcement point has declined the request. |
| `429` + `Retry-After` | Back off for at least the indicated time; do not rotate identifiers to evade. |
| Signature fails on a page | Discard the document; report it; do not silently fall back to scraping HTML. |
| `grace_accepted` warning | The publisher is rotating keys; the old key is still valid inside its window, but prefer re-fetching soon. |
| `rotation_anchor_unverified` warning | DNS `pk2` cross-check is missing or mismatching; advisory only — the signed directive remains the anchor. High-risk agents may treat it as an error. |
| `rotation_denied` | Do not trust the new content; a retired key re-appeared or the change was never announced. Re-verify from a clean state and report. |
| New key after a rotation | Accept only if it matches an announced successor you stored, or binds `predecessor_fp` to your pinned key (SDK `rotation.evaluateContinuity`); then update the pin. |

Publishers can enforce all of this at the edge — the nginx/Caddy/Apache templates and
the Node/PHP/Python/Go adapters in [`integrations/`](../integrations/) ship the same
policy (training crawlers `403`, non-compliant crawlers `429`, compliant clients served
signed content).

## Reference

- Specification: [`spec/en/aifeed-v0.2.md`](../spec/en/aifeed-v0.2.md) ·
  [`spec/en/aifeed-aimd-v1.md`](../spec/en/aifeed-aimd-v1.md)
- SDK: [`packages/aifeed-verify/README.md`](../packages/aifeed-verify/README.md) ·
  npm [`@aifeed/verify`](https://www.npmjs.com/package/@aifeed/verify)
- Verification details: protocol README, section "What gets verified"
- Example: [`examples/agent/compliant-agent.js`](../examples/agent/compliant-agent.js)
