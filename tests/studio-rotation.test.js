'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { Workspace } = require('../studio/workspace');
const { publishProject } = require('../studio/lib/publish');
const { verifyBuild } = require('../studio/lib/verify');
const { manifestStatus, prepareRotation, cutoverRotation, exportedPrivateKeys } = require('../studio/lib/rotation');
const cryptoLib = require('../lib/crypto');

test('key rotation prepares, cuts over, and re-signs every page', () => {
  const workspace = new Workspace(fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-rot-')));
  const created = workspace.create({ domain: 'rotate.example', name: 'Rotate', profile: 'aimd' });
  const paths = workspace.paths(created.id);
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-rotsrc-'));
  fs.writeFileSync(path.join(source, 'index.html'), '<html lang="en"><head><title>Home</title></head><body><main><h1>Home</h1></main></body></html>');
  fs.mkdirSync(path.join(source, 'a'));
  fs.writeFileSync(path.join(source, 'a', 'one.html'), '<html lang="en"><head><title>One</title></head><body><main><h1>One</h1></main></body></html>');

  const project = workspace.project(created.id);
  const base = {
    project,
    policy: workspace.policy(created.id),
    sourceDir: source,
    outDir: paths.outDir,
    keyPath: paths.keyPath,
    statePath: paths.statePath
  };
  assert.strictEqual(publishProject(base).processed, 2);
  assert.strictEqual(manifestStatus(paths.outDir).directive, null);

  const plan = prepareRotation({
    outDir: paths.outDir,
    workspaceDir: paths.dir,
    keyPath: paths.keyPath,
    windowHours: 72,
    leadHours: 0
  });
  assert.match(plan.successor_fingerprint, /^sha256:[A-Za-z0-9_-]{43}$/);
  assert.ok(!fs.existsSync(path.join(paths.outDir, 'aifeed-private.next.pem')), 'next key removed from the upload overlay');
  assert.ok(fs.existsSync(path.join(paths.dir, 'aifeed-private.next.pem')));
  assert.deepStrictEqual(exportedPrivateKeys(paths.outDir), []);

  const overlap = JSON.parse(fs.readFileSync(path.join(paths.outDir, '.well-known', 'ai.json'), 'utf8'));
  assert.strictEqual(overlap.rotation.successor_fp, plan.successor_fingerprint);
  const oldFingerprint = cryptoLib.fingerprintOf(cryptoLib.decodePublicKey(overlap.identity.public_key));

  project.rotation = overlap.rotation;
  workspace.saveProject(created.id, project);
  const cutoverPlan = cutoverRotation({
    outDir: paths.outDir,
    workspaceDir: paths.dir,
    keyPath: paths.keyPath,
    publicKeyPath: paths.publicKeyPath
  });
  assert.strictEqual(cutoverPlan.signing_key, plan.successor_fingerprint);

  const cutoverManifest = JSON.parse(fs.readFileSync(path.join(paths.outDir, '.well-known', 'ai.json'), 'utf8'));
  assert.notStrictEqual(cutoverManifest.identity.public_key, overlap.identity.public_key);
  project.rotation = cutoverManifest.rotation;
  workspace.saveProject(created.id, project);

  const rebuilt = publishProject({
    ...base,
    project: workspace.project(created.id),
    rotation: project.rotation,
    incremental: false
  });
  assert.strictEqual(rebuilt.processed, 2);

  const finalManifest = JSON.parse(fs.readFileSync(path.join(paths.outDir, '.well-known', 'ai.json'), 'utf8'));
  assert.strictEqual(finalManifest.rotation.predecessor_fp, oldFingerprint);
  const newFingerprint = cryptoLib.fingerprintOf(nodeCrypto.createPublicKey(fs.readFileSync(paths.keyPath)));
  assert.strictEqual(newFingerprint, plan.successor_fingerprint);

  const report = verifyBuild({ outDir: paths.outDir, domain: created.domain, keyPath: paths.keyPath });
  assert.strictEqual(report.result, 'VERIFIED', JSON.stringify(report));
  assert.strictEqual(report.pages.total, 2);
  assert.deepStrictEqual(exportedPrivateKeys(paths.outDir), []);
});
