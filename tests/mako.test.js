'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const makoLib = require('../lib/mako');
const cryptoLib = require('../lib/crypto');
const digestLib = require('../lib/digest');
const { check } = require('../tools/gen-mako-vectors');

const MAKO_VECTOR_DIR = path.join(__dirname, '..', 'conformance', 'mako');
const PAGE_URL = 'https://berita.example/artikel/aifeed-protokol';

test('mako vectors are present', () => {
  let count = 0;
  for (const group of ['positive', 'negative']) {
    const groupDir = path.join(MAKO_VECTOR_DIR, group);
    assert.ok(fs.existsSync(groupDir), 'missing ' + groupDir);
    count += fs.readdirSync(groupDir).length;
  }
  assert.ok(count >= 30, 'expected at least 30 MAKO vectors, found ' + count);
});

test('mako vectors pass conformance check', () => {
  assert.strictEqual(check(), 0, 'mako conformance check reported failures');
});

test('sign and verify a MAKO document round-trip', () => {
  const { publicKey, privateKey } = cryptoLib.generateKeyPair();
  const bytes = Buffer.from('---\nmako: "1.0"\ntype: article\nentity: "x"\nupdated: 2026-09-14\ntokens: 5\nlanguage: id\n---\n\n# x\n', 'utf8');
  const container = makoLib.signMakoContainer(privateKey, PAGE_URL, bytes, { signedAt: '2026-09-15T08:00:00Z' });
  const result = makoLib.verifyMakoContainer({
    containerText: JSON.stringify(container),
    pageUrl: PAGE_URL,
    bodyBytes: bytes,
    publicKey
  });
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.ok, true);
});

