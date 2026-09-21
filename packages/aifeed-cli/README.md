# aifeed

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

The AIFeed protocol CLI: declare, sign, and revoke what AI agents may do with your
content — then let any agent verify it. Zero dependencies, Node ≥ 20.

## 1-Minute Quickstart

### Sign a website you already deploy

```bash
npx aifeed keygen --out .aifeed
npx aifeed site build ./public --domain example.com --key .aifeed/aifeed-private.pem --llms --inject
# deploy ./public as-is: .well-known/ai.json, *.aifeed.md, *.mako.md, *.sig, llms.txt
```

> Windows shells occasionally block fresh `npx` shims (`'aifeed' is not recognized`):
> run `npm install -g aifeed` once, then use `aifeed …` directly.

### Or scaffold a signed manifest (keys included)

```bash
npx aifeed init --domain example.com --dir ./site
npx aifeed validate ./site --domain example.com
```

`init` writes `aifeed-private.pem`, `.well-known/ai.json`, `.well-known/ai-signature.json`,
and `aifeed-setup.txt` (DNS record + host snippets).

### Re-sign after editing the manifest

```bash
npx aifeed sign ./site/.well-known/ai.json   # finds the key next to the site
```

### Verify a live domain end-to-end

```bash
npx aifeed validate example.com --require-dns-anchor
# TLS → signature → DNS _aifeed anchor → revocation registry
```

## Verify in 3 lines (AI-side consumers)

```bash
npm install @aifeed/verify
```

```js
const { verifyRemote } = require('@aifeed/verify');
const out = await verifyRemote('example.com');
console.log(out.result, out.anchor.status); // VERIFIED anchored
```

TypeScript: `import { verifyRemote } from '@aifeed/verify';`

## Commands

| Command | What it does |
|---|---|
| `aifeed keygen --out DIR` | Generate an Ed25519 key pair (`aifeed-private.pem`, `aifeed-public.txt`) |
| `aifeed init --domain D --dir DIR` | Keys + signed manifest + setup guide in one step |
| `aifeed sign <ai.json>` | Sign (or re-sign) a manifest; verifies before writing |
| `aifeed validate <domain\|DIR\|FILE>` | Verify the trust chain; `--require-dns-anchor` for live domains |
| `aifeed rotate --dir DIR` | Replace the signing key with a bounded overlap window |
| `aifeed site build <DIR> --domain D --key FILE` | Sign a whole static site: pages, index, `llms.txt` |
| `aifeed bundle create\|verify` | Offline audit bundles for air-gapped verification |
| `aifeed mako generate\|sign\|verify\|index\|fetch` | AIFeed Markdown / MAKO content tools (`aifeed aimd …` alias) |
| `aifeed import-openapi <spec.json>` | Draft agent capabilities/actions from an OpenAPI spec |

Run `npx aifeed --help` for the full surface.

## What you publish

A signed manifest at `/.well-known/ai.json` plus per-page `path.aifeed.md` /
`path.mako.md` files with `.sig` sidecars and a delta index — all verifiable offline.
Agents discover it via DNS (`_aifeed` TXT) or `/.well-known/`.

## Next steps

- Spec: [`spec/en/aifeed-v0.2.md`](https://github.com/denyn1/aifeed-protocol/blob/main/spec/en/aifeed-v0.2.md)
- Host adapters (nginx, Caddy, Apache, Node, Next.js, PHP, Python, Go, Traefik, Cloudflare):
  [`integrations/`](https://github.com/denyn1/aifeed-protocol/tree/main/integrations)
- Publisher guide for AI agents: [`docs/publisher-ai-guide.md`](https://github.com/denyn1/aifeed-protocol/blob/main/docs/publisher-ai-guide.md)
- Build plugins for Vite/Astro/Next.js: [`@aifeed/frameworks`](https://www.npmjs.com/package/@aifeed/frameworks)
- Local publisher UI (AIFeed Studio): `npm run studio` in the repository

## Source

Part of [aifeed-protocol](https://github.com/denyn1/aifeed-protocol)
(`packages/aifeed-cli`; `bin/`, `lib/`, `schema/` are generated copies of the
reference implementation via `npm run build:cli`).
