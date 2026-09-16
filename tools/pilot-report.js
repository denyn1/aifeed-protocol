#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const AI_PROFILES = ['training', 'plain', 'ai_other', 'compliant'];
const HUMAN_PROFILES = ['human', 'search'];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const equals = item.indexOf('=');
    if (equals !== -1) {
      args[item.slice(2, equals)] = item.slice(equals + 1);
    } else {
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[item.slice(2)] = next;
        index++;
      } else {
        args[item.slice(2)] = true;
      }
    }
  }
  return args;
}

function parseJsonl(text) {
  const entries = [];
  const lines = String(text).split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line === '') continue;
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      throw new Error('invalid JSONL at line ' + (index + 1) + ': ' + error.message);
    }
  }
  return entries;
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

function profileOf(entry) {
  const profile = typeof entry.profile === 'string' ? entry.profile : 'human';
  return profile;
}

function summarize(entries) {
  const stats = {
    total: {
      requests: 0,
      bytes: 0,
      errors: 0,
      blocks: 0,
      limits: 0,
      mako_requests: 0,
      verified: 0,
      verify_failed: 0,
      verify_absent: 0,
      latency_sum: 0,
      latency_count: 0,
      latencies: []
    },
    by_profile: {}
  };
  for (const profile of [...AI_PROFILES, ...HUMAN_PROFILES, 'other']) {
    stats.by_profile[profile] = {
      requests: 0,
      bytes: 0,
      errors: 0,
      blocks: 0,
      limits: 0,
      mako_requests: 0,
      verified: 0,
      verify_failed: 0,
      latency_sum: 0,
      latency_count: 0,
      latencies: []
    };
  }
  for (const entry of entries) {
    const profile = profileOf(entry);
    const bucket = stats.by_profile[profile] || stats.by_profile.other;
    const bytes = Number(entry.bytes) || 0;
    const status = Number(entry.status) || 0;
    const ms = Number(entry.ms);
    for (const target of [stats.total, bucket]) {
      target.requests++;
      target.bytes += bytes;
      if (status >= 500) target.errors++;
      if (status === 403) target.blocks++;
      if (status === 429) target.limits++;
      if (entry.mako === true) target.mako_requests++;
      if (entry.verified === true) target.verified++;
      if (entry.verified === false) target.verify_failed++;
      if (entry.verified === null || entry.verified === undefined) target.verify_absent++;
      if (Number.isFinite(ms)) {
        target.latency_sum += ms;
        target.latency_count++;
        target.latencies.push(ms);
      }
    }
  }
  for (const bucket of [stats.total, ...Object.values(stats.by_profile)]) {
    bucket.p95_ms = percentile(bucket.latencies, 0.95);
    bucket.mean_ms = bucket.latency_count > 0 ? Number((bucket.latency_sum / bucket.latency_count).toFixed(2)) : null;
    delete bucket.latencies;
  }
  return stats;
}

function aiTotals(stats) {
  return AI_PROFILES.reduce((accumulator, profile) => {
    const bucket = stats.by_profile[profile] || {};
    accumulator.requests += bucket.requests || 0;
    accumulator.bytes += bucket.bytes || 0;
    accumulator.blocks += bucket.blocks || 0;
    accumulator.limits += bucket.limits || 0;
    accumulator.mako_requests += bucket.mako_requests || 0;
    accumulator.verified += bucket.verified || 0;
    accumulator.verify_failed += bucket.verify_failed || 0;
    return accumulator;
  }, { requests: 0, bytes: 0, blocks: 0, limits: 0, mako_requests: 0, verified: 0, verify_failed: 0 });
}

function humanTotals(stats) {
  return HUMAN_PROFILES.reduce((accumulator, profile) => {
    const bucket = stats.by_profile[profile] || {};
    accumulator.requests += bucket.requests || 0;
    accumulator.bytes += bucket.bytes || 0;
    accumulator.errors += bucket.errors || 0;
    if (bucket.p95_ms !== null && bucket.p95_ms !== undefined) {
      accumulator.p95_values.push(bucket.p95_ms);
    }
    return accumulator;
  }, { requests: 0, bytes: 0, errors: 0, p95_values: [] });
}

