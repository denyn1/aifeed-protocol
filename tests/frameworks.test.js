'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { buildFrameworks } = require('../tools/build-frameworks');

buildFrameworks();

const frameworks = require('../packages/aifeed-frameworks');
const viteAifeed = require('../packages/aifeed-frameworks/vite');
const astroAifeed = require('../packages/aifeed-frameworks/astro');
const withAifeed = require('../packages/aifeed-frameworks/next');
const sdk = require('../packages/aifeed-verify');

const CLI = path.join(__dirname, '..', 'packages', 'aifeed-frameworks', 'cli.js');
const NEXT_CLI = path.join(__dirname, '..', 'packages', 'aifeed-frameworks', 'next-cli.js');
const DOMAIN = 'static.example';

function makeSite() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-fw-'));
  const dist = path.join(root, 'dist');
  fs.mkdirSync(path.join(dist, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(dist, 'files'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), [
    '<!doctype html><html lang="en"><head><title>Home</title>',
    '<meta name="description" content="Fixture home."></head>',
    '<body><main><h1>Home</h1><p>Hello.</p></main></body></html>'
  ].join('\n'));
  fs.writeFileSync(path.join(dist, 'docs', 'cli.html'), [
    '<!doctype html><html lang="en"><head><title>CLI</title></head>',
    '<body><main><h1>CLI</h1>',
    '<p><a href="/files/report.pdf" download>Report</a></p></main></body></html>'
  ].join('\n'));
  fs.writeFileSync(path.join(dist, 'files', 'report.pdf'), '%PDF-1.4 fixture\n');
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), '<?xml version="1.0"?><urlset></urlset>\n');
  const key = frameworks.keygen({ out: root });
  return { root, dist, keyPath: key.private_key };
}

function verifyDist(dist) {
  return sdk.verifyDirectory(path.join(dist, '.well-known'), { domain: DOMAIN });
}

test('frameworks package ships plugins, CLIs, and zero dependencies', () => {
  const pkg = require('../packages/aifeed-frameworks/package.json');
  assert.strictEqual(pkg.name, '@aifeed/frameworks');
  assert.strictEqual(pkg.bin['aifeed-build'], 'cli.js');
  assert.strictEqual(pkg.bin['aifeed-next'], 'next-cli.js');
  assert.ok(!('dependencies' in pkg) && !('devDependencies' in pkg), 'zero-dependency rule');
  for (const entry of ['./vite', './astro', './next']) {
    assert.ok(pkg.exports[entry], 'exports ' + entry);
  }
  assert.strictEqual(typeof viteAifeed, 'function');
  assert.strictEqual(typeof astroAifeed, 'function');
  assert.strictEqual(typeof withAifeed, 'function');
  assert.strictEqual(typeof frameworks.runBuild, 'function');
  assert.strictEqual(typeof frameworks.keygen, 'function');
});

test('vite plugin signs the build output, injects alternates, and self-verifies', () => {
  const site = makeSite();
  const plugin = viteAifeed({ domain: DOMAIN, keyPath: site.keyPath });
  plugin.configResolved({ root: site.root, build: { outDir: 'dist' } });
  const summary = plugin.closeBundle();

  assert.strictEqual(summary.pages.length, 2);
  assert.strictEqual(verifyDist(site.dist).result, 'VERIFIED');

  const index = JSON.parse(fs.readFileSync(path.join(site.dist, '.well-known', 'aifeed-index.json'), 'utf8'));
  const page = index.entries.find((entry) => entry.url === '/docs/cli');
  assert.strictEqual(page.assets, 1, 'index exposes the asset count');

  const md = fs.readFileSync(path.join(site.dist, 'docs', 'cli.aifeed.md'), 'utf8');
  assert.ok(md.includes('mime: "application/pdf"'), 'asset mime recorded');
  assert.ok(md.includes('sha-256:'), 'asset digest recorded');

  const html = fs.readFileSync(path.join(site.dist, 'docs', 'cli.html'), 'utf8');
  assert.ok(html.includes('type="text/aifeed+markdown"'), 'alternate link injected');
  assert.strictEqual((html.match(/rel="alternate"/g) || []).length, 1, 'injection is idempotent');
  assert.ok(fs.existsSync(path.join(site.dist, 'llms.txt')), 'llms.txt written');

  plugin.closeBundle();
  const twice = fs.readFileSync(path.join(site.dist, 'docs', 'cli.html'), 'utf8');
  assert.strictEqual((twice.match(/rel="alternate"/g) || []).length, 1, 'still idempotent after rebuild');
});

test('astro integration signs the build directory URL', () => {
  const site = makeSite();
  const integration = astroAifeed({ domain: DOMAIN, keyPath: site.keyPath, inject: false });
  assert.strictEqual(integration.name, 'aifeed');
  integration.hooks['astro:build:done']({ dir: pathToFileURL(site.dist) });

  assert.strictEqual(verifyDist(site.dist).result, 'VERIFIED');
  const html = fs.readFileSync(path.join(site.dist, 'index.html'), 'utf8');
  assert.ok(!html.includes('rel="alternate"'), 'inject: false keeps HTML untouched');
  assert.ok(fs.existsSync(path.join(site.dist, 'index.aifeed.md')), 'markdown written');
});

