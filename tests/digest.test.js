'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sha256Base64, sha512Base64, rawDigestOf, verifyRawDigest, parseContentDigest, verifyContentDigest } = require('../lib/digest');

test('sha256 base64 matches known vector', () => {
  assert.strictEqual(sha256Base64(Buffer.from('hello', 'utf8')), 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=');
});

test('rawDigestOf produces a valid raw-bytes digest object', () => {
  const digest = rawDigestOf(Buffer.from('{}', 'utf8'));
  assert.match(digest['sha-256'], /^[A-Za-z0-9+/]{43}=$/);
  assert.strictEqual(digest.applies_to, 'raw-bytes');
  assert.strictEqual(verifyRawDigest(digest, Buffer.from('{}', 'utf8')).ok, true);
});

test('raw digest detects byte changes', () => {
  const digest = rawDigestOf(Buffer.from('{"a":1}', 'utf8'));
  const result = verifyRawDigest(digest, Buffer.from('{ "a":1}', 'utf8'));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.errors[0].code, 'raw_digest_mismatch');
});

test('raw digest rejects malformed shapes', () => {
  const bad = verifyRawDigest({ 'sha-256': 'not-base64', applies_to: 'canonical' }, Buffer.from('{}'));
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.errors.some((error) => error.code === 'signature_malformed'));
});

test('parseContentDigest handles structured field syntax', () => {
  const parsed = parseContentDigest('sha-256=:LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=:, sha-512=:AAAA:;foo=bar');
  assert.strictEqual(parsed['sha-256'], 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=');
  assert.strictEqual(parsed['sha-512'], 'AAAA');
});

test('parseContentDigest rejects malformed input', () => {
  assert.throws(() => parseContentDigest('sha-256=not-a-byte-sequence'), /content_digest_malformed|byte sequence/);
  assert.throws(() => parseContentDigest(''), /content_digest_malformed|empty/);
});

test('verifyContentDigest accepts matching digest', () => {
  const body = Buffer.from('{"hello":"world"}', 'utf8');
  const header = 'sha-256=:' + sha256Base64(body) + ':';
  const result = verifyContentDigest(header, body);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.algorithms, ['sha-256']);
});

test('verifyContentDigest rejects mismatching digest', () => {
  const header = 'sha-256=:' + sha256Base64(Buffer.from('other', 'utf8')) + ':';
  const result = verifyContentDigest(header, Buffer.from('{"hello":"world"}', 'utf8'));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.errors[0].code, 'content_digest_mismatch');
});

test('verifyContentDigest rejects unsupported algorithms', () => {
  const result = verifyContentDigest('md5=:XrY7u+Ae7tCTyyK7j1rNww==:', Buffer.from('x'));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.errors[0].code, 'content_digest_unsupported');
});
