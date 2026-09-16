'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { renderEnforcementHtml } = require('../tools/render-html');

const BENCH_JSON = path.join(__dirname, '..', 'benchmarks', 'enforcement-report.json');

function loadResults() {
  return JSON.parse(fs.readFileSync(BENCH_JSON, 'utf8'));
}

function embeddedData(html) {
  const match = /<script type="application\/json" id="aifeed-data">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match, 'embedded data block present');
  return JSON.parse(match[1]);
}

test('enforcement html renders two-sided savings with embedded measured data', () => {
  const results = loadResults();
  const html = renderEnforcementHtml(results);

  assert.ok(html.startsWith('<!doctype html>'), 'doctype');
  assert.ok(html.includes('Process flow'), 'process tab');
  assert.ok(html.includes('Two-sided savings'), 'two-sided tab');
  assert.ok(html.includes('Web owner / host') && html.includes('AI side'), 'both sides labelled');
  assert.ok(html.includes('prefers-reduced-motion'), 'reduced motion fallback');
  assert.ok(html.includes('aria-selected'), 'accessible tabs');
  assert.ok(html.includes('not a real CDN'), 'honesty banner');
  assert.ok(html.includes('measured-simulation') || html.includes('model'), 'evidence labels');

  const data = embeddedData(html);
  assert.strictEqual(data.single_origin.savings.S3.publisher.bytes_pct, results.single_origin.savings.S3.publisher.bytes_pct);
  assert.strictEqual(data.single_origin.savings.S3.ai.bytes_pct, results.single_origin.savings.S3.ai.bytes_pct);
  assert.strictEqual(data.multi_origin.per_1000_tenants.label, 'model');

  const externalAttributes = (html.match(/(?:src|href)="https?:\/\/[^"\s]*"/g) || []).filter((value) => !value.includes('aifeed.md'));
  assert.deepStrictEqual(externalAttributes, [], 'no external resources');
  assert.ok(Buffer.byteLength(html, 'utf8') < 300 * 1024, 'size cap');
});
