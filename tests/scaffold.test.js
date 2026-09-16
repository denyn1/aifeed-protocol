'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const scaffold = require('../lib/scaffold');
const { verifyDirectory } = require('../lib/validate');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');
const NOW = new Date('2026-09-14T08:00:00Z');

test('init creates keys, a signed manifest, and the setup guide', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-init-'));
  const summary = scaffold.initSite({ dir, domain: 'init.example', profile: 'news', now: NOW });

  assert.ok(fs.existsSync(summary.privateKeyPath));
  assert.ok(fs.existsSync(summary.manifestPath));
  assert.ok(fs.existsSync(summary.signaturePath));
  assert.match(summary.publicKey, /^ed25519:[A-Za-z0-9+/]{59}=$/);
  assert.match(summary.fingerprint, /^sha256:[A-Za-z0-9_-]{43}$/);

  const guide = fs.readFileSync(summary.setupPath, 'utf8');
  assert.ok(guide.includes('_aifeed.init.example'));
  assert.ok(guide.includes('rel="ai-feed"'));
  assert.ok(guide.includes('ONE manifest per origin'));

  const verified = verifyDirectory(path.join(dir, '.well-known'), { domain: 'init.example', now: NOW });
  assert.strictEqual(verified.result, 'VERIFIED', JSON.stringify(verified.errors));

  const manifest = JSON.parse(fs.readFileSync(summary.manifestPath, 'utf8'));
  assert.strictEqual(manifest.identity.type, 'news');
  assert.strictEqual(manifest.permissions.usage.translate, 'allow');
  assert.strictEqual(manifest.permissions.usage.training, 'deny');
  assert.strictEqual(manifest.revocation.list_url, 'https://aifeed.md/revoke/v1/init.example.json');
});

test('CLI init works end-to-end and guards existing keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-init-cli-'));
  const first = spawnSync(process.execPath, [CLI, 'init', '--dir', dir, '--domain', 'cli-init.example', '--profile', 'ecommerce'], { encoding: 'utf8' });
  assert.strictEqual(first.status, 0, first.stderr);
  const output = JSON.parse(first.stdout);
  assert.strictEqual(output.profile, 'ecommerce');
  assert.ok(fs.existsSync(path.join(dir, '.well-known', 'ai.json')));

  const second = spawnSync(process.execPath, [CLI, 'init', '--dir', dir, '--domain', 'cli-init.example'], { encoding: 'utf8' });
  assert.strictEqual(second.status, 2);
  assert.match(second.stderr, /refusing to overwrite/);

  const forced = spawnSync(process.execPath, [CLI, 'init', '--dir', dir, '--domain', 'cli-init.example', '--force'], { encoding: 'utf8' });
  assert.strictEqual(forced.status, 0, forced.stderr);
});

test('profiles map to sensible permissions', () => {
  const restrictive = scaffold.buildManifest({ domain: 'x.example', profile: 'restrictive', publicKey: scaffold.PROFILES && 'ed25519:MCowBQYDK2VwAyEAA6EHv/POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg=' });
  assert.strictEqual(restrictive.permissions.usage.search, 'allow');
  assert.strictEqual(restrictive.permissions.usage.retrieval, 'deny');
  assert.strictEqual(restrictive.permissions.usage.training, 'deny');
  const government = scaffold.buildManifest({ domain: 'gov.example', profile: 'government', publicKey: 'ed25519:MCowBQYDK2VwAyEAA6EHv/POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg=' });
  assert.strictEqual(government.identity.type, 'government');
  assert.strictEqual(government.permissions.usage.reproduce, 'allow');
});
