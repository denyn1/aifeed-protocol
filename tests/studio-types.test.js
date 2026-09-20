'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const policyLib = require('../studio/lib/policy');
const { presetPolicy, presetForType, PRESET_NAMES } = require('../studio/lib/presets');
const { Workspace } = require('../studio/workspace');
const { publishProject } = require('../studio/lib/publish');
const { verifyBuild } = require('../studio/lib/verify');

function makeWorkspace() {
  return new Workspace(fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-types-')));
}

test('site type presets map types and produce restrict-only policies', () => {
  assert.strictEqual(presetForType('news'), 'news');
  assert.strictEqual(presetForType('ecommerce'), 'ecommerce');
  assert.strictEqual(presetForType('saas'), 'blog');
  const news = presetPolicy('news');
  assert.strictEqual(news.usage.translate, 'allow');
  assert.strictEqual(news.usage.training, 'deny');
  assert.strictEqual(news.attribution, 'required');
  const economy = presetPolicy('ecommerce');
  assert.strictEqual(economy.usage.embed, 'allow');
  assert.strictEqual(economy.usage.commercial_use, 'deny');
  const strict = presetPolicy('restrictive');
  assert.strictEqual(strict.usage.search, 'allow');
  assert.strictEqual(strict.usage.retrieval, 'deny');
  assert.ok(PRESET_NAMES.includes('open'));
});

test('workspace.create applies the preset policy', () => {
  const workspace = makeWorkspace();
  const created = workspace.create({ domain: 'news.example', name: 'News', type: 'news' });
  assert.strictEqual(created.preset, 'news');
  assert.strictEqual(created.freshness, true);
  const policy = workspace.policy(created.id);
  assert.strictEqual(policy.usage.translate, 'allow');
  assert.strictEqual(policy.usage.training, 'deny');
  const shop = workspace.create({ domain: 'shop.example', name: 'Shop', type: 'ecommerce', preset: 'ecommerce' });
  assert.strictEqual(workspace.policy(shop.id).usage.embed, 'allow');
});

test('page types resolve by longest pattern and validate', () => {
  const pageTypes = [
    { pattern: '/products/**', type: 'product' },
    { pattern: '/products/sale/**', type: 'listing' },
    { pattern: '/blog/**', type: 'article' }
  ];
  assert.deepStrictEqual(policyLib.validatePageTypes(pageTypes), []);
  assert.strictEqual(policyLib.resolvePageType(pageTypes, '/products/sale/x'), 'listing');
  assert.strictEqual(policyLib.resolvePageType(pageTypes, '/products/a'), 'product');
  assert.strictEqual(policyLib.resolvePageType(pageTypes, '/about'), null);
  assert.ok(policyLib.validatePageTypes([{ pattern: '/x/**', type: 'widget' }]).some((message) => message.includes('type')));
  assert.ok(policyLib.validatePageTypes([{ pattern: 'x', type: 'product' }]).some((message) => message.includes('pattern')));
});

test('publish applies page types and freshness dates/tags when enabled', () => {
  const workspace = makeWorkspace();
  const created = workspace.create({ domain: 'fresh.example', name: 'Fresh', type: 'news' });
  const paths = workspace.paths(created.id);
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-fresh-'));
  fs.mkdirSync(path.join(source, 'produk'));
  fs.writeFileSync(path.join(source, 'produk', 'satu.html'),
    '<html lang="id"><head><title>Produk Satu</title>' +
    '<meta property="article:modified_time" content="2026-01-02T03:04:05Z">' +
    '<meta name="keywords" content="ai, feed, mako"></head>' +
    '<body><main><h1>Produk Satu</h1><p>Isi.</p></main></body></html>');

  const pageTypes = [{ pattern: '/produk/**', type: 'product' }];
  const fresh = publishProject({
    project: { ...created, page_types: pageTypes, freshness: true },
    policy: workspace.policy(created.id),
    sourceDir: source,
    outDir: paths.outDir,
    keyPath: paths.keyPath,
    statePath: paths.statePath,
    pageTypes,
    freshness: true
  });
  assert.strictEqual(fresh.processed, 1);
  const md = fs.readFileSync(path.join(paths.outDir, 'produk', 'satu.aifeed.md'), 'utf8');
  assert.ok(md.includes('type: "product"'), md.split('---')[1]);
  assert.ok(md.includes('updated: "2026-01-02"'));
  assert.ok(md.includes('ai'));
  const index = JSON.parse(fs.readFileSync(path.join(paths.outDir, '.well-known', 'aifeed-index.json'), 'utf8'));
  assert.strictEqual(index.entries[0].type, 'product');
  assert.strictEqual(index.entries[0].updated, '2026-01-02');

  const noFresh = publishProject({
    project: { ...created, page_types: pageTypes, freshness: false },
    policy: workspace.policy(created.id),
    sourceDir: source,
    outDir: paths.outDir,
    keyPath: paths.keyPath,
    statePath: paths.statePath,
    pageTypes,
    freshness: false
  });
  assert.strictEqual(noFresh.processed, 1, 'content hash change forces rebuild');
  const md2 = fs.readFileSync(path.join(paths.outDir, 'produk', 'satu.aifeed.md'), 'utf8');
  assert.ok(md2.includes('updated: "' + new Date().toISOString().slice(0, 10) + '"'));

  const report = verifyBuild({ outDir: paths.outDir, domain: created.domain, keyPath: paths.keyPath });
  assert.strictEqual(report.result, 'VERIFIED', JSON.stringify(report));
});

test('old state versions are not reused (one full rebuild)', () => {
  const workspace = makeWorkspace();
  const created = workspace.create({ domain: 'state.example', name: 'State' });
  const paths = workspace.paths(created.id);
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-state-'));
  fs.writeFileSync(path.join(source, 'index.html'), '<html lang="en"><head><title>Home</title></head><body><main><h1>Home</h1></main></body></html>');
  const base = {
    project: created,
    policy: workspace.policy(created.id),
    sourceDir: source,
    outDir: paths.outDir,
    keyPath: paths.keyPath,
    statePath: paths.statePath
  };
  assert.strictEqual(publishProject(base).processed, 1);
  assert.strictEqual(publishProject({ ...base, previousState: workspace.state(created.id) }).skipped, 1);
  const stale = workspace.state(created.id);
  stale.version = 1;
  workspace.saveState(created.id, stale);
  assert.strictEqual(publishProject({ ...base, previousState: workspace.state(created.id) }).processed, 1);
});