test('frameworks build prunes stale generated files and keeps user files', () => {
  const site = makeSite();
  fs.writeFileSync(path.join(site.dist, 'old.aifeed.md'), 'stale\n');
  fs.writeFileSync(path.join(site.dist, 'old.aifeed.md.sig'), '{}\n');
  fs.writeFileSync(path.join(site.dist, 'old.mako.md'), 'stale\n');
  fs.writeFileSync(path.join(site.dist, 'llms.txt'), 'stale\n');
  fs.writeFileSync(path.join(site.dist, 'keep.txt'), 'user file\n');

  frameworks.runBuild({ domain: DOMAIN, keyPath: site.keyPath, log: false }, { root: site.root, outDir: site.dist });

  assert.ok(!fs.existsSync(path.join(site.dist, 'old.aifeed.md')), 'stale markdown pruned');
  assert.ok(!fs.existsSync(path.join(site.dist, 'old.aifeed.md.sig')), 'stale sidecar pruned');
  assert.ok(!fs.existsSync(path.join(site.dist, 'old.mako.md')), 'stale mako pruned');
  assert.strictEqual(fs.readFileSync(path.join(site.dist, 'llms.txt'), 'utf8').startsWith('# '), true, 'llms regenerated');
  assert.strictEqual(fs.readFileSync(path.join(site.dist, 'keep.txt'), 'utf8'), 'user file\n', 'user files untouched');
});

test('frameworks config resolves env fallbacks and fails clearly', () => {
  const site = makeSite();
  const previousDomain = process.env.AIFEED_DOMAIN;
  const previousKey = process.env.AIFEED_KEY;
  try {
    process.env.AIFEED_DOMAIN = 'env.example';
    process.env.AIFEED_KEY = site.keyPath;
    const resolved = frameworks.resolveConfig({}, { root: site.root, outDir: site.dist });
    assert.strictEqual(resolved.domain, 'env.example');
    assert.strictEqual(resolved.baseUrl, 'https://env.example');
    assert.strictEqual(resolved.keyPath, site.keyPath);

    delete process.env.AIFEED_DOMAIN;
    assert.throws(() => frameworks.resolveConfig({}, { root: site.root, outDir: site.dist }), /domain is required/);

    process.env.AIFEED_DOMAIN = 'env.example';
    process.env.AIFEED_KEY = path.join(site.root, 'missing.pem');
    assert.throws(() => frameworks.resolveConfig({}, { root: site.root, outDir: site.dist }), /private key not found/);
    assert.throws(() => frameworks.resolveConfig({ domain: DOMAIN, keyPath: site.keyPath }, { root: site.root, outDir: path.join(site.root, 'nope') }), /output directory not found/);
  } finally {
    if (previousDomain === undefined) delete process.env.AIFEED_DOMAIN; else process.env.AIFEED_DOMAIN = previousDomain;
    if (previousKey === undefined) delete process.env.AIFEED_KEY; else process.env.AIFEED_KEY = previousKey;
  }
});

test('aifeed-build CLI keygens and signs any static directory', () => {
  const site = makeSite();
  fs.rmSync(path.join(site.root, 'aifeed-private.pem'), { force: true });
  fs.rmSync(path.join(site.root, 'aifeed-public.txt'), { force: true });

  const keygen = spawnSync(process.execPath, [CLI, 'keygen', '--out', site.root, '--json'], { encoding: 'utf8' });
  assert.strictEqual(keygen.status, 0, keygen.stderr);
  const key = JSON.parse(keygen.stdout);
  assert.ok(key.fingerprint.startsWith('sha256:'), key.fingerprint);

  const build = spawnSync(process.execPath, [
    CLI, site.dist, '--domain', DOMAIN, '--key', key.private_key, '--json'
  ], { encoding: 'utf8' });
  assert.strictEqual(build.status, 0, build.stderr);
  const summary = JSON.parse(build.stdout);
  assert.strictEqual(summary.pages.length, 2);
  assert.strictEqual(verifyDist(site.dist).result, 'VERIFIED');

  const refused = spawnSync(process.execPath, [CLI, 'keygen', '--out', site.root], { encoding: 'utf8' });
  assert.strictEqual(refused.status, 1);
  assert.match(refused.stderr, /refusing to overwrite/);
});

test('aifeed-next CLI signs a Next.js export directory', () => {
  const site = makeSite();
  const out = path.join(site.root, 'out');
  fs.renameSync(path.join(site.root, 'dist'), out);

  const build = spawnSync(process.execPath, [
    NEXT_CLI, '--domain', DOMAIN, '--key', site.keyPath, '--json'
  ], { encoding: 'utf8', cwd: site.root });
  assert.strictEqual(build.status, 0, build.stderr);
  assert.strictEqual(verifyDist(out).result, 'VERIFIED');

  const warn = [];
  const original = console.warn;
  console.warn = (message) => warn.push(message);
  try {
    const config = withAifeed({ reactStrictMode: true }, { domain: DOMAIN });
    assert.deepStrictEqual(config, { reactStrictMode: true });
  } finally {
    console.warn = original;
  }
  assert.strictEqual(warn.length, 1);
  assert.match(warn[0], /output/);
});

test('dual-stack profile writes both signed indices', () => {
  const site = makeSite();
  frameworks.runBuild({ domain: DOMAIN, keyPath: site.keyPath, profile: 'both', log: false }, { root: site.root, outDir: site.dist });

  assert.ok(fs.existsSync(path.join(site.dist, '.well-known', 'aifeed-index.json')), 'aimd index');
  assert.ok(fs.existsSync(path.join(site.dist, '.well-known', 'mako-index.json')), 'mako index');
  assert.ok(fs.existsSync(path.join(site.dist, 'index.mako.md')), 'mako page');
  assert.strictEqual(verifyDist(site.dist).result, 'VERIFIED');
});
