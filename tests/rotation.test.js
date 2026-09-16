'use strict';

const test = require('node:test');
const assert = require('node:assert');
const rotationLib = require('../lib/rotation');
const cryptoLib = require('../lib/crypto');

const NOW = new Date('2026-09-16T12:00:00Z');

function makeKey() {
  const { publicKey } = cryptoLib.generateKeyPair();
  return { value: cryptoLib.encodePublicKey(publicKey), fingerprint: cryptoLib.fingerprintOf(publicKey) };
}

function codes(list) {
  return list.map((entry) => entry.code);
}

test('validateDirective flags conflicting forms', () => {
  const key = makeKey();
  const result = rotationLib.validateDirective({
    validity: { signed_at: '2026-09-16T00:00:00Z' },
    rotation: {
      successor_fp: key.fingerprint,
      predecessor_fp: key.fingerprint,
      effective_at: '2026-09-17T00:00:00Z',
      grace_until: '2026-09-25T00:00:00Z'
    }
  }, NOW);
  assert.deepStrictEqual(codes(result.errors), ['rotation_invalid']);
});

test('validateDirective requires the successor timestamps', () => {
  const key = makeKey();
  const result = rotationLib.validateDirective({
    validity: { signed_at: '2026-09-16T00:00:00Z' },
    rotation: { successor_fp: key.fingerprint }
  }, NOW);
  assert.deepStrictEqual(codes(result.errors), ['rotation_invalid']);
});

test('validateDirective rejects unparsable timestamps', () => {
  const key = makeKey();
  const result = rotationLib.validateDirective({
    validity: { signed_at: '2026-09-16T00:00:00Z' },
    rotation: { successor_fp: key.fingerprint, effective_at: 'tomorrow', grace_until: '2026-09-25T00:00:00Z' }
  }, NOW);
  assert.deepStrictEqual(codes(result.errors), ['rotation_invalid']);
});

test('validateDirective enforces the one-hour hard floor', () => {
  const key = makeKey();
  const result = rotationLib.validateDirective({
    validity: { signed_at: '2026-09-16T00:00:00Z' },
    rotation: { successor_fp: key.fingerprint, effective_at: '2026-09-17T00:00:00Z', grace_until: '2026-09-17T00:30:00Z' }
  }, NOW);
  assert.deepStrictEqual(codes(result.errors), ['rotation_invalid']);
});

test('validateDirective accepts emergency windows without extra codes', () => {
  const key = makeKey();
  const result = rotationLib.validateDirective({
    validity: { signed_at: '2026-09-16T00:00:00Z' },
    rotation: { successor_fp: key.fingerprint, effective_at: '2026-09-17T00:00:00Z', grace_until: '2026-09-17T06:00:00Z' }
  }, NOW);
  assert.deepStrictEqual(codes(result.errors), []);
  assert.deepStrictEqual(codes(result.warnings), []);
});

test('validateDirective reports announced, grace, and completed phases', () => {
  const key = makeKey();
  const manifest = {
    validity: { signed_at: '2026-09-16T00:00:00Z' },
    rotation: { successor_fp: key.fingerprint, effective_at: '2026-09-17T00:00:00Z', grace_until: '2026-09-25T00:00:00Z' }
  };
  const announced = rotationLib.validateDirective(manifest, new Date('2026-09-16T12:00:00Z'));
  assert.strictEqual(announced.phase, 'announced');
  assert.deepStrictEqual(codes(announced.errors), []);

  const grace = rotationLib.validateDirective(manifest, new Date('2026-09-18T00:00:00Z'));
  assert.strictEqual(grace.phase, 'grace');
  assert.deepStrictEqual(codes(grace.warnings), ['grace_accepted']);

  const completed = rotationLib.validateDirective(manifest, new Date('2026-09-26T00:00:00Z'));
  assert.strictEqual(completed.phase, 'completed');
  assert.deepStrictEqual(codes(completed.errors), ['rotation_denied']);
});

test('validateDirective checks predecessor binding', () => {
  const key = makeKey();
  const missing = rotationLib.validateDirective({
    validity: { signed_at: '2026-09-16T00:00:00Z' },
    rotation: { predecessor_fp: key.fingerprint }
  }, NOW);
  assert.deepStrictEqual(codes(missing.errors), ['rotation_invalid']);

  const late = rotationLib.validateDirective({
    validity: { signed_at: '2026-09-16T00:00:00Z' },
    rotation: { predecessor_fp: key.fingerprint, supersedes_at: '2026-09-16T01:00:00Z' }
  }, NOW);
  assert.deepStrictEqual(codes(late.errors), ['rotation_invalid']);

  const bound = rotationLib.validateDirective({
    validity: { signed_at: '2026-09-16T00:00:00Z' },
    rotation: { predecessor_fp: key.fingerprint, supersedes_at: '2026-09-15T23:59:00Z' }
  }, NOW);
  assert.deepStrictEqual(codes(bound.errors), []);
  assert.strictEqual(bound.phase, 'cutover');
});

