# Live demo origins

<p><a href="demos.md">English</a> · <a href="demos.id.md">Bahasa Indonesia</a> · <a href="demos.zh.md">中文</a></p>

Seven demonstration origins plus the apex site, all served from Cloudflare Pages
(`functions/` routes each subdomain to its generated origin under `site/demos/`).
Everything is generated deterministically by `tools/gen-demos.js` from
[`demos/sites.js`](../demos/sites.js); keys live in [`demos/keys.js`](../demos/keys.js)
and are **intentionally public demo keys** — never reuse them.

| Origin | Profile | Pages | Shows |
|---|---|---|---|
| <https://demo.aifeed.md> | blog | 11 | Full walkthrough: manifest, dual-stack markdown, delta index, `llms.txt`, docs with TOC |
| <https://news.aifeed.md> | news | 13 | Ticker, lead story, category desks, EN/ID `alternates` in signed frontmatter, author pages |
| <https://shop.aifeed.md> | ecommerce | 12 | Product cards with ratings and prices, galleries, cart, policy, media assets |
| <https://gov.aifeed.md> | government | 10 | Service directory with step timelines, announcements, regulation downloads, FAQ |
| <https://strict.aifeed.md> | restrictive | 5 | Search-only policy with **live enforcement**: 403 for training UA, 429 + `Retry-After` for non-compliant crawlers |
| <https://revoked.aifeed.md> | registry | 6 | Multi-signature revocation: `active` vs `suspended` documents, client guide, event timeline |
| <https://verify.aifeed.md> | verifier | 5 | Browser verifier (WebCrypto + DNS-over-HTTPS), coverage matrix, CLI recipes |
| <https://aifeed.md> | docs | — | The apex dogfoods AIFeed: it publishes its own signed manifest |

Each generated origin ships a real information architecture — sticky top bar, grouped navigation,
sidebar/TOC layout, cards, tables, FAQs, timelines, newsletters, and per-page SVG artwork — so the
demo behaves like a complete website, not a single page.

## Verify from the terminal

```bash
# one origin, full agent flow
node examples/agent/compliant-agent.js https://demo.aifeed.md --use retrieval --fetch

# all origins, live
npm run verify:live

# enforcement behaviour (strict)
curl -i -A 'GPTBot/1.0' https://strict.aifeed.md/          # 403
curl -i -A 'Scrapy/2.11' https://strict.aifeed.md/         # 429 + Retry-After
curl -i -H 'Accept: text/aifeed+markdown' https://strict.aifeed.md/   # 200 signed
```

## Regenerate

```bash
npm run demos         # generate site/demos/** + apex artifacts + site/revoke/**
npm run demos:check   # generate, then verify every manifest and revocation document
```

`demos:check` runs inside `npm run verify`. The generated trees are gitignored and
rebuilt on every deploy.

## DNS anchors

Each origin publishes a `_aifeed.<domain>` TXT record with its demo public key and
fingerprint (`v=aifeed1; pk=…; fp=…; manifest=…`). Anchors are created from
`demos/keys.js` during the Cloudflare setup described in
[`deploy-site.md`](deploy-site.md).
