'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { runFuzz } = require('../tools/fuzz');

test('smoke fuzz seed 20260914 (1500 iterations) finds no violations', () => {
  const result = runFuzz({ iterations: 1500, seed: 20260914 });
  assert.strictEqual(result.executed, 1500);
  assert.deepStrictEqual(
    result.failures,
    [],
    JSON.stringify(result.failures.slice(0, 3), null, 2)
  );
});

test('smoke fuzz seed 7 (800 iterations) finds no violations', () => {
  const result = runFuzz({ iterations: 800, seed: 7 });
  assert.deepStrictEqual(result.failures, [], JSON.stringify(result.failures.slice(0, 3), null, 2));
});

test('smoke fuzz is deterministic for a fixed seed', () => {
  const first = runFuzz({ iterations: 200, seed: 99 });
  const second = runFuzz({ iterations: 200, seed: 99 });
  assert.deepStrictEqual(first, second);
});