test('cross-URL replay is rejected', () => {
  const { publicKey, privateKey } = cryptoLib.generateKeyPair();
  const bytes = Buffer.from('---\nmako: "1.0"\n---\n', 'utf8');
  const container = makoLib.signMakoContainer(privateKey, 'https://berita.example/a', bytes);
  const result = makoLib.verifyMakoContainer({
    containerText: JSON.stringify(container),
    pageUrl: 'https://berita.example/b',
    bodyBytes: bytes,
    publicKey
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((item) => item.code === 'mako_url_mismatch'));
});

test('restrict-only rejects loosening overrides', () => {
  const manifestPermissions = {
    default: 'allow',
    usage: { training: 'deny' },
    attribution: 'required'
  };
  const pageBlock = {
    usage: { training: 'allow', summarize: 'allow' },
    attribution: 'none'
  };
  const result = makoLib.resolvePermissions(manifestPermissions, pageBlock, 'restrict-only');
  assert.strictEqual(result.usage.training, 'deny');
  assert.strictEqual(result.attribution, 'required');
  assert.strictEqual(result.warnings.filter((item) => item.code === 'permission_override_rejected').length, 2);
});

test('bidirectional overrides may grant permissions', () => {
  const manifestPermissions = { default: 'deny', usage: { training: 'deny' }, attribution: 'required' };
  const pageBlock = { usage: { training: 'allow' } };
  const result = makoLib.resolvePermissions(manifestPermissions, pageBlock, 'bidirectional');
  assert.strictEqual(result.usage.training, 'allow');
});

test('restrict-only rejects license replacement', () => {
  const base = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
  const manifestPermissions = { default: 'allow', usage: {}, license: base };
  const pageBlock = { license: { name: 'All Rights Reserved', url: 'https://berita.example/license' } };
  const result = makoLib.resolvePermissions(manifestPermissions, pageBlock, 'restrict-only');
  assert.deepStrictEqual(result.license, base);
  assert.ok(result.warnings.some((item) => item.code === 'permission_override_rejected' && item.key === 'license'));
});

test('restrict-only keeps identical license silently', () => {
  const base = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
  const manifestPermissions = { default: 'allow', usage: {}, license: base };
  const pageBlock = { license: { url: 'https://creativecommons.org/licenses/by/4.0/', name: 'CC BY 4.0' } };
  const result = makoLib.resolvePermissions(manifestPermissions, pageBlock, 'restrict-only');
  assert.deepStrictEqual(result.license, base);
  assert.strictEqual(result.warnings.filter((item) => item.key === 'license').length, 0);
});

test('bidirectional may replace license', () => {
  const manifestPermissions = { default: 'allow', usage: {}, license: { name: 'CC BY 4.0' } };
  const pageBlock = { license: { name: 'All Rights Reserved' } };
  const result = makoLib.resolvePermissions(manifestPermissions, pageBlock, 'bidirectional');
  assert.deepStrictEqual(result.license, { name: 'All Rights Reserved' });
  assert.strictEqual(result.warnings.filter((item) => item.key === 'license').length, 0);
});

test('page may add license when manifest has none', () => {
  const manifestPermissions = { default: 'allow', usage: {} };
  const pageBlock = { license: { name: 'CC BY 4.0' } };
  const result = makoLib.resolvePermissions(manifestPermissions, pageBlock, 'restrict-only');
  assert.deepStrictEqual(result.license, { name: 'CC BY 4.0' });
});

test('parser accepts unquoted mako version and lists', () => {
  const text = [
    '---',
    'mako: 1.0',
    'type: article',
    'entity: "x"',
    'updated: 2026-09-14',
    'tokens: 10',
    'language: id',
    'related:',
    '  - /a',
    '  - /b',
    'tags:',
    '  - aifeed',
    'actions:',
    '  - name: add_to_cart',
    '    description: "Add item"',
    '    endpoint: /api/cart',
    '    method: POST',
    '---',
    '',
    'body',
    ''
  ].join('\n');
  const parsed = makoLib.parseFrontmatter(Buffer.from(text, 'utf8'));
  assert.deepStrictEqual(parsed.errors, []);
  assert.strictEqual(parsed.frontmatter.mako, '1.0');
  assert.deepStrictEqual(parsed.frontmatter.related, ['/a', '/b']);
  assert.deepStrictEqual(parsed.frontmatter.tags, ['aifeed']);
  assert.strictEqual(parsed.frontmatter.actions[0].name, 'add_to_cart');
  assert.strictEqual(parsed.frontmatter.actions[0].method, 'POST');
});

test('parser rejects NFD scalars', () => {
  const text = '---\nmako: "1.0"\ntype: article\nentity: "Cafe\u0301"\nupdated: 2026-09-14\ntokens: 5\nlanguage: id\n---\n\nbody\n';
  const parsed = makoLib.parseFrontmatter(Buffer.from(text, 'utf8'));
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.errors.some((item) => item.code === 'not_nfc'));
});

test('parser rejects BOM and oversized frontmatter', () => {
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('---\nmako: "1.0"\n---\n', 'utf8')]);
  assert.ok(makoLib.parseFrontmatter(bom).errors.some((item) => item.code === 'bom_forbidden'));
  const big = Buffer.from('---\n' + 'x: ' + 'a'.repeat(40000) + '\n---\n', 'utf8');
  assert.ok(makoLib.parseFrontmatter(big).errors.some((item) => item.code === 'frontmatter_too_large'));
});

test('index entry digest check detects mismatches', () => {
  const bytes = Buffer.from('body', 'utf8');
  const good = { url: '/a', 'sha-256': digestLib.sha256Base64(bytes) };
  assert.strictEqual(makoLib.checkIndexEntryDigest(good, bytes).ok, true);
  const bad = { url: '/a', 'sha-256': digestLib.sha256Base64(Buffer.from('other', 'utf8')) };
  const result = makoLib.checkIndexEntryDigest(bad, bytes);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.code, 'mako_index_digest_mismatch');
});

test('prototype pollution attempt is neutralized in frontmatter', () => {
  const text = '---\nmako: "1.0"\n__proto__:\n  polluted: true\ntype: article\nentity: "x"\nupdated: 2026-09-14\ntokens: 5\nlanguage: id\n---\n\nbody\n';
  const parsed = makoLib.parseFrontmatter(Buffer.from(text, 'utf8'));
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual({}.polluted, undefined);
  assert.strictEqual(Object.getPrototypeOf(parsed.frontmatter), Object.prototype);
});
