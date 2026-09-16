'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const makoLib = require('../lib/mako');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');
const PAGE_URL = 'https://berita.example/artikel/aifeed';

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', ...options });
}

function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-mako-'));
  fs.writeFileSync(path.join(dir, 'sample.html'), [
    '<html lang="id"><head><title>Panduan</title>',
    '<meta name="description" content="Ringkasan.">',
    '</head><body><article><h1>Panduan</h1>',
    '<p>Isi <strong>artikel</strong> dengan <a href="/tautan">tautan</a>.</p>',
    '</article></body></html>'
  ].join('\n'));
  const keygen = runCli(['keygen', '--out', dir]);
  assert.strictEqual(keygen.status, 0, keygen.stderr);
  return dir;
}

test('mako generate, sign, verify round-trip', () => {
  const dir = makeSandbox();
  const makoPath = path.join(dir, 'panduan.mako.md');
  const gen = runCli(['mako', 'generate', path.join(dir, 'sample.html'), '--out', makoPath, '--url', PAGE_URL]);
  assert.strictEqual(gen.status, 0, gen.stderr);
  assert.ok(fs.existsSync(makoPath));

  const sign = runCli(['mako', 'sign', makoPath, '--url', PAGE_URL, '--key', path.join(dir, 'aifeed-private.pem')]);
  assert.strictEqual(sign.status, 0, sign.stderr);
  assert.ok(fs.existsSync(makoPath + '.sig'));

  const verify = runCli(['mako', 'verify', makoPath, '--url', PAGE_URL, '--key', path.join(dir, 'aifeed-public.txt'), '--json']);
  assert.strictEqual(verify.status, 0, verify.stderr);
  const result = JSON.parse(verify.stdout);
  assert.strictEqual(result.mako_verified, true);
  assert.deepStrictEqual(result.errors, []);

  const body = fs.readFileSync(makoPath, 'utf8');
  fs.writeFileSync(makoPath, body + '\nTampered.\n');
  const tampered = runCli(['mako', 'verify', makoPath, '--url', PAGE_URL, '--key', path.join(dir, 'aifeed-public.txt'), '--json']);
  assert.strictEqual(tampered.status, 1);
  const tamperedResult = JSON.parse(tampered.stdout);
  assert.strictEqual(tamperedResult.mako_verified, false);
  assert.ok(tamperedResult.errors.some((item) => item.code === 'mako_digest_mismatch'));
});

test('mako index builds and signs entries with triage fields and site resume', () => {
  const dir = makeSandbox();
  const nested = path.join(dir, 'artikel');
  fs.mkdirSync(nested);
  const makoPath = path.join(nested, 'aifeed.mako.md');
  const gen = runCli(['mako', 'generate', path.join(dir, 'sample.html'), '--out', makoPath, '--url', PAGE_URL]);
  assert.strictEqual(gen.status, 0, gen.stderr);

  const index = runCli([
    'mako', 'index', dir, '--domain', 'berita.example', '--sign', '--key', path.join(dir, 'aifeed-private.pem'),
    '--name', 'Berita Contoh', '--description', 'Berita harian untuk uji.', '--json'
  ]);
  assert.strictEqual(index.status, 0, index.stderr);
  const summary = JSON.parse(index.stdout);
  assert.strictEqual(summary.entries, 1);
  assert.strictEqual(summary.signed, true);
  const document = JSON.parse(fs.readFileSync(summary.index, 'utf8'));
  assert.strictEqual(document.domain, 'berita.example');
  assert.strictEqual(document.entries[0].url, '/artikel/aifeed');
  assert.strictEqual(document.site.name, 'Berita Contoh');
  assert.strictEqual(document.site.description, 'Berita harian untuk uji.');
  assert.strictEqual(document.entries[0].title, 'Panduan');
  assert.strictEqual(document.entries[0].summary, 'Ringkasan.');
  assert.strictEqual(document.entries[0].lang, 'id');
  assert.ok(fs.existsSync(summary.index + '.sig'));

  const verification = makoLib.verifyMakoIndex({
    indexText: fs.readFileSync(summary.index, 'utf8'),
    indexUrl: summary.index_url,
    publicKeyValue: fs.readFileSync(path.join(dir, 'aifeed-public.txt'), 'utf8').split('\n')[0].trim(),
    signatureText: fs.readFileSync(summary.index + '.sig', 'utf8'),
    requireSignature: true
  });
  assert.strictEqual(verification.verified, true, JSON.stringify(verification.errors));
});

