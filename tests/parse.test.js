'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parseStrict, StrictParseError } = require('../lib/parse');

function expectCode(text, code, options) {
  try {
    parseStrict(text, options);
  } catch (error) {
    assert.ok(error instanceof StrictParseError, 'expected StrictParseError, got ' + error.name);
    assert.strictEqual(error.code, code);
    return;
  }
  assert.fail('expected parse to fail with ' + code);
}

test('parses valid JSON', () => {
  const value = parseStrict('{"a":[1,2,{"b":"x\\n"}],"c":true,"d":null,"e":-3}');
  assert.deepStrictEqual(value, { a: [1, 2, { b: 'x\n' }], c: true, d: null, e: -3 });
});

test('rejects duplicate keys', () => {
  expectCode('{"a":1,"a":2}', 'duplicate_key');
});

test('rejects non-NFC strings', () => {
  expectCode('{"a":"cafe\u0301"}', 'not_nfc');
  assert.deepStrictEqual(parseStrict('{"a":"café"}').a, 'café');
});

test('rejects floats when integersOnly is set', () => {
  expectCode('{"a":1.5}', 'float_not_allowed', { integersOnly: true });
  assert.strictEqual(parseStrict('{"a":1.5}').a, 1.5);
});

test('rejects integers outside the safe range', () => {
  expectCode('{"a":9007199254740992}', 'integer_out_of_range', { integersOnly: true });
  assert.strictEqual(parseStrict('{"a":9007199254740991}', { integersOnly: true }).a, 9007199254740991);
});

test('rejects excessive nesting depth', () => {
  let deep = '1';
  for (let i = 0; i < 12; i++) deep = '{"a":' + deep + '}';
  expectCode(deep, 'max_depth', { maxDepth: 10 });
});

test('rejects lone surrogate escapes', () => {
  expectCode('{"a":"\\ud800"}', 'lone_surrogate');
  assert.strictEqual(parseStrict('{"a":"\\ud83d\\ude00"}').a, '😀');
});

test('rejects trailing data and malformed input', () => {
  expectCode('{"a":1} x', 'parse_error');
  expectCode('{"a":}', 'parse_error');
  expectCode('{"a" 1}', 'parse_error');
  expectCode('nul', 'parse_error');
});
