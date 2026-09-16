# Pilot Instrumentation — Log Schema & Privacy

<p><a href="instrumentation.md">English</a> · <a href="instrumentation.id.md">Bahasa Indonesia</a> · <a href="instrumentation.zh.md">中文</a></p>

`tools/pilot-report.js` reads **JSONL** (one JSON per line). One line = one normalized
request.

## Schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `ts` | string | yes | ISO 8601 time (UTC) |
| `host` | string | yes | domain/tenant |
| `path` | string | yes | request path (no query) |
| `profile` | enum | yes | `human`, `search`, `training`, `plain`, `ai_other`, `compliant` |
| `status` | integer | yes | HTTP code (403/429/200/5xx) |
| `bytes` | integer | yes | response body bytes |
| `ms` | number | no | request duration (human p95) |
| `mako` | boolean | no | `true` when the response is `text/mako+markdown` |
| `verified` | boolean/null | no | `true/false` when the client verifies signatures; `null` when absent |

Example:

```jsonl
{"ts":"2026-10-01T08:00:01Z","host":"example.com","path":"/p/1","profile":"human","status":200,"bytes":41230,"ms":84}
{"ts":"2026-10-01T08:00:02Z","host":"example.com","path":"/p/1","profile":"training","status":403,"bytes":30,"ms":3}
{"ts":"2026-10-01T08:00:03Z","host":"example.com","path":"/p/2","profile":"compliant","status":200,"bytes":5820,"ms":12,"mako":true,"verified":true}
```

## How to collect

### nginx (JSON access log)

```nginx
log_format aifeed_json escape=json
  '{"ts":"$time_iso8601","host":"$host","path":"$uri","profile":"$aifeed_profile",'
  '"status":$status,"bytes":$body_bytes_sent,"ms":$request_time}';
access_log /var/log/nginx/aifeed.jsonl aifeed_json;
```

`$aifeed_profile` comes from the classification map in
`benchmarks/edge/nginx.conf.template`. Add `"mako":$mako_served` if you have a marker
(e.g. via an Accept map), and `"verified"` only when the edge actually verifies
signatures.

### WordPress + harness

- The AIFeed plugin serves MAKO; mark `mako` on `Accept: text/mako+markdown`.
- `verified` can be filled by the reference crawler (SDK `@aifeed/verify`) writing a
  separate log that is later merged.
- For the baseline, run without edge rules; for the pilot, enable the edge rules.

### Bot classification

Priority: (1) known signature/UA, (2) behavior (rate, concurrency, path patterns),
(3) `ai_other` fallback. UAs can be spoofed — document the assumption in the report.

## Privacy

- **Anonymize**: IPs are not in the schema; if needed, store a one-way hash with daily
  rotation and never publish it.
- **Aggregate**: reports contain only aggregate numbers per profile; no individual paths.
- **Retention**: max 30 days, then delete; keep only aggregate reports.
- **Compliance**: align with the site's privacy policy and local law.

## Processing

```bash
node tools/pilot-report.js --baseline pilot/baseline.jsonl --pilot pilot/pilot.jsonl --out pilot/laporan-30-hari.md
```

The output contains two-sided savings tables (web owner & AI), enforcement (403/429),
signature verification, human metrics (p95, error rate), and the automatic verdict with
the pilot's target thresholds.

## Honest limits

- AI numbers from the publisher side (logs) are **measured**; AI-side per-request savings
  from MAKO/HTML byte comparison are **estimates** (label included).
- Origin CPU in the report is a **model** (mean latency × requests), not a direct CPU
  measurement.
- Logs cannot prove a bot's purpose (training vs retrieval); classification is an
  approximation that must be stated openly.
