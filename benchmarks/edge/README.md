# Edge enforcement templates (nginx / Caddy)

<p><a href="README.md">English</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.zh.md">中文</a></p>

Production-side parity templates for the policy exercised by
`tools/bench-enforcement.js`. The harness proves the policy logic on loopback; these
files let you reproduce it on a VPS with real clients.

## Files

| File | Target |
|---|---|
| `nginx.conf.template` | nginx (no extra modules; static limits via maps) |
| `Caddyfile.template` | Caddy (403 rule works out of the box; rate limiting needs `caddy-ratelimit`) |

Replace `ORIGIN_HOST`/`ORIGIN_PORT` with your upstream, review the limits, then run on
a staging host before production. Never block search engine crawlers: keep the
classification list limited to AI training/user-agent classes you intend to deny.

## Manifest to edge mapping

| Manifest field | nginx | Caddy |
|---|---|---|
| `permissions.usage.training: deny` | `map ... training -> 403` | `@training` matcher + `respond 403` |
| `limits.requests_per_minute` | `limit_req_zone ... rate=15r/m` | `rate_limit ... events 15, window 1m` |
| `limits.concurrent` | `limit_conn_zone` + `limit_conn 2` | `rate_limit ... events 2, window 1s` |
| Exempt humans and AIFeed-aware clients | key is empty for those profiles | matcher-scoped limits |
| `/.well-known/ai.json` and `/.well-known/mako-index.json` always readable | well-known map keeps key empty | `@wellknown` handle first |

`Retry-After: 2` accompanies `429` responses, matching the harness.

## Verification procedure

1. Run the local harness and keep its numbers as the reference:
   ```bash
   cd aifeed-protocol
   npm run bench:enforcement
   ```
2. Deploy the template to a staging VPS with a real origin (WordPress plugin, static
   site, or the harness corpus behind a file server).
3. Send the same client shapes and compare:
   ```bash
   # training crawler must receive 403
   curl -s -o /dev/null -w '%{http_code}\n' -A 'GPTBot/1.0' https://staging.example/p/1

   # plain crawler must receive 429 after the threshold, with Retry-After
   for i in $(seq 1 20); do
     curl -s -o /dev/null -D - -A 'CrawlerX/1.0' https://staging.example/p/1 | grep -E 'HTTP|Retry-After'
   done

   # compliant client and humans stay 200
   curl -s -o /dev/null -w '%{http_code}\n' -A 'AIFeedBot/0.3' https://staging.example/p/1
   curl -s -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0' https://staging.example/p/1
   ```
4. Record results with the same metrics the harness reports (requests, bytes, CPU,
   blocked, limited, human p95) and attach them to the pilot kit
   (`pilot/instrumentation.md`).

## Expected outcomes

- Training crawlers: `403` on content, `200` on `/.well-known/*` (they may still read
  the declaration; the manifest is the public contract).
- Non-compliant crawlers: `429` + `Retry-After` after the limit, then recovery.
- Humans and `AIFeedBot`: unaffected (`200`), p95 latency within normal variance.
- Publisher egress and origin CPU drop roughly in line with the harness S1–S3 numbers
  (see `benchmarks/enforcement-report.md` for the measured simulation values).

## Caveats

- Static limits: when the signed manifest changes, update and reload the edge config.
  Fully dynamic per-manifest policy needs OpenResty/njs, Caddy plugins, or the AIFeed
  PDP middleware.
- CDN fronting (Cloudflare etc.) may normalize or strip `User-Agent`; classify on
  behavior (rate/concurrency/paths) where possible and document the fallback.
- Templates are a starting point, not a certified WAF configuration; test before
  enabling on production traffic.
