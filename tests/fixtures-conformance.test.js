'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { verifyAll } = require('../lib/validate');
const { verifyRevocationDocument } = require('../lib/revocation');
const { verifyBundle } = require('../lib/bundle');

const ROOT = path.join(__dirname, '..');
const REVOCATION_DIR = path.join(ROOT, 'conformance', 'revocation');
const BUNDLE_DIR = path.join(ROOT, 'conformance', 'fixtures', 'bundles');
const EXAMPLE_DIR = path.join(ROOT, 'conformance', 'fixtures', 'examples');

for (const name of fs.readdirSync(REVOCATION_DIR)) {
  const dir = path.join(REVOCATION_DIR, name);
  const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
  test('revocation fixture ' + name, () => {
    const result = verifyRevocationDocument(
      fs.readFileSync(path.join(dir, 'revocation.json'), 'utf8'),
      {
        domain: expected.domain,
        now: new Date(expected.now),
        governanceKeys: expected.governance_keys,
        threshold: 2
      }
    );
    assert.strictEqual(result.result, expected.result, JSON.stringify(result.errors));
    if (expected.status) assert.strictEqual(result.status, expected.status);
    const errorCodes = result.errors.map((error) => error.code);
    for (const code of expected.errors) {
      assert.ok(errorCodes.includes(code), 'missing error ' + code + ' in ' + errorCodes.join(','));
    }
    const warningCodes = result.warnings.map((warning) => warning.code);
    for (const code of expected.warnings) {
      assert.ok(warningCodes.includes(code), 'missing warning ' + code + ' in ' + warningCodes.join(','));
    }
  });
}

for (const name of fs.readdirSync(BUNDLE_DIR)) {
  const dir = path.join(BUNDLE_DIR, name);
  const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
  test('bundle fixture ' + name, () => {
    const result = verifyBundle({
      bundleDir: dir,
      now: new Date(expected.now),
      bundlerPublicKeyValue: expected.bundler_public_key
    });
    assert.strictEqual(result.result, expected.result, JSON.stringify(result.errors));
    assert.strictEqual(result.manifest_result, 'VERIFIED');
    const warningCodes = result.warnings.map((warning) => warning.code);
    for (const code of expected.warnings) {
      assert.ok(warningCodes.includes(code), 'missing warning ' + code + ' in ' + warningCodes.join(','));
    }
    assert.ok(!warningCodes.includes('bundle_unsigned') || expected.warnings.includes('bundle_unsigned'));
  });
}

for (const name of fs.readdirSync(EXAMPLE_DIR)) {
  const dir = path.join(EXAMPLE_DIR, name);
  const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
  test('signed example fixture ' + name, () => {
    const manifestPath = path.join(dir, 'ai.json');
    const result = verifyAll({
      manifestText: fs.readFileSync(manifestPath, 'utf8'),
      manifestBytes: fs.readFileSync(manifestPath),
      signatureText: fs.readFileSync(path.join(dir, 'ai-signature.json'), 'utf8'),
      domain: expected.domain,
      now: new Date(expected.now)
    });
    assert.strictEqual(result.result, expected.result, JSON.stringify(result.errors));
  });
}
