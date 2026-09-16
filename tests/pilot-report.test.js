'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parseJsonl, summarize, compare, verdict, renderReport } = require('../tools/pilot-report');

const BASELINE = [
  { ts: '2026-10-01T08:00:00Z', host: 'example.com', path: '/p/1', profile: 'human', status: 200, bytes: 40000, ms: 80 },
  { ts: '2026-10-01T08:00:01Z', host: 'example.com', path: '/p/2', profile: 'human', status: 200, bytes: 41000, ms: 90 },
  { ts: '2026-10-01T08:00:02Z', host: 'example.com', path: '/p/3', profile: 'human', status: 200, bytes: 42000, ms: 100 },
  { ts: '2026-10-01T08:00:03Z', host: 'example.com', path: '/p/4', profile: 'human', status: 200, bytes: 43000, ms: 110 },
  { ts: '2026-10-01T08:00:04Z', host: 'example.com', path: '/p/5', profile: 'human', status: 200, bytes: 44000, ms: 120 },
  { ts: '2026-10-01T08:00:05Z', host: 'example.com', path: '/p/1', profile: 'search', status: 200, bytes: 40000, ms: 70 },
  { ts: '2026-10-01T08:00:06Z', host: 'example.com', path: '/p/1', profile: 'training', status: 200, bytes: 40000, ms: 40 },
  { ts: '2026-10-01T08:00:07Z', host: 'example.com', path: '/p/2', profile: 'training', status: 200, bytes: 40000, ms: 41 },
  { ts: '2026-10-01T08:00:08Z', host: 'example.com', path: '/p/3', profile: 'training', status: 200, bytes: 40000, ms: 42 },
  { ts: '2026-10-01T08:00:09Z', host: 'example.com', path: '/p/4', profile: 'plain', status: 200, bytes: 40000, ms: 43 },
  { ts: '2026-10-01T08:00:10Z', host: 'example.com', path: '/p/5', profile: 'plain', status: 200, bytes: 40000, ms: 44 }
];

const PILOT = [
  { ts: '2026-11-01T08:00:00Z', host: 'example.com', path: '/p/1', profile: 'human', status: 200, bytes: 40000, ms: 82 },
  { ts: '2026-11-01T08:00:01Z', host: 'example.com', path: '/p/2', profile: 'human', status: 200, bytes: 41000, ms: 88 },
  { ts: '2026-11-01T08:00:02Z', host: 'example.com', path: '/p/3', profile: 'human', status: 200, bytes: 42000, ms: 96 },
  { ts: '2026-11-01T08:00:03Z', host: 'example.com', path: '/p/4', profile: 'human', status: 200, bytes: 43000, ms: 104 },
  { ts: '2026-11-01T08:00:04Z', host: 'example.com', path: '/p/5', profile: 'human', status: 200, bytes: 44000, ms: 118 },
  { ts: '2026-11-01T08:00:05Z', host: 'example.com', path: '/p/1', profile: 'search', status: 200, bytes: 40000, ms: 72 },
  { ts: '2026-11-01T08:00:06Z', host: 'example.com', path: '/p/1', profile: 'training', status: 403, bytes: 30, ms: 3 },
  { ts: '2026-11-01T08:00:07Z', host: 'example.com', path: '/p/2', profile: 'training', status: 403, bytes: 30, ms: 3 },
  { ts: '2026-11-01T08:00:08Z', host: 'example.com', path: '/p/3', profile: 'training', status: 403, bytes: 30, ms: 3 },
  { ts: '2026-11-01T08:00:09Z', host: 'example.com', path: '/p/4', profile: 'plain', status: 429, bytes: 20, ms: 4 },
  { ts: '2026-11-01T08:00:10Z', host: 'example.com', path: '/p/5', profile: 'plain', status: 429, bytes: 20, ms: 4 },
  { ts: '2026-11-01T08:00:11Z', host: 'example.com', path: '/p/1', profile: 'compliant', status: 200, bytes: 5000, ms: 12, mako: true, verified: true },
  { ts: '2026-11-01T08:00:12Z', host: 'example.com', path: '/p/2', profile: 'compliant', status: 200, bytes: 5000, ms: 12, mako: true, verified: true }
];

test('pilot report computes two-sided savings and passes verdict', () => {
  const baseline = summarize(BASELINE);
  const pilot = summarize(PILOT);
  const comparison = compare(baseline, pilot);
  const result = verdict(comparison);

  assert.ok(comparison.publisher.ai_bytes_saved_pct > 90, 'AI bytes drop sharply, got ' + comparison.publisher.ai_bytes_saved_pct);
  assert.ok(comparison.publisher.blocked >= 3, 'training blocks recorded');
  assert.ok(comparison.publisher.limited >= 2, 'rate limits recorded');
  assert.strictEqual(comparison.ai.verified, 2);
  assert.strictEqual(comparison.ai.verify_failed, 0);
  assert.strictEqual(comparison.ai.verify_success_pct, 100);
  assert.ok(result.pass, 'verdict passes: ' + result.reasons.join('; '));

  const report = renderReport(comparison, result);
  assert.ok(report.includes('Penghematan Dua Sisi'), 'report section present');
  assert.ok(report.includes('LULUS'), 'verdict text present');
});

test('pilot verdict fails on human regression and verification errors', () => {
  const baseline = summarize(BASELINE);
  const degraded = summarize(PILOT.map((entry) => (
    entry.profile === 'human' ? { ...entry, ms: entry.ms * 3 } : entry
  )).concat([{ ts: '2026-11-01T08:00:13Z', host: 'example.com', path: '/p/3', profile: 'compliant', status: 200, bytes: 5000, mako: true, verified: false }]));
  const comparison = compare(baseline, degraded);
  const result = verdict(comparison);
  assert.strictEqual(result.pass, false);
  assert.ok(result.reasons.some((reason) => reason.includes('p95')));
  assert.ok(result.reasons.some((reason) => reason.includes('verification')));
});

test('jsonl parsing rejects malformed lines', () => {
  assert.throws(() => parseJsonl('{"a":1}\nnot-json\n'), /invalid JSONL/);
  assert.strictEqual(parseJsonl('{"a":1}\n\n{"b":2}\n').length, 2);
});
