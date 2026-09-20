'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildSdk, checkSdk } = require('../tools/build-sdk');

buildSdk();
const sdk = require('../packages/aifeed-verify');

const ROOT = path.join(__dirname, '..');
const SDK_DIR = path.join(ROOT, 'packages', 'aifeed-verify');

test('sdk exposes the public API surface', () => {
  const functions = [
    'verifyAll', 'verifyDirectory', 'checkManifest', 'normalizeDomain', 'canonicalRevocationUrl',
    'parseStrict', 'verifyRevocationDocument', 'verifyBundle', 'createBundle',
    'rawDigestOf', 'verifyRawDigest', 'parseContentDigest', 'verifyContentDigest',
    'fetchText', 'lookupAifeedTxt', 'resolvePinnedAddress',
    'listAssets', 'verifyAsset'
  ];
  for (const name of functions) {
    assert.strictEqual(typeof sdk[name], 'function', 'missing function export: ' + name);
  }
  for (const name of ['crypto', 'schema', 'jcs', 'digest', 'revocation', 'bundle', 'remote']) {
    assert.strictEqual(typeof sdk[name], 'object', 'missing namespace export: ' + name);
  }
  assert.strictEqual(typeof sdk.StrictParseError, 'function');
  assert.ok(sdk.manifestSchema && sdk.manifestSchema.$id, 'manifest schema export missing');
});

test('sdk verifies a conformance vector', () => {
  const dir = path.join(ROOT, 'conformance', 'vectors', 'positive', '001-basic');
  const manifestPath = path.join(dir, 'ai.json');
  const result = sdk.verifyAll({
    manifestText: fs.readFileSync(manifestPath, 'utf8'),
    manifestBytes: fs.readFileSync(manifestPath),
    signatureText: fs.readFileSync(path.join(dir, 'ai-signature.json'), 'utf8'),
    domain: 'tokobuku.example',
    now: new Date('2026-10-01T00:00:00Z')
  });
  assert.strictEqual(result.result, 'VERIFIED', JSON.stringify(result.errors));
});

test('sdk verifies a signed bundle fixture', () => {
  const dir = path.join(ROOT, 'conformance', 'fixtures', 'bundles', 'signed');
  const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
  const result = sdk.verifyBundle({
    bundleDir: dir,
    now: new Date(expected.now),
    bundlerPublicKeyValue: expected.bundler_public_key
  });
  assert.strictEqual(result.result, 'VERIFIED', JSON.stringify(result.errors));
  assert.strictEqual(result.manifest_result, 'VERIFIED');
});

test('sdk verifies a revocation fixture', () => {
  const dir = path.join(ROOT, 'conformance', 'revocation', '001-active-multisig');
  const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
  const result = sdk.verifyRevocationDocument(
    fs.readFileSync(path.join(dir, 'revocation.json'), 'utf8'),
    { domain: expected.domain, now: new Date(expected.now), governanceKeys: expected.governance_keys }
  );
  assert.strictEqual(result.result, expected.result, JSON.stringify(result.errors));
  assert.strictEqual(result.valid_signatures, 2);
});

test('sdk lists assets and verifies downloaded bytes', () => {
  const digest = sdk.digest.sha256Base64(Buffer.from('test'));
  const frontmatter = {
    aifeed: {
      assets: [
        { url: '/media/cover.webp', type: 'image', mime: 'image/webp', size: 4, 'sha-256': digest },
        { url: 'https://cdn.example/report.pdf', type: 'document' }
      ]
    }
  };
  const assets = sdk.listAssets({ frontmatter, url: 'https://example.com/page' });
  assert.strictEqual(assets.length, 2);
  assert.strictEqual(assets[0].url, 'https://example.com/media/cover.webp');
  assert.strictEqual(assets[0].mime, 'image/webp');
  assert.strictEqual(assets[1].url, 'https://cdn.example/report.pdf');
  assert.deepStrictEqual(sdk.listAssets({ frontmatter: { aifeed: {} } }), []);

  const ok = sdk.verifyAsset(Buffer.from('test'), { size: 4, 'sha-256': digest });
  assert.strictEqual(ok.ok, true, JSON.stringify(ok.errors));
  assert.strictEqual(ok.verified, true);

  const tampered = sdk.verifyAsset(Buffer.from('tampered!'), { size: 4, 'sha-256': digest });
  assert.strictEqual(tampered.ok, false);
  assert.deepStrictEqual(
    tampered.errors.map((error) => error.code).sort(),
    ['asset_digest_mismatch', 'asset_size_mismatch']
  );

  const unchecked = sdk.verifyAsset(Buffer.from('test'), { url: '/x.png', type: 'image' });
  assert.strictEqual(unchecked.ok, true);
  assert.strictEqual(unchecked.verified, false);
  assert.strictEqual(unchecked.warnings[0].code, 'asset_no_integrity');
});

test('sdk ships TypeScript declarations', () => {
  const declarations = fs.readFileSync(path.join(SDK_DIR, 'index.d.ts'), 'utf8');
  for (const token of ['verifyAll', 'verifyRevocationDocument', 'verifyBundle', 'ManifestVerifyResult', 'RawDigest', 'BundleVerifyResult']) {
    assert.ok(declarations.includes(token), 'missing declaration: ' + token);
  }
});

test('built sdk stays in sync with sources', () => {
  assert.strictEqual(checkSdk(), true);
});

test('sdk package packs with the expected files', () => {
  const result = spawnSync('npm pack --dry-run --json', { cwd: SDK_DIR, encoding: 'utf8', shell: true });
  assert.strictEqual(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  const files = parsed[0].files.map((entry) => entry.path.replace(/\\/g, '/'));
  for (const expected of ['index.js', 'index.d.ts', 'lib/parse.js', 'lib/validate.js', 'schema/ai-json.v0.1.json', 'README.md', 'LICENSE']) {
    assert.ok(files.includes(expected), 'package is missing ' + expected + ' (got ' + files.length + ' files)');
  }
});
