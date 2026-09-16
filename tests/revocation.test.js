'use strict';

const test = require('node:test');
const assert = require('node:assert');
const nodeCrypto = require('node:crypto');
const cryptoLib = require('../lib/crypto');
const { verifyRevocationDocument, withoutSignatures } = require('../lib/revocation');
const { privateKeyFromSeed, SEED_PRIMARY, SEED_SECONDARY } = require('../tools/gen-vectors');

const NOW = new Date('2026-10-01T00:00:00Z');

function baseRevocation() {
  return {
    version: '0.1',
    domain: 'tokobuku.example',
    status: 'active',
    reason: 'repeated_spam',
    reason_detail: 'test fixture',
    effective_at: '2026-09-01T00:00:00Z',
    expires_at: '2026-12-01T00:00:00Z',
    revoked_by: 'aifeed-governance',
    appeal_url: 'https://aifeed.md/appeal?domain=tokobuku.example',
    keys: [{ fingerprint: 'sha256:xY3nQ7vK2mR8tL5pW1sB6dC0aF4gH9jK2mN3qS4uY0z' }]
  };
}

function signWith(document, seeds) {
  const signed = withoutSignatures(document);
  const signatures = seeds.map((seed) => {
    const privateKey = privateKeyFromSeed(seed);
    return {
      algorithm: 'ed25519',
      key_id: 'test-governance',
      canonicalization: 'jcs-rfc8785',
      signature: cryptoLib.encodeSignature(cryptoLib.signRevocation(privateKey, signed))
    };
  });
  return { ...document, signatures };
}

function keyValue(seed) {
  return cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(privateKeyFromSeed(seed)));
}

test('revocation document with two valid signatures passes threshold', () => {
  const document = signWith(baseRevocation(), [SEED_PRIMARY, SEED_SECONDARY]);
  const result = verifyRevocationDocument(JSON.stringify(document), {
    domain: 'tokobuku.example',
    now: NOW,
    governanceKeys: [keyValue(SEED_PRIMARY), keyValue(SEED_SECONDARY)]
  });
  assert.strictEqual(result.result, 'valid', JSON.stringify(result.errors));
  assert.strictEqual(result.valid_signatures, 2);
  assert.strictEqual(result.status, 'active');
});

test('single valid signature fails the 2-of-3 threshold', () => {
  const document = signWith(baseRevocation(), [SEED_PRIMARY]);
  const result = verifyRevocationDocument(JSON.stringify(document), {
    domain: 'tokobuku.example',
    now: NOW,
    governanceKeys: [keyValue(SEED_PRIMARY), keyValue(SEED_SECONDARY)]
  });
  assert.strictEqual(result.result, 'invalid');
  assert.ok(result.errors.some((error) => error.code === 'revocation_threshold_not_met'));
});

test('unsigned revocation document is rejected', () => {
  const result = verifyRevocationDocument(JSON.stringify(baseRevocation()), {
    domain: 'tokobuku.example',
    now: NOW,
    governanceKeys: [keyValue(SEED_PRIMARY)]
  });
  assert.strictEqual(result.result, 'invalid');
  assert.ok(result.errors.some((error) => error.code === 'revocation_unsigned'));
});

test('tampered status invalidates all signatures', () => {
  const document = signWith(baseRevocation(), [SEED_PRIMARY, SEED_SECONDARY]);
  document.status = 'suspended';
  const result = verifyRevocationDocument(JSON.stringify(document), {
    domain: 'tokobuku.example',
    now: NOW,
    governanceKeys: [keyValue(SEED_PRIMARY), keyValue(SEED_SECONDARY)]
  });
  assert.strictEqual(result.result, 'invalid');
  assert.ok(result.errors.some((error) => error.code === 'revocation_threshold_not_met'));
});

test('domain mismatch and expiry are detected', () => {
  const mismatched = signWith(baseRevocation(), [SEED_PRIMARY, SEED_SECONDARY]);
  const mismatchResult = verifyRevocationDocument(JSON.stringify(mismatched), {
    domain: 'other.example',
    now: NOW,
    governanceKeys: [keyValue(SEED_PRIMARY), keyValue(SEED_SECONDARY)]
  });
  assert.ok(mismatchResult.errors.some((error) => error.code === 'revocation_domain_mismatch'));

  const expired = baseRevocation();
  expired.expires_at = '2026-09-01T00:00:00Z';
  const expiredSigned = signWith(expired, [SEED_PRIMARY, SEED_SECONDARY]);
  const expiredResult = verifyRevocationDocument(JSON.stringify(expiredSigned), {
    domain: 'tokobuku.example',
    now: NOW,
    governanceKeys: [keyValue(SEED_PRIMARY), keyValue(SEED_SECONDARY)]
  });
  assert.ok(expiredResult.errors.some((error) => error.code === 'revocation_document_expired'));
});

test('invalid status and missing expiry are rejected', () => {
  const badStatus = signWith({ ...baseRevocation(), status: 'banned' }, [SEED_PRIMARY, SEED_SECONDARY]);
  const statusResult = verifyRevocationDocument(JSON.stringify(badStatus), {
    domain: 'tokobuku.example',
    now: NOW,
    governanceKeys: [keyValue(SEED_PRIMARY), keyValue(SEED_SECONDARY)]
  });
  assert.strictEqual(statusResult.result, 'invalid');
  assert.ok(statusResult.errors.some((error) => error.code === 'revocation_status_invalid'));

  const noExpiry = { ...baseRevocation() };
  delete noExpiry.expires_at;
  const expiryResult = verifyRevocationDocument(JSON.stringify(signWith(noExpiry, [SEED_PRIMARY, SEED_SECONDARY])), {
    domain: 'tokobuku.example',
    now: NOW,
    governanceKeys: [keyValue(SEED_PRIMARY), keyValue(SEED_SECONDARY)]
  });
  assert.ok(expiryResult.errors.some((error) => error.code === 'revocation_expires_invalid'));
});

test('excessive lifetime produces a warning', () => {
  const long = { ...baseRevocation(), expires_at: '2027-06-01T00:00:00Z' };
  const result = verifyRevocationDocument(JSON.stringify(signWith(long, [SEED_PRIMARY, SEED_SECONDARY])), {
    domain: 'tokobuku.example',
    now: NOW,
    governanceKeys: [keyValue(SEED_PRIMARY), keyValue(SEED_SECONDARY)]
  });
  assert.strictEqual(result.result, 'valid');
  assert.ok(result.warnings.some((warning) => warning.code === 'revocation_expiry_long'));
});

test('domain comparison is case-insensitive with trailing dot', () => {
  const document = signWith(baseRevocation(), [SEED_PRIMARY, SEED_SECONDARY]);
  const result = verifyRevocationDocument(JSON.stringify(document), {
    domain: 'Tokobuku.Example.',
    now: NOW,
    governanceKeys: [keyValue(SEED_PRIMARY), keyValue(SEED_SECONDARY)]
  });
  assert.strictEqual(result.result, 'valid', JSON.stringify(result.errors));
});

test('without governance keys a warning is produced instead of verification', () => {
  const document = signWith(baseRevocation(), [SEED_PRIMARY, SEED_SECONDARY]);
  const result = verifyRevocationDocument(JSON.stringify(document), {
    domain: 'tokobuku.example',
    now: NOW,
    governanceKeys: []
  });
  assert.ok(result.warnings.some((warning) => warning.code === 'revocation_signature_unchecked'));
});
