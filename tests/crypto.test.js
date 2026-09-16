'use strict';

const test = require('node:test');
const assert = require('node:assert');
const nodeCrypto = require('node:crypto');
const cryptoLib = require('../lib/crypto');

test('public key encoding is 60 chars with padding and ed25519 prefix', () => {
  const { publicKey } = cryptoLib.generateKeyPair();
  const value = cryptoLib.encodePublicKey(publicKey);
  assert.match(value, /^ed25519:[A-Za-z0-9+/]{59}=$/);
  assert.strictEqual(value.length, 68);
});

test('public key decode round-trips', () => {
  const { publicKey } = cryptoLib.generateKeyPair();
  const value = cryptoLib.encodePublicKey(publicKey);
  const decoded = cryptoLib.decodePublicKey(value);
  assert.strictEqual(cryptoLib.encodePublicKey(decoded), value);
});

test('decode rejects malformed keys', () => {
  assert.throws(() => cryptoLib.decodePublicKey('ed25519:AAAA'), /pk_format|public key/);
  const errors = [];
  try {
    cryptoLib.decodePublicKey('ed25519:AAAA');
  } catch (error) {
    errors.push(error.code);
  }
  assert.deepStrictEqual(errors, ['pk_format']);
});

test('fingerprint is sha256 base64url of SPKI DER', () => {
  const { publicKey } = cryptoLib.generateKeyPair();
  const fingerprint = cryptoLib.fingerprintOf(publicKey);
  assert.match(fingerprint, /^sha256:[A-Za-z0-9_-]{43}$/);
});

test('sign and verify round-trip over canonical message', () => {
  const { privateKey, publicKey } = cryptoLib.generateKeyPair();
  const manifest = { version: '0.1', identity: { domain: 'example.test' } };
  const signature = cryptoLib.signManifest(privateKey, manifest);
  assert.strictEqual(signature.length, 64);
  assert.strictEqual(cryptoLib.verifyManifest(publicKey, manifest, signature), true);
});

test('verification fails on tampered manifest', () => {
  const { privateKey, publicKey } = cryptoLib.generateKeyPair();
  const manifest = { version: '0.1', identity: { domain: 'example.test' } };
  const signature = cryptoLib.signManifest(privateKey, manifest);
  const tampered = { version: '0.1', identity: { domain: 'evil.test' } };
  assert.strictEqual(cryptoLib.verifyManifest(publicKey, tampered, signature), false);
});

test('manifest and revocation domain separation differ', () => {
  const manifest = { a: 1 };
  const manifestBytes = cryptoLib.canonicalMessage(manifest, 'manifest').toString('utf8');
  const revocationBytes = cryptoLib.canonicalMessage(manifest, 'revocation').toString('utf8');
  assert.notStrictEqual(manifestBytes, revocationBytes);
  assert.ok(manifestBytes.startsWith('aifeed.v0.1\n'));
  assert.ok(revocationBytes.startsWith('aifeed-revoke.v0.1\n'));
});

test('signature encoding is 86 base64url chars', () => {
  const bytes = nodeCrypto.randomBytes(64);
  const encoded = cryptoLib.encodeSignature(bytes);
  assert.match(encoded, /^base64url:[A-Za-z0-9_-]{86}$/);
  assert.deepStrictEqual(cryptoLib.decodeSignature(encoded), bytes);
});
