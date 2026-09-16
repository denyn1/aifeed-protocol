'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const cryptoLib = require('../lib/crypto');
const bundleLib = require('../lib/bundle');
const { baseManifest, privateKeyFromSeed, SEED_PRIMARY } = require('../tools/gen-vectors');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');

function makeSite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-bundle-site-'));
  const privateKey = privateKeyFromSeed(SEED_PRIMARY);
  const publicKeyValue = cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(privateKey));
  const manifest = baseManifest(publicKeyValue);
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  fs.writeFileSync(path.join(dir, 'ai.json'), manifestText);
  const signatureBytes = cryptoLib.signManifest(privateKey, manifest);
  fs.writeFileSync(path.join(dir, 'ai-signature.json'), JSON.stringify({
    algorithm: 'ed25519',
    canonicalization: 'jcs-rfc8785',
    signature: cryptoLib.encodeSignature(signatureBytes),
    raw_digest: require('../lib/digest').rawDigestOf(Buffer.from(manifestText, 'utf8'))
  }, null, 2) + '\n');
  return { dir, privateKey };
}

test('bundle create then verify (unsigned)', () => {
  const site = makeSite();
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-bundle-out-'));
  const manifest = bundleLib.createBundle({
    sourceDir: site.dir,
    outDir: bundleDir,
    domain: 'tokobuku.example'
  });
  assert.strictEqual(manifest.files.length, 3);
  assert.strictEqual(manifest.bundler, undefined);

  const result = bundleLib.verifyBundle({ bundleDir });
  assert.strictEqual(result.result, 'VERIFIED', JSON.stringify(result.errors));
  assert.ok(result.warnings.some((warning) => warning.code === 'bundle_unsigned'));
});

test('bundle verify detects tampered files', () => {
  const site = makeSite();
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-bundle-tamper-'));
  bundleLib.createBundle({ sourceDir: site.dir, outDir: bundleDir, domain: 'tokobuku.example' });
  fs.appendFileSync(path.join(bundleDir, 'manifest', 'ai.json'), ' ');
  const result = bundleLib.verifyBundle({ bundleDir });
  assert.strictEqual(result.result, 'UNVERIFIED');
  assert.ok(result.errors.some((error) => error.code === 'bundle_file_mismatch' || error.code === 'raw_digest_mismatch'));
});

test('signed bundle verifies with bundler key', () => {
  const site = makeSite();
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-bundle-signed-'));
  bundleLib.createBundle({
    sourceDir: site.dir,
    outDir: bundleDir,
    domain: 'tokobuku.example',
    privateKey: site.privateKey,
    keyId: 'test-bundler'
  });
  const publicKeyValue = cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(site.privateKey));
  const result = bundleLib.verifyBundle({ bundleDir, bundlerPublicKeyValue: publicKeyValue });
  assert.strictEqual(result.result, 'VERIFIED', JSON.stringify(result.errors));
  assert.ok(!result.warnings.some((warning) => warning.code === 'bundle_unsigned'));
});

test('tampered bundle manifest fails bundler signature', () => {
  const site = makeSite();
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-bundle-sig-'));
  bundleLib.createBundle({
    sourceDir: site.dir,
    outDir: bundleDir,
    domain: 'tokobuku.example',
    privateKey: site.privateKey
  });
  const manifestPath = path.join(bundleDir, 'BUNDLE-MANIFEST.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.domain = 'evil.example';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const publicKeyValue = cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(site.privateKey));
  const result = bundleLib.verifyBundle({ bundleDir, bundlerPublicKeyValue: publicKeyValue });
  assert.strictEqual(result.result, 'UNVERIFIED');
  assert.ok(result.errors.some((error) => error.code === 'bundle_signature_invalid'));
});

test('stale bundle reduces trust', () => {
  const site = makeSite();
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-bundle-stale-'));
  const old = new Date(Date.now() - 200 * 3600 * 1000);
  bundleLib.createBundle({ sourceDir: site.dir, outDir: bundleDir, domain: 'tokobuku.example', now: old });
  const result = bundleLib.verifyBundle({ bundleDir });
  assert.strictEqual(result.result, 'UNVERIFIED');
  assert.ok(result.errors.some((error) => error.code === 'bundle_stale'));
});

test('bundle with path traversal entry is rejected', () => {
  const site = makeSite();
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-bundle-evil-'));
  bundleLib.createBundle({ sourceDir: site.dir, outDir: bundleDir, domain: 'tokobuku.example' });
  const manifestPath = path.join(bundleDir, 'BUNDLE-MANIFEST.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.files.push({ path: '../evil.txt', 'sha-256': manifest.files[0]['sha-256'], size: 1 });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const result = bundleLib.verifyBundle({ bundleDir });
  assert.strictEqual(result.result, 'UNVERIFIED');
  assert.ok(result.errors.some((error) => error.code === 'bundle_manifest_invalid'));
});

test('bundle with absolute path entry is rejected', () => {
  const site = makeSite();
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-bundle-abs-'));
  bundleLib.createBundle({ sourceDir: site.dir, outDir: bundleDir, domain: 'tokobuku.example' });
  const manifestPath = path.join(bundleDir, 'BUNDLE-MANIFEST.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.files.push({ path: '/etc/passwd', 'sha-256': manifest.files[0]['sha-256'], size: 1 });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const result = bundleLib.verifyBundle({ bundleDir });
  assert.strictEqual(result.result, 'UNVERIFIED');
  assert.ok(result.errors.some((error) => error.code === 'bundle_manifest_invalid'));
});

test('bundle CLI create and verify end-to-end', () => {
  const site = makeSite();
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-bundle-cli-'));
  const create = spawnSync(process.execPath, [CLI, 'bundle', 'create', site.dir, '--out', bundleDir, '--domain', 'tokobuku.example'], { encoding: 'utf8' });
  assert.strictEqual(create.status, 0, create.stderr);
  const verify = spawnSync(process.execPath, [CLI, 'bundle', 'verify', bundleDir, '--json'], { encoding: 'utf8' });
  assert.strictEqual(verify.status, 0, verify.stdout + verify.stderr);
  const report = JSON.parse(verify.stdout);
  assert.strictEqual(report.result, 'VERIFIED');
  assert.strictEqual(report.files, 3);
});