function pct(baseline, current) {
  if (!baseline || baseline <= 0) return null;
  return Number((100 * (1 - current / baseline)).toFixed(2));
}

function compare(baselineStats, pilotStats) {
  const baselineAi = aiTotals(baselineStats);
  const pilotAi = aiTotals(pilotStats);
  const baselineHuman = humanTotals(baselineStats);
  const pilotHuman = humanTotals(pilotStats);
  const baselineMakoBytes = baselineStats.total.mako_requests > 0
    ? baselineStats.total.bytes / Math.max(1, baselineStats.total.requests)
    : null;
  const pilotMakoBytes = pilotStats.total.mako_requests > 0
    ? pilotStats.total.bytes / Math.max(1, pilotStats.total.requests)
    : null;
  return {
    publisher: {
      ai_bytes_baseline: baselineAi.bytes,
      ai_bytes_pilot: pilotAi.bytes,
      ai_bytes_saved_pct: pct(baselineAi.bytes, pilotAi.bytes),
      ai_requests_baseline: baselineAi.requests,
      ai_requests_pilot: pilotAi.requests,
      ai_requests_saved_pct: pct(baselineAi.requests, pilotAi.requests),
      blocked: pilotAi.blocks,
      limited: pilotAi.limits,
      origin_cpu_ms_saved_model: Number(((baselineAi.requests * (baselineStats.total.mean_ms || 0)) -
        (pilotAi.requests * (pilotStats.total.mean_ms || 0))).toFixed(2))
    },
    ai: {
      mako_requests: pilotAi.mako_requests,
      verified: pilotAi.verified,
      verify_failed: pilotAi.verify_failed,
      verify_success_pct: (pilotAi.verified + pilotAi.verify_failed) > 0
        ? Number((100 * pilotAi.verified / (pilotAi.verified + pilotAi.verify_failed)).toFixed(2))
        : null,
      per_request_bytes_estimate_pct: baselineMakoBytes && pilotMakoBytes
        ? pct(baselineMakoBytes, pilotMakoBytes)
        : null
    },
    human: {
      requests_baseline: baselineHuman.requests,
      requests_pilot: pilotHuman.requests,
      error_rate_baseline_pct: baselineHuman.requests > 0 ? Number((100 * baselineHuman.errors / baselineHuman.requests).toFixed(2)) : 0,
      error_rate_pilot_pct: pilotHuman.requests > 0 ? Number((100 * pilotHuman.errors / pilotHuman.requests).toFixed(2)) : 0,
      p95_baseline_ms: baselineHuman.p95_values.length ? Math.max(...baselineHuman.p95_values) : null,
      p95_pilot_ms: pilotHuman.p95_values.length ? Math.max(...pilotHuman.p95_values) : null
    }
  };
}

function verdict(comparison) {
  const reasons = [];
  const publisherSavings = comparison.publisher.ai_bytes_saved_pct;
  if (publisherSavings === null || publisherSavings < 40) {
    reasons.push('AI byte savings below the 40% pilot target (got ' + publisherSavings + '%)');
  }
  const p95Worse = comparison.human.p95_baseline_ms && comparison.human.p95_pilot_ms &&
    comparison.human.p95_pilot_ms > comparison.human.p95_baseline_ms * 1.2;
  if (p95Worse) {
    reasons.push('human p95 latency degraded by more than 20%');
  }
  if (comparison.human.error_rate_pilot_pct > comparison.human.error_rate_baseline_pct + 0.5) {
    reasons.push('human error rate increased by more than 0.5 percentage points');
  }
  if (comparison.ai.verify_failed > 0) {
    reasons.push(comparison.ai.verify_failed + ' signature verification failures observed');
  }
  return { pass: reasons.length === 0, reasons };
}

