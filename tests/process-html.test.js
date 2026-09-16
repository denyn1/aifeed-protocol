'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { renderProcessHtml } = require('../tools/render-html');

const MAKO_BENCH = {
  savings: {
    mako_vs_html_percent: 68.83,
    delta_vs_html_percent: 95.73,
    delta_vs_mako_percent: 86.31
  }
};

const ENFORCEMENT = {
  single_origin: {
    savings: {
      S3: {
        publisher: { bytes_pct: 55.19 },
        ai: { bytes_pct: 54.84, verify_cpu_ms_per_page: 0.703 }
      }
    }
  }
};

test('process html animates the protocol flow and embeds real savings', () => {
  const html = renderProcessHtml({ makoBench: MAKO_BENCH, enforcement: ENFORCEMENT });

  assert.ok(html.startsWith('<!doctype html>'), 'doctype');
  assert.ok(html.includes('How AIFeed Works'), 'title');
  assert.ok(html.includes('With AIFeed') && html.includes('Without AIFeed'), 'mode toggle');
  assert.ok(html.includes('Delta consumption'), 'delta chapter');
  assert.ok(html.includes('prefers-reduced-motion'), 'reduced motion fallback');
  assert.ok(html.includes('measured'), 'evidence legend');

  const match = /<script type="application\/json" id="aifeed-data">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match, 'embedded data block');
  const data = JSON.parse(match[1]);
  assert.strictEqual(data.savings.mako_vs_html, 68.83);
  assert.strictEqual(data.savings.delta_vs_html, 95.73);
  assert.strictEqual(data.savings.enforcement_publisher_bytes, 55.19);
  assert.ok(data.steps.length >= 10, 'protocol chapters present');
  assert.ok(data.steps.some((step) => step.id === 'delta'), 'delta step present');

  const externalAttributes = (html.match(/(?:src|href)="https?:\/\/[^"\s]*"/g) || []).filter((value) => !value.includes('aifeed.md'));
  assert.deepStrictEqual(externalAttributes, [], 'no external resources');
  assert.ok(Buffer.byteLength(html, 'utf8') < 300 * 1024, 'size cap');
});
