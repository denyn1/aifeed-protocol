'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parseStrict } = require('../lib/parse');

test('__proto__ keys are own data properties and never pollute prototypes', () => {
  const value = parseStrict('{"__proto__":{"polluted":true},"ok":1}');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(value, '__proto__'), true);
  assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
  assert.strictEqual({}.polluted, undefined);
  assert.strictEqual(value.ok, 1);
});

test('nested __proto__ payloads do not pollute globally', () => {
  parseStrict('{"a":{"__proto__":{"polluted":true}}}');
  parseStrict('{"constructor":{"prototype":{"polluted":true}}}');
  assert.strictEqual({}.polluted, undefined);
  assert.strictEqual(Object.prototype.polluted, undefined);
});

test('raw lone surrogates are rejected', () => {
  assert.throws(
    () => parseStrict('{"a":"\ud800"}'),
    (error) => error.code === 'lone_surrogate'
  );
  assert.throws(
    () => parseStrict('{"a":"\udc00"}'),
    (error) => error.code === 'lone_surrogate'
  );
  const pair = parseStrict('{"a":"\ud83d\ude00"}');
  assert.strictEqual(pair.a, '😀');
});

test('negative zero normalizes so JCS round-trips are stable', () => {
  const value = parseStrict('{"neg":-0}');
  assert.strictEqual(Object.is(value.neg, 0), true);
});

test('numbers beyond the safe range are rejected in every notation', () => {
  assert.throws(
    () => parseStrict('{"big":1234567890123456789e0}'),
    (error) => error.code === 'integer_out_of_range'
  );
  assert.throws(
    () => parseStrict('{"big":1e30}'),
    (error) => error.code === 'integer_out_of_range'
  );
  assert.throws(
    () => parseStrict('{"big":9007199254740992}'),
    (error) => error.code === 'integer_out_of_range'
  );
  assert.strictEqual(parseStrict('{"ok":1.5e2}').ok, 150);
});
