'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { baseManifest } = require('../tools/gen-vectors');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    ...options
  });
}

test('keygen writes keys and prints JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-keygen-'));
  const result = runCli(['keygen', '--out', dir]);
  assert.strictEqual(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.ok(fs.existsSync(output.private_key));
  assert.ok(fs.existsSync(output.public_key));
  assert.match(output.public_key_value, /^ed25519:[A-Za-z0-9+/]{59}=$/);
  assert.match(output.fingerprint, /^sha256:[A-Za-z0-9_-]{43}$/);
});

test('keygen refuses to overwrite without --force', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-keygen-force-'));
  assert.strictEqual(runCli(['keygen', '--out', dir]).status, 0);
  const second = runCli(['keygen', '--out', dir]);
  assert.strictEqual(second.status, 2);
  assert.match(second.stderr, /refusing to overwrite/);
  assert.strictEqual(runCli(['keygen', '--out', dir, '--force']).status, 0);
});

test('sign then validate end-to-end', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-e2e-'));
  const keygen = runCli(['keygen', '--out', dir]);
  assert.strictEqual(keygen.status, 0, keygen.stderr);
  const { public_key_value } = JSON.parse(keygen.stdout);

  const manifest = baseManifest(public_key_value);
  const manifestPath = path.join(dir, 'ai.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const signed = runCli(['sign', manifestPath]);
  assert.strictEqual(signed.status, 0, signed.stderr);
  assert.ok(fs.existsSync(path.join(dir, 'ai-signature.json')));

  const validated = runCli(['validate', dir, '--json']);
  assert.strictEqual(validated.status, 0, validated.stdout + validated.stderr);
  const report = JSON.parse(validated.stdout);
  assert.strictEqual(report.result, 'VERIFIED');
});

test('sign refuses a manifest whose key does not match the signer', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-mismatch-'));
  assert.strictEqual(runCli(['keygen', '--out', dir]).status, 0);
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-mismatch-other-'));
  assert.strictEqual(runCli(['keygen', '--out', other]).status, 0);
  const { public_key_value } = JSON.parse(runCli(['keygen', '--out', other, '--force']).stdout);

  const manifest = baseManifest(public_key_value);
  const manifestPath = path.join(dir, 'ai.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const result = runCli(['sign', manifestPath]);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /signer_key_mismatch/);
});

test('validate detects tampering with exit code 1', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-tamper-'));
  const keygen = runCli(['keygen', '--out', dir]);
  const { public_key_value } = JSON.parse(keygen.stdout);
  const manifest = baseManifest(public_key_value);
  const manifestPath = path.join(dir, 'ai.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  assert.strictEqual(runCli(['sign', manifestPath]).status, 0);

  const tampered = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  tampered.identity.name = 'Toko Buku Palsu';
  fs.writeFileSync(manifestPath, JSON.stringify(tampered, null, 2));

  const validated = runCli(['validate', dir]);
  assert.strictEqual(validated.status, 1);
  assert.match(validated.stdout, /bad_signature/);
});

test('require-dns-anchor fails closed when the anchor is not established', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-anchor-'));
  const keygen = runCli(['keygen', '--out', dir]);
  const { public_key_value } = JSON.parse(keygen.stdout);
  const manifestPath = path.join(dir, 'ai.json');
  fs.writeFileSync(manifestPath, JSON.stringify(baseManifest(public_key_value), null, 2));
  assert.strictEqual(runCli(['sign', manifestPath]).status, 0);

  const withoutFlag = runCli(['validate', dir, '--json']);
  assert.strictEqual(withoutFlag.status, 0);

  const withFlag = runCli(['validate', dir, '--require-dns-anchor', '--json']);
  assert.strictEqual(withFlag.status, 1);
  const report = JSON.parse(withFlag.stdout);
  assert.strictEqual(report.result, 'UNVERIFIED');
  assert.ok(report.errors.some((error) => error.code === 'dns_anchor_required_or_unavailable'));
});
