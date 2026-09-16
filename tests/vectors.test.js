'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { verifyAll } = require('../lib/validate');

const VECTOR_DIR = path.join(__dirname, '..', 'conformance', 'vectors');

function loadCases(group) {
  const groupDir = path.join(VECTOR_DIR, group);
  return fs.readdirSync(groupDir).map((name) => {
    const dir = path.join(groupDir, name);
    return {
      name: group + '/' + name,
      manifestText: fs.readFileSync(path.join(dir, 'ai.json'), 'utf8'),
      signatureText: fs.readFileSync(path.join(dir, 'ai-signature.json'), 'utf8'),
      expected: JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'))
    };
  });
}

const cases = [...loadCases('positive'), ...loadCases('negative')];

test('conformance vectors are present', () => {
  assert.ok(cases.length >= 20, 'expected at least 20 vectors, found ' + cases.length);
});

for (const testCase of cases) {
  test('vector ' + testCase.name + ' expects ' + testCase.expected.result, () => {
    const result = verifyAll({
      manifestText: testCase.manifestText,
      signatureText: testCase.signatureText,
      domain: testCase.expected.domain,
      now: new Date(testCase.expected.now)
    });
    const errorCodes = result.errors.map((error) => error.code);
    const warningCodes = result.warnings.map((warning) => warning.code);
    assert.strictEqual(result.result, testCase.expected.result, 'result mismatch; errors=' + errorCodes.join(','));
    for (const code of testCase.expected.errors) {
      assert.ok(errorCodes.includes(code), 'missing expected error ' + code + '; got ' + errorCodes.join(','));
    }
    for (const code of testCase.expected.warnings || []) {
      assert.ok(warningCodes.includes(code), 'missing expected warning ' + code + '; got ' + warningCodes.join(','));
    }
  });
}