test('mako generate rejects directories without HTML', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-empty-'));
  const result = runCli(['mako', 'generate', dir]);
  assert.strictEqual(result.status, 2);
  assert.match(result.stderr, /no HTML files found/);
});

test('mako generate refuses to overwrite a non-MAKO file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-guard-'));
  const htmlPath = path.join(dir, 'halaman.html');
  const original = '<html><body><p>Konten asli.</p></body></html>';
  fs.writeFileSync(htmlPath, original);
  const result = runCli(['mako', 'generate', htmlPath, '--out', htmlPath]);
  assert.strictEqual(result.status, 2, result.stdout);
  assert.match(result.stderr, /refusing to overwrite non-MAKO file/);
  assert.strictEqual(fs.readFileSync(htmlPath, 'utf8'), original, 'source HTML must be untouched');
});

test('mako generate writes into an output directory', () => {
  const dir = makeSandbox();
  const outDir = path.join(dir, 'out');
  const result = runCli(['mako', 'generate', path.join(dir, 'sample.html'), '--out', outDir]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(outDir, 'sample.mako.md')));
});

test('mako generate rejects a single-file --out for multiple inputs', () => {
  const dir = makeSandbox();
  fs.writeFileSync(path.join(dir, 'kedua.html'), '<html><body><p>Dua.</p></body></html>');
  const result = runCli(['mako', 'generate', dir, '--out', path.join(dir, 'gabungan.mako.md')]);
  assert.strictEqual(result.status, 2, result.stdout);
  assert.match(result.stderr, /--out must be a directory when generating multiple files/);
});

test('aimd format generates, signs, verifies, and indexes native documents', () => {
  const dir = makeSandbox();
  const aimdPath = path.join(dir, 'panduan.aifeed.md');
  const alternatesPath = path.join(dir, 'alternates.json');
  fs.writeFileSync(alternatesPath, JSON.stringify([
    { url: 'https://xn--tko-7qa.example/en/panduan', lang: 'en' }
  ]));
  const gen = runCli(['mako', 'generate', path.join(dir, 'sample.html'), '--out', aimdPath, '--url', PAGE_URL, '--format', 'aimd', '--alternates', alternatesPath]);
  assert.strictEqual(gen.status, 0, gen.stderr);
  const text = fs.readFileSync(aimdPath, 'utf8');
  assert.ok(text.includes('aimd: "1.0"'), 'aimd marker present');
  assert.ok(!text.includes('mako: "1.0"'), 'mako marker absent for aimd format');
  assert.ok(text.includes('alternates:'), 'alternates emitted');
  assert.ok(text.includes('lang: "en"'), 'alternate language emitted');

  const sign = runCli(['mako', 'sign', aimdPath, '--url', PAGE_URL, '--key', path.join(dir, 'aifeed-private.pem'), '--json']);
  assert.strictEqual(sign.status, 0, sign.stderr);
  const signed = JSON.parse(sign.stdout);
  assert.strictEqual(signed.profile, 'aimd');
  const container = JSON.parse(fs.readFileSync(aimdPath + '.sig', 'utf8'));
  assert.strictEqual(container.context, 'aimd');

  const verify = runCli(['mako', 'verify', aimdPath, '--url', PAGE_URL, '--key', path.join(dir, 'aifeed-public.txt'), '--json']);
  assert.strictEqual(verify.status, 0, verify.stderr);
  const verified = JSON.parse(verify.stdout);
  assert.strictEqual(verified.profile, 'aimd');
  assert.strictEqual(verified.mako_verified, true);

  const index = runCli(['mako', 'index', dir, '--domain', 'berita.example', '--format', 'aimd', '--sign', '--key', path.join(dir, 'aifeed-private.pem'), '--json']);
  assert.strictEqual(index.status, 0, index.stderr);
  const summary = JSON.parse(index.stdout);
  assert.ok(summary.index.endsWith('aifeed-index.json'), 'aimd index path');
  const document = JSON.parse(fs.readFileSync(summary.index, 'utf8'));
  assert.ok(document.entries.some((entry) => entry.url === '/panduan'), 'aimd entry indexed');
  const indexSignature = JSON.parse(fs.readFileSync(summary.index + '.sig', 'utf8'));
  assert.strictEqual(indexSignature.context, 'aimd-index');
});
