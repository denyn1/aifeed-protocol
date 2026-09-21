'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildCli } = require('../tools/build-cli');

buildCli();

const CLI_DIR = path.join(__dirname, '..', 'packages', 'aifeed-cli');
const CLI = path.join(CLI_DIR, 'bin', 'cli.js');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

test('aifeed CLI package ships bins, engine copies, and zero dependencies', () => {
  const pkg = require('../packages/aifeed-cli/package.json');
  assert.strictEqual(pkg.name, 'aifeed');
  assert.strictEqual(pkg.bin.aifeed, 'bin/cli.js');
  assert.strictEqual(pkg.bin['aifeed-keygen'], 'bin/keygen.js');
  assert.ok(!('dependencies' in pkg) && !('devDependencies' in pkg), 'zero-dependency rule');
  for (const file of ['bin/cli.js', 'lib/site.js', 'schema/ai-json.v0.2.json', 'LICENSE']) {
    assert.ok(fs.existsSync(path.join(CLI_DIR, file)), file);
  }
});

test('aifeed CLI keygens, scaffolds, re-signs without --key, and validates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-cli-'));
  const keys = path.join(root, 'keys');
  const keygen = run(['keygen', '--out', keys]);
  assert.strictEqual(keygen.status, 0, keygen.stderr);
  assert.ok(fs.existsSync(path.join(keys, 'aifeed-private.pem')), 'private key written');
  assert.ok(fs.existsSync(path.join(keys, 'aifeed-public.txt')), 'public key written');

  const site = path.join(root, 'site');
  const init = run(['init', '--domain', 'cli.example', '--dir', site]);
  assert.strictEqual(init.status, 0, init.stderr);
  const manifestPath = path.join(site, '.well-known', 'ai.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest written');
  assert.ok(fs.existsSync(path.join(site, '.well-known', 'ai-signature.json')), 'signature written');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.identity.name = 'CLI Test Edited';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  const sign = run(['sign', manifestPath]);
  assert.strictEqual(sign.status, 0, sign.stderr);
  assert.strictEqual(JSON.parse(sign.stdout).result, 'signed', sign.stdout);

  const validate = run(['validate', site, '--domain', 'cli.example', '--json']);
  assert.strictEqual(validate.status, 0, validate.stderr);
  assert.strictEqual(JSON.parse(validate.stdout).result, 'VERIFIED');
});

test('aifeed npm package packs the CLI, engine, and schema', () => {
  const result = spawnSync('npm pack --dry-run --json', { cwd: CLI_DIR, encoding: 'utf8', shell: true });
  assert.strictEqual(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  const files = parsed[0].files.map((entry) => entry.path.replace(/\\/g, '/'));
  for (const expected of ['bin/cli.js', 'lib/site.js', 'schema/ai-json.v0.2.json', 'README.md', 'LICENSE', 'package.json']) {
    assert.ok(files.includes(expected), 'missing packed file: ' + expected);
  }
});
