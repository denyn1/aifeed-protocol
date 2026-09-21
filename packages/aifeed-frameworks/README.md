# @aifeed/frameworks

Drop-in build plugins that turn your static output into an [AIFeed](https://aifeed.md)
origin — signed manifest, per-page AIFeed Markdown/MAKO, delta index, and `llms.txt` —
without calling a CLI by hand.

```bash
npm install --save-dev @aifeed/frameworks@next
npx aifeed-build keygen --out .aifeed   # once per project
```

## Vite

```js
// vite.config.js
import { aifeed } from '@aifeed/frameworks/vite';

export default {
  plugins: [aifeed({ domain: 'example.com', keyPath: '.aifeed/aifeed-private.pem' })]
};
```

Runs after `vite build` (`closeBundle`), reads `build.outDir`, signs every generated
HTML page, and injects `<link rel="alternate" type="text/aifeed+markdown">` so agents
find the markdown endpoints on any static host.

## Astro

```js
// astro.config.mjs
import aifeed from '@aifeed/frameworks/astro';

export default {
  integrations: [aifeed({ domain: 'example.com', keyPath: '.aifeed/aifeed-private.pem' })]
};
```

Runs on `astro:build:done` and signs the output directory.

## Next.js (`output: 'export'`)

```js
// next.config.js
const { withAifeed } = require('@aifeed/frameworks/next');

module.exports = withAifeed({ output: 'export' }, { domain: 'example.com' });
```

```jsonc
// package.json — npm runs "postbuild" automatically after "build"
{ "scripts": { "build": "next build", "postbuild": "aifeed-next --domain example.com --key .aifeed/aifeed-private.pem" } }
```

Next.js has no official post-export hook, so `withAifeed()` validates the config and
warns when `output !== 'export'`, while the `aifeed-next` bin does the signing after the
export finishes (default directory: `out/`).

## Any other generator (Hugo, Eleventy, Jekyll, plain HTML)

```bash
npx aifeed-build ./public --domain example.com --key .aifeed/aifeed-private.pem
npx aifeed-build ./public --domain example.com --profile both --no-inject --json
```

## What gets written

| Artifact | Location |
|---|---|
| Manifest + signature | `.well-known/ai.json`, `.well-known/ai-signature.json` |
| Delta index (+ signature) | `.well-known/aifeed-index.json` (and `mako-index.json` for `profile: both`) |
| Per-page markdown + `.sig` | `path.aifeed.md`, `path.mako.md` next to each HTML file |
| Discovery | `<link rel="alternate">` in HTML (unless `inject: false`), `llms.txt` |

## Options

| Option | Default | Notes |
|---|---|---|
| `domain` | `AIFEED_DOMAIN` | required |
| `keyPath` | `aifeed-private.pem` (`AIFEED_KEY`) | Ed25519 PKCS#8 PEM |
| `baseUrl` | `https://<domain>` (`AIFEED_BASE_URL`) | set for subpath deployments |
| `profile` | `aimd` | `aimd` \| `mako` \| `both` |
| `inject` | `true` | add `<link rel="alternate">` to built HTML |
| `llms` | `true` | write `llms.txt` |
| `prune` | `true` | remove stale generated files before rebuilding |
| `verifyAfter` | `true` | self-verify signatures/digests; fail the build on tampering |
| `name`, `type`, `locale`, `contact`, `keyId`, `updated` | CLI defaults | manifest metadata |
| `permissions`, `limits`, `license`, `sitemap`, `maxCheckIntervalHours` | manifest defaults | policy fields |

## Notes

- Keys never leave your machine during the build; nothing is uploaded.
- `inject: false` is for hosts that already negotiate `Accept: text/aifeed+markdown`
  (nginx, Caddy, Apache, Cloudflare — see `integrations/` in the repository).
- Rebuilds are idempotent: signatures are refreshed, link injection is not duplicated,
  and pruned files are regenerated from the current HTML.
- Zero dependencies; Node ≥ 20. The verification engine is bundled from the reference
  implementation (`npm run build:fw` in the repository).

## Source

Part of [aifeed-protocol](https://github.com/denyn1/aifeed-protocol)
(`packages/aifeed-frameworks`). Specs: `spec/en/`; publisher guide:
[`docs/publisher-ai-guide.md`](../../docs/publisher-ai-guide.md).