test('evaluateAnchor reports advisory pk2 problems as warnings', () => {
  const oldKey = makeKey();
  const newKey = makeKey();
  const manifest = {
    validity: { signed_at: '2026-09-16T00:00:00Z' },
    rotation: { successor_fp: newKey.fingerprint, effective_at: '2026-09-17T00:00:00Z', grace_until: '2026-09-25T00:00:00Z' }
  };

  assert.deepStrictEqual(codes(rotationLib.evaluateAnchor(manifest, {}).warnings), ['rotation_anchor_unverified']);
  assert.deepStrictEqual(codes(rotationLib.evaluateAnchor(manifest, { pk2: oldKey.value }).warnings), ['rotation_anchor_unverified']);
  assert.deepStrictEqual(
    codes(rotationLib.evaluateAnchor(manifest, { pk2: newKey.value, effective_at: '2026-09-18T00:00:00Z' }).warnings),
    ['rotation_anchor_unverified']
  );

  const ok = rotationLib.evaluateAnchor(manifest, { pk2: newKey.value, effective_at: '2026-09-17T00:00:00Z' });
  assert.deepStrictEqual(codes(ok.warnings), []);

  const unannounced = rotationLib.evaluateAnchor({ validity: {}, rotation: undefined }, { pk2: newKey.value });
  assert.deepStrictEqual(codes(unannounced.warnings), ['rotation_anchor_unverified']);
});

test('evaluateContinuity pins the first accepted key', () => {
  const key = makeKey();
  const manifest = { identity: { public_key: key.value } };
  const result = rotationLib.evaluateContinuity(null, manifest, NOW);
  assert.strictEqual(result.action, 'pin');
  assert.strictEqual(result.pin.fingerprint, key.fingerprint);
});

test('evaluateContinuity remembers an announced successor', () => {
  const oldKey = makeKey();
  const newKey = makeKey();
  const manifest = {
    identity: { public_key: oldKey.value },
    rotation: { successor_fp: newKey.fingerprint, effective_at: '2026-09-17T00:00:00Z', grace_until: '2026-09-25T00:00:00Z' }
  };
  const result = rotationLib.evaluateContinuity({ fingerprint: oldKey.fingerprint }, manifest, NOW);
  assert.strictEqual(result.action, 'accept');
  assert.strictEqual(result.pin.successor_fp, newKey.fingerprint);

  const cutover = { identity: { public_key: newKey.value } };
  const accepted = rotationLib.evaluateContinuity({ ...result.pin }, cutover, new Date('2026-09-18T00:00:00Z'));
  assert.strictEqual(accepted.action, 'accept_successor');
  assert.strictEqual(accepted.pin.fingerprint, newKey.fingerprint);
  assert.strictEqual(accepted.pin.predecessor_fp, oldKey.fingerprint);
});

test('evaluateContinuity denies an unexpected key change', () => {
  const oldKey = makeKey();
  const otherKey = makeKey();
  const result = rotationLib.evaluateContinuity(
    { fingerprint: oldKey.fingerprint },
    { identity: { public_key: otherKey.value } },
    NOW
  );
  assert.strictEqual(result.action, 'error');
  assert.deepStrictEqual(codes(result.codes), ['rotation_denied']);
});

test('evaluateContinuity resyncs a dormant pin through the predecessor binding', () => {
  const oldKey = makeKey();
  const newKey = makeKey();
  const manifest = {
    identity: { public_key: newKey.value },
    rotation: { predecessor_fp: oldKey.fingerprint, supersedes_at: '2026-09-15T00:00:00Z' }
  };
  const result = rotationLib.evaluateContinuity({ fingerprint: oldKey.fingerprint }, manifest, NOW);
  assert.strictEqual(result.action, 'resync');
  assert.deepStrictEqual(codes(result.codes), ['rotation_resync']);
  assert.strictEqual(result.pin.fingerprint, newKey.fingerprint);
});

test('evaluateContinuity denies rollback to a retired key', () => {
  const oldKey = makeKey();
  const newKey = makeKey();
  const pin = {
    fingerprint: oldKey.fingerprint,
    successor_fp: newKey.fingerprint,
    effective_at: '2026-09-17T00:00:00Z',
    grace_until: '2026-09-25T00:00:00Z'
  };
  const result = rotationLib.evaluateContinuity(pin, { identity: { public_key: oldKey.value } }, new Date('2026-09-26T00:00:00Z'));
  assert.strictEqual(result.action, 'error');
  assert.deepStrictEqual(codes(result.codes), ['rotation_denied']);
});
