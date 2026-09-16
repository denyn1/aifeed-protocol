'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { resolvePinnedAddress, isPrivateAddress, parseTxtRecord } = require('../lib/remote');

test('private address detection covers reserved ranges', () => {
  assert.strictEqual(isPrivateAddress('127.0.0.1'), true);
  assert.strictEqual(isPrivateAddress('10.0.0.1'), true);
  assert.strictEqual(isPrivateAddress('192.168.1.1'), true);
  assert.strictEqual(isPrivateAddress('169.254.169.254'), true);
  assert.strictEqual(isPrivateAddress('100.64.0.1'), true);
  assert.strictEqual(isPrivateAddress('::1'), true);
  assert.strictEqual(isPrivateAddress('fe80::1'), true);
  assert.strictEqual(isPrivateAddress('fd00::1'), true);
  assert.strictEqual(isPrivateAddress('93.184.216.34'), false);
  assert.strictEqual(isPrivateAddress('2001:4860:4860::8888'), false);
});

test('resolvePinnedAddress blocks private resolutions by default', async () => {
  await assert.rejects(
    resolvePinnedAddress('localhost'),
    (error) => error.code === 'private_address_blocked'
  );
  await assert.rejects(
    resolvePinnedAddress('127.0.0.1'),
    (error) => error.code === 'private_address_blocked'
  );
});

test('resolvePinnedAddress returns a pinned address when allowed', async () => {
  const pinned = await resolvePinnedAddress('localhost', { allowPrivate: true });
  assert.ok(pinned.address);
  assert.ok(pinned.family === 4 || pinned.family === 6);
});

test('parseTxtRecord parses single record', () => {
  const record = parseTxtRecord('v=aifeed1; pk=ed25519:abc; fp=sha256:xyz');
  assert.strictEqual(record.v, 'aifeed1');
  assert.strictEqual(record.pk, 'ed25519:abc');
  assert.strictEqual(record.fp, 'sha256:xyz');
});

test('parseTxtRecord rejects duplicate keys', () => {
  assert.throws(
    () => parseTxtRecord('v=aifeed1; pk=ed25519:aaa; pk=ed25519:bbb'),
    (error) => error.code === 'txt_duplicate_key'
  );
});

test('normalizeDomain enforces global hostname rules', () => {
  const { normalizeDomain } = require('../lib/validate');
  assert.strictEqual(normalizeDomain('Example.COM.'), 'example.com');
  assert.strictEqual(normalizeDomain('münchen.de'), 'xn--mnchen-3ya.de');
  assert.strictEqual(normalizeDomain('a'.repeat(64) + '.com'), null);
  assert.strictEqual(normalizeDomain('a'.repeat(250) + '.de'), null);
  assert.strictEqual(normalizeDomain('-bad.example'), null);
  assert.strictEqual(normalizeDomain('bad-.example'), null);
  assert.strictEqual(normalizeDomain('user@example.com'), null);
  assert.strictEqual(normalizeDomain('example.com:443'), null);
});

test('fetchText rejects non-standard ports and credentials without network', async () => {
  const { fetchText } = require('../lib/remote');
  await assert.rejects(
    fetchText('https://example.com:8443/.well-known/ai.json'),
    (error) => error.code === 'port_not_allowed'
  );
  await assert.rejects(
    fetchText('https://user:pass@example.com/.well-known/ai.json'),
    (error) => error.code === 'credentials_not_allowed'
  );
  await assert.rejects(
    fetchText('http://example.com/.well-known/ai.json'),
    (error) => error.code === 'https_required'
  );
});
