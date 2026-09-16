# AIFeed 30-Day Pilot — Protocol

<p><a href="plan.md">English</a> · <a href="plan.id.md">Bahasa Indonesia</a> · <a href="plan.zh.md">中文</a></p>

Status: **ready to run** (no pilot site yet). All tooling is available; once there is a
real site plus access logs, the execution phase can start.

## Goal

Measure AIFeed's real-world impact on both sides — website owner (bandwidth, CPU,
enforcement) and AI side (bytes, wasted fetches, verification) — beyond the simulation
harness.

## Roles

| Role | Responsibility |
|---|---|
| Site operator | Access logs, plugin install, edge rules (nginx/Caddy/Cloudflare) |
| Analyst | Runs `tools/pilot-report.js`, compiles weekly reports |
| (Optional) AI partner | External AIFeed-aware client; if absent, use the SDK reference crawler |

## Timeline

| Day | Activity | Output |
|---|---|---|
| D-7…D-1 | Baseline: full logs without enforcement, bot classification, manifest+keys copy | `baseline.jsonl` + starting numbers |
| D0 | Enable plugin + edge rules (see `benchmarks/edge/`), verify manifest & MAKO | activation checklist |
| D1–D7 | Week 1: monitor blocks/limits, false positives, errors | weekly report 1 |
| D8–D14 | Week 2: stabilize limits; start recording delta/MAKO | weekly report 2 |
| D15–D21 | Week 3: evaluate referral traffic, user complaints (target: zero) | weekly report 3 |
| D22–D28 | Week 4: signature verification + incident audit | weekly report 4 |
| D29–D30 | Final analysis vs criteria | `pilot-report.md` + go/no-go decision |

## Pass criteria (automatic verdict in `tools/pilot-report.js`)

1. AI bytes (egress to AI bots) drop **≥40%** vs baseline.
2. Human p95 latency does not worsen by **>20%**.
3. Human error rate does not rise by **>0.5 percentage points**.
4. Signature verification: **0 failures** on MAKO requests.
5. Erroneous blocks of legitimate crawlers = 0 (checked manually).

## Ethics & privacy

- Operator-owned sites only; no intervention on third parties.
- Logs are aggregated and anonymized (IPs truncated), retention max 30 days, see
  `instrumentation.md`.
- No blocking of search engine crawlers; classification is limited to the AI classes
  declared in the manifest.
- Results are published as a case study plus methodology, not as statistical claims.

## How to run

```bash
# 1. Prepare JSONL logs (see instrumentation.md)
# 2. Compare baseline vs pilot
node tools/pilot-report.js --baseline pilot/baseline.jsonl --pilot pilot/pilot.jsonl --out pilot/laporan-30-hari.md
# 3. Attach weekly reports (templates/weekly-report.md) as an appendix
```

## Monitored risks

| Risk | Signal | Action |
|---|---|---|
| Erroneous blocking | 403 to legitimate crawlers | loosen classification, retry |
| Rise in 429s to partners | 429 on compliant UAs | check manifest limits vs edge policy |
| Stealth crawling | AI traffic from anonymous UAs rises | rely on behavior (rate/path), not UA |
| Latency increase | human p95 worsens | lower edge limit/CPU load |
