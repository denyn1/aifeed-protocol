'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sdk = require('../packages/aifeed-verify');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');
const BASE_URL = 'https://static.example';

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

function makeStaticSite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-site-'));
  fs.writeFileSync(path.join(dir, 'index.html'), [
    '<!doctype html><html lang="id"><head><title>Beranda</title>',
    '<meta name="description" content="Situs statis uji."></head>',
    '<body><article><h1>Beranda</h1><p>Selamat datang di situs statis.</p></article></body></html>'
  ].join('\n'));
  fs.mkdirSync(path.join(dir, 'artikel'));
  fs.writeFileSync(path.join(dir, 'artikel', 'satu.html'), [
    '<!doctype html><html lang="id"><head><title>Artikel Satu</title>',
    '<meta name="description" content="Ringkasan artikel satu."></head>',
    '<body><article><h1>Artikel Satu</h1><p>Isi artikel dengan <strong>penekanan</strong>.</p>',
    '<p>Unduh <a href="/laporan.pdf">laporan PDF</a>.</p></article></body></html>'
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'artikel', 'index.html'), [
    '<!doctype html><html lang="id"><head><title>Indeks Artikel</title>',
    '<meta name="description" content="Daftar artikel."></head>',
    '<body><h1>Indeks Artikel</h1><p>Semua artikel.</p></body></html>'
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'sitemap.xml'), '<?xml version="1.0"?><urlset></urlset>\n');
  fs.writeFileSync(path.join(dir, 'laporan.pdf'), '%PDF-1.4 demo report\n');
  return dir;
}

test('site build publishes AIFeed Markdown for any static site and everything verifies', () => {
  const dir = makeStaticSite();
  const keygen = runCli(['keygen', '--out', dir]);
  assert.strictEqual(keygen.status, 0, keygen.stderr);

  const build = runCli([
    'site', 'build', dir,
    '--domain', 'static.example',
    '--base-url', BASE_URL,
    '--name', 'Situs Statis',
    '--key', path.join(dir, 'aifeed-private.pem'),
    '--inject',
    '--llms',
    '--json'
  ]);
  assert.strictEqual(build.status, 0, build.stderr);
  const summary = JSON.parse(build.stdout);
  assert.strictEqual(summary.profile, 'aimd');
  assert.strictEqual(summary.pages.length, 3);
  const nested = summary.pages.find((page) => page.url === '/artikel');
  assert.ok(nested, 'nested directory index gets the clean path /artikel');
  assert.strictEqual(nested.md, 'artikel/index.aifeed.md');
  assert.ok(fs.existsSync(path.join(dir, 'artikel', 'index.aifeed.md')), 'nested index AIFeed Markdown generated');

  // Per-page AIFeed Markdown + signature
  const mdPath = path.join(dir, 'artikel', 'satu.aifeed.md');
  assert.ok(fs.existsSync(mdPath), 'AIFeed Markdown file generated');
  assert.ok(fs.existsSync(mdPath + '.sig'), 'signature sidecar generated');
  const mdBytes = fs.readFileSync(mdPath);
  const container = JSON.parse(fs.readFileSync(mdPath + '.sig', 'utf8'));
  assert.strictEqual(container.context, 'aimd');
  const publicKeyValue = fs.readFileSync(path.join(dir, 'aifeed-public.txt'), 'utf8').split('\n')[0].trim();
  const verified = sdk.mako.verifyMakoContainer({
    containerText: JSON.stringify(container),
    pageUrl: BASE_URL + '/artikel/satu',
    bodyBytes: mdBytes,
    publicKey: sdk.crypto.decodePublicKey(publicKeyValue),
    context: 'aimd'
  });
  assert.strictEqual(verified.ok, true, JSON.stringify(verified.errors));

  // Manifest verifies with the SDK
  const manifestResult = sdk.verifyAll({
    manifestText: fs.readFileSync(path.join(dir, '.well-known', 'ai.json'), 'utf8'),
    manifestBytes: fs.readFileSync(path.join(dir, '.well-known', 'ai.json')),
    signatureText: fs.readFileSync(path.join(dir, '.well-known', 'ai-signature.json'), 'utf8'),
    domain: 'static.example'
  });
  assert.strictEqual(manifestResult.result, 'VERIFIED', JSON.stringify(manifestResult.errors));

  // Index verifies and matches the served bytes
  const indexUrl = BASE_URL + '/.well-known/aifeed-index.json';
  const indexResult = sdk.verifyAimdIndex({
    indexText: fs.readFileSync(path.join(dir, '.well-known', 'aifeed-index.json'), 'utf8'),
    indexUrl,
    publicKeyValue,
    signatureText: fs.readFileSync(path.join(dir, '.well-known', 'aifeed-index.json.sig'), 'utf8')
  });
  assert.strictEqual(indexResult.verified, true, JSON.stringify(indexResult.errors));
  const entry = indexResult.entries.find((item) => item.url === '/artikel/satu');
  assert.ok(entry, 'index entry present');
  assert.strictEqual(sdk.mako.checkIndexEntryDigest(entry, mdBytes).ok, true);
  assert.strictEqual(entry.summary, 'Ringkasan artikel satu.');

  // HTML advertises the explicit AIFeed Markdown endpoint and llms.txt exists
  const html = fs.readFileSync(path.join(dir, 'artikel', 'satu.html'), 'utf8');
  assert.ok(html.includes('type="text/aifeed+markdown" href="' + BASE_URL + '/artikel/satu.aifeed.md"'), 'alternate link injected');
  const llms = fs.readFileSync(path.join(dir, 'llms.txt'), 'utf8');
  assert.ok(llms.startsWith('# Situs Statis'), 'llms heading');
  assert.ok(llms.includes(BASE_URL + '/artikel/satu'), 'llms links the page');

  // Assets survive conversion, with mime and local file integrity metadata
  const mdText = fs.readFileSync(mdPath, 'utf8');
  assert.ok(mdText.includes('/laporan.pdf'), 'asset link present');
  assert.ok(mdText.includes('mime: "application/pdf"'), 'asset mime recorded');
  assert.ok(mdText.includes('sha-256:'), 'asset digest recorded');
  assert.strictEqual(entry.assets, 1, 'index exposes the asset count');
});

