'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { serialize, escapeString } = require('../lib/jcs');

test('sorts object keys by UTF-16 code units', () => {
  assert.strictEqual(serialize({ b: 1, a: 2, A: 3 }), '{"A":3,"a":2,"b":1}');
});

test('escapes quotes, backslashes, and control characters', () => {
  assert.strictEqual(serialize('a"b\\c\nd'), '"a\\"b\\\\c\\nd"');
  assert.strictEqual(serialize('\u0001'), '"\\u0001"');
  assert.strictEqual(serialize('\t'), '"\\t"');
});

test('keeps non-ASCII characters raw and preserves surrogate pairs', () => {
  assert.strictEqual(serialize('café'), '"café"');
  assert.strictEqual(serialize('😀'), '"😀"');
  assert.strictEqual(escapeString('münchen'), '"münchen"');
});

test('serializes numbers deterministically', () => {
  assert.strictEqual(serialize(20), '20');
  assert.strictEqual(serialize(0), '0');
  assert.strictEqual(serialize(-1), '-1');
  assert.strictEqual(serialize(9007199254740991), '9007199254740991');
});

test('serializes nested structures with sorted keys', () => {
  assert.strictEqual(serialize({ z: [1, { y: 'x' }], a: null }), '{"a":null,"z":[1,{"y":"x"}]}');
});

test('rejects non-finite numbers and lone surrogates', () => {
  assert.throws(() => serialize(NaN), /non-finite/);
  assert.throws(() => serialize(Infinity), /non-finite/);
  assert.throws(() => serialize('\ud800'), /surrogate/);
});
