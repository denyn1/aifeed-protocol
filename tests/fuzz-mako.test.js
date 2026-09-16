'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { runMakoFuzz } = require('../tools/fuzz-mako');

test('mako fuzz smoke test is clean', () => {
  const result = runMakoFuzz({ iterations: 2000, seed: 1234 });
  assert.strictEqual(result.failures.length, 0, JSON.stringify(result.failures, null, 2));
  assert.ok(result.executed >= 6000, 'expected at least 3 targets per iteration');
});