test('site build refuses to run without a key or domain', () => {
  const dir = makeStaticSite();
  const noDomain = runCli(['site', 'build', dir, '--key', path.join(dir, 'missing.pem')]);
  assert.strictEqual(noDomain.status, 2);
  assert.match(noDomain.stderr, /--domain is required/);

  const noKey = runCli(['site', 'build', dir, '--domain', 'static.example']);
  assert.strictEqual(noKey.status, 2);
  assert.match(noKey.stderr, /private key not found/);
});

test('site build --profile both writes AIFeed Markdown and MAKO files with matching signatures', () => {
  const dir = makeStaticSite();
  const keygen = runCli(['keygen', '--out', dir]);
  assert.strictEqual(keygen.status, 0, keygen.stderr);
  const build = runCli([
    'site', 'build', dir,
    '--domain', 'static.example',
    '--base-url', BASE_URL,
    '--name', 'Situs Statis',
    '--key', path.join(dir, 'aifeed-private.pem'),
    '--profile', 'both',
    '--inject',
    '--json'
  ]);
  assert.strictEqual(build.status, 0, build.stderr);
  const summary = JSON.parse(build.stdout);
  assert.strictEqual(summary.profile, 'both');

  const aimdPath = path.join(dir, 'artikel', 'satu.aifeed.md');
  const makoPath = path.join(dir, 'artikel', 'satu.mako.md');
  assert.ok(fs.existsSync(aimdPath) && fs.existsSync(aimdPath + '.sig'), 'AIFeed Markdown file + sidecar');
  assert.ok(fs.existsSync(makoPath) && fs.existsSync(makoPath + '.sig'), 'MAKO file + sidecar');
  const aimdContainer = JSON.parse(fs.readFileSync(aimdPath + '.sig', 'utf8'));
  const makoContainer = JSON.parse(fs.readFileSync(makoPath + '.sig', 'utf8'));
  assert.strictEqual(aimdContainer.context, 'aimd');
  assert.strictEqual(makoContainer.context, 'mako');

  const publicKeyValue = fs.readFileSync(path.join(dir, 'aifeed-public.txt'), 'utf8').split('\n')[0].trim();
  const publicKey = sdk.crypto.decodePublicKey(publicKeyValue);
  assert.strictEqual(sdk.mako.verifyMakoContainer({
    containerText: JSON.stringify(aimdContainer),
    pageUrl: BASE_URL + '/artikel/satu',
    bodyBytes: fs.readFileSync(aimdPath),
    publicKey,
    context: 'aimd'
  }).ok, true);
  assert.strictEqual(sdk.mako.verifyMakoContainer({
    containerText: JSON.stringify(makoContainer),
    pageUrl: BASE_URL + '/artikel/satu',
    bodyBytes: fs.readFileSync(makoPath),
    publicKey,
    context: 'mako'
  }).ok, true);
  assert.strictEqual(sdk.mako.verifyMakoContainer({
    containerText: JSON.stringify(makoContainer),
    pageUrl: BASE_URL + '/artikel/satu',
    bodyBytes: fs.readFileSync(makoPath),
    publicKey,
    context: 'aimd'
  }).ok, false, 'cross-context replay rejected');

  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.well-known', 'ai.json'), 'utf8'));
  assert.strictEqual(manifest.content.profile, 'both');
  assert.ok(fs.existsSync(path.join(dir, '.well-known', 'aifeed-index.json')));
  assert.ok(fs.existsSync(path.join(dir, '.well-known', 'mako-index.json')));

  const html = fs.readFileSync(path.join(dir, 'artikel', 'satu.html'), 'utf8');
  assert.ok(html.includes('type="text/aifeed+markdown" href="' + BASE_URL + '/artikel/satu.aifeed.md"'), 'AIFeed Markdown alternate link');
  assert.ok(html.includes('type="text/mako+markdown" href="' + BASE_URL + '/artikel/satu.mako.md"'), 'MAKO alternate link');
});