function renderReport(comparison, verdictResult, options = {}) {
  const rows = [];
  rows.push('# Laporan Pilot AIFeed 30 Hari');
  rows.push('');
  rows.push('> Sumber: log akses teragregasi (`pilot/instrumentation.md`). Label: **terukur** (dari log), **model** (ekstrapolasi), **estimasi** (proxy).');
  rows.push('');
  rows.push('## Penghematan Dua Sisi');
  rows.push('');
  rows.push('| Sisi | Metrik | Baseline | Pilot | Perubahan |');
  rows.push('| --- | --- | ---: | ---: | ---: |');
  rows.push('| Pemilik web / host | Byte AI | ' + comparison.publisher.ai_bytes_baseline + ' | ' + comparison.publisher.ai_bytes_pilot + ' | ' + comparison.publisher.ai_bytes_saved_pct + '% |');
  rows.push('| Pemilik web / host | Request AI | ' + comparison.publisher.ai_requests_baseline + ' | ' + comparison.publisher.ai_requests_pilot + ' | ' + comparison.publisher.ai_requests_saved_pct + '% |');
  rows.push('| Pemilik web / host | CPU origin (model) | — | — | ' + comparison.publisher.origin_cpu_ms_saved_model + ' ms |');
  rows.push('| Sisi AI | Request MAKO | — | ' + comparison.ai.mako_requests + ' | — |');
  rows.push('| Sisi AI | Verifikasi lulus | — | ' + comparison.ai.verified + ' | ' + (comparison.ai.verify_success_pct === null ? '—' : comparison.ai.verify_success_pct + '%') + ' |');
  rows.push('| Sisi AI | Byte per request (estimasi) | — | — | ' + (comparison.ai.per_request_bytes_estimate_pct === null ? '—' : comparison.ai.per_request_bytes_estimate_pct + '%') + ' |');
  rows.push('| Manusia | p95 latency | ' + (comparison.human.p95_baseline_ms || '—') + ' ms | ' + (comparison.human.p95_pilot_ms || '—') + ' ms | — |');
  rows.push('| Manusia | Error rate | ' + comparison.human.error_rate_baseline_pct + '% | ' + comparison.human.error_rate_pilot_pct + '% | — |');
  rows.push('');
  rows.push('## Penegakan');
  rows.push('');
  rows.push('- Blokir 403: ' + comparison.publisher.blocked);
  rows.push('- Pembatasan 429: ' + comparison.publisher.limited);
  rows.push('');
  rows.push('## Verdict');
  rows.push('');
  rows.push(verdictResult.pass ? '**LULUS** — metrik utama memenuhi target pilot.' : '**BELUM LULUS** — alasan:');
  for (const reason of verdictResult.reasons) {
    rows.push('- ' + reason);
  }
  rows.push('');
  rows.push('## Catatan');
  rows.push('');
  rows.push('- Pilot adalah studi kasus satu penerbit, bukan klaim statistik populasi.');
  rows.push('- Log mencakup request asli; klasifikasi bot berbasis UA + perilaku (lihat instrumentation).');
  if (options.note) {
    rows.push('- ' + options.note);
  }
  rows.push('');
  return rows.join('\n');
}

function main(argv) {
  const args = parseArgs(argv || process.argv.slice(2));
  if (!args.baseline || !args.pilot) {
    process.stderr.write('usage: node tools/pilot-report.js --baseline baseline.jsonl --pilot pilot.jsonl [--out report.md]\n');
    return 2;
  }
  const baseline = summarize(parseJsonl(fs.readFileSync(args.baseline, 'utf8')));
  const pilot = summarize(parseJsonl(fs.readFileSync(args.pilot, 'utf8')));
  const comparison = compare(baseline, pilot);
  const verdictResult = verdict(comparison);
  const report = renderReport(comparison, verdictResult);
  if (args.out) {
    fs.writeFileSync(args.out, report, 'utf8');
    process.stdout.write('pilot report written: ' + args.out + '\n');
  } else {
    process.stdout.write(report);
  }
  process.stdout.write('verdict: ' + (verdictResult.pass ? 'PASS' : 'FAIL') + '\n');
  return verdictResult.pass ? 0 : 1;
}

module.exports = { parseJsonl, summarize, compare, verdict, renderReport, AI_PROFILES };

if (require.main === module) {
  process.exitCode = main();
}
