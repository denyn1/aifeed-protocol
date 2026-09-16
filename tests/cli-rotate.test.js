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
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', ...options });
}

function setupManifest(version = '0.2') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-rotate-'));
  const keygen = runCli(['keygen', '--out', dir]);
  assert.strictEqual(keygen.status, 0, keygen.stderr);
  const { public_key_value } = JSON.parse(keygen.stdout);
  const manifest = baseManifest(public_key_value);
  if (version === '0.2') {
    manifest.$schema = 'https://aifeed.md/schema/ai-json/v0.2.json';
    manifest.version = '0.2';
  }
  const manifestPath = path.join(dir, 'ai.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const signed = runCli(['sign', manifestPath]);
  assert.strictEqual(signed.status, 0, signed.stderr);
  return { dir, manifestPath, manifest };
}

test('rotate announces a successor, dry-runs the cutover, then completes it', () => {
  const { dir, manifestPath, manifest } = setupManifest();

  const prepared = runCli(['rotate', '--dir', dir, '--window', '72', '--lead', '0', '--json']);
  assert.strictEqual(prepared.status, 0, prepared.stderr);
  const plan = JSON.parse(prepared.stdout);
  assert.strictEqual(plan.action, 'prepare');
  assert.strictEqual(plan.dry_run, false);
  assert.match(plan.successor_fingerprint, /^sha256:[A-Za-z0-9_-]{43}$/);
  assert.ok(fs.existsSync(path.join(dir, 'aifeed-private.next.pem')));

  const overlap = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(overlap.rotation.successor_fp, plan.successor_fingerprint);
  assert.strictEqual(overlap.identity.public_key, manifest.identity.public_key);

  const dry = runCli(['rotate', '--dir', dir, '--dry-run', '--json']);
  assert.strictEqual(dry.status, 0, dry.stderr);
  const dryPlan = JSON.parse(dry.stdout);
  assert.strictEqual(dryPlan.action, 'cutover');
  assert.strictEqual(dryPlan.dry_run, true);
  const stillOverlap = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(stillOverlap.rotation.successor_fp, plan.successor_fingerprint);

  const cutover = runCli(['rotate', '--dir', dir, '--json']);
  assert.strictEqual(cutover.status, 0, cutover.stderr);
  const done = JSON.parse(cutover.stdout);
  assert.strictEqual(done.action, 'cutover');
  assert.strictEqual(done.signing_key, plan.successor_fingerprint);
  assert.notStrictEqual(done.predecessor_fp, plan.successor_fingerprint);

  const rotated = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(rotated.rotation.predecessor_fp, done.predecessor_fp);
  assert.strictEqual(rotated.rotation.successor_fp, undefined);

  const complete = runCli(['rotate', '--dir', dir, '--json']);
  assert.strictEqual(complete.status, 0, complete.stderr);
  assert.strictEqual(JSON.parse(complete.stdout).action, 'complete');

  const validated = runCli(['validate', dir, '--domain', manifest.identity.domain, '--json']);
  assert.strictEqual(validated.status, 0, validated.stdout + validated.stderr);
  assert.strictEqual(JSON.parse(validated.stdout).result, 'VERIFIED');
});

test('rotate requires a v0.2 manifest', () => {
  const { dir } = setupManifest('0.1');
  const prepared = runCli(['rotate', '--dir', dir, '--lead', '0']);
  assert.strictEqual(prepared.status, 1);
  assert.match(prepared.stderr, /v0\.2 manifest/);
});

test('rotate refuses a successor key that was never announced', () => {
  const { dir } = setupManifest();
  assert.strictEqual(runCli(['rotate', '--dir', dir, '--lead', '0']).status, 0);
  const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-rotate-other-'));
  assert.strictEqual(runCli(['keygen', '--out', otherDir]).status, 0);
  const cutover = runCli(['rotate', '--dir', dir, '--key', path.join(otherDir, 'aifeed-private.pem')]);
  assert.strictEqual(cutover.status, 1);
  assert.match(cutover.stderr, /successor_key_mismatch/);
});
