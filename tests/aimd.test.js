'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const makoLib = require('../lib/mako');
const makoHtml = require('../lib/mako-html');
const cryptoLib = require('../lib/crypto');
const { check } = require('../tools/gen-aimd-vectors');

const AIMD_DIR = path.join(__dirname, '..', 'conformance', 'aimd');

test('aimd vectors are present and pass conformance checks', () => {
  let count = 0;
  for (const group of ['positive', 'negative']) {
    const groupDir = path.join(AIMD_DIR, group);
    assert.ok(fs.existsSync(groupDir), 'missing ' + groupDir);
    count += fs.readdirSync(groupDir).length;
  }
  assert.ok(count >= 6, 'expected at least 6 AIFeed Markdown vectors, found ' + count);
  assert.strictEqual(check(), 0);
});

test('document profile detection distinguishes AIFeed Markdown, MAKO, and dual markers', () => {
  assert.strictEqual(makoLib.documentProfile({ aimd: '1.0' }), 'aimd');
  assert.strictEqual(makoLib.documentProfile({ mako: '1.0' }), 'mako');
  assert.strictEqual(makoLib.documentProfile({ aimd: '1.0', mako: '1.0' }), 'aimd');
  assert.strictEqual(makoLib.documentProfile({}), null);
});

test('cross-format replay is rejected by separation and context', () => {
  const { privateKey, publicKey } = cryptoLib.generateKeyPair();
  const bytes = Buffer.from('---\naimd: "1.0"\ntype: article\nentity: "x"\nupdated: 2026-09-15\ntokens: 5\nlanguage: id\n---\n\nBody.\n', 'utf8');
  const url = 'https://berita.example/artikel/aimd';
  const aimdContainer = makoLib.signMakoContainer(privateKey, url, bytes, { context: 'aimd' });
  const makoContainer = makoLib.signMakoContainer(privateKey, url, bytes, { context: 'mako' });

  const asAimd = makoLib.verifyMakoContainer({ containerText: JSON.stringify(aimdContainer), pageUrl: url, bodyBytes: bytes, publicKey, context: 'aimd' });
  assert.strictEqual(asAimd.ok, true);

  const replayed = makoLib.verifyMakoContainer({ containerText: JSON.stringify(makoContainer), pageUrl: url, bodyBytes: bytes, publicKey, context: 'aimd' });
  assert.strictEqual(replayed.ok, false);
  assert.ok(replayed.errors.some((item) => item.code === 'mako_context_invalid'));

  const swapped = makoLib.verifyMakoContainer({ containerText: JSON.stringify(aimdContainer), pageUrl: url, bodyBytes: bytes, publicKey, context: 'mako' });
  assert.strictEqual(swapped.ok, false);
});

test('media type and separation constants are exported', () => {
  assert.strictEqual(makoLib.AIMD_MEDIA_TYPE, 'text/aifeed+markdown');
  assert.strictEqual(makoLib.MAKO_MEDIA_TYPE, 'text/mako+markdown');
  assert.strictEqual(makoLib.AIMD_SEPARATION, 'aifeed.aimd.v1\n');
  assert.strictEqual(makoLib.AIMD_INDEX_SEPARATION, 'aifeed.aimd-index.v1\n');
});

test('global content: non-Latin text, emoji, and IDN (punycode) URLs round-trip', () => {
  const html = [
    '<!doctype html><html lang="ar"><head><title>دليل الذكاء الاصطناعي 🚀</title>',
    '<meta name="description" content="شرح بروتوكول AIFeed بالعربية."></head>',
    '<body><article><h1>دليل الذكاء الاصطناعي 🚀</h1>',
    '<p>مرحبا بالعالم — 日本語のテキスト — contoh teks.</p>',
    '<ul><li>العربية</li><li>日本語</li></ul>',
    '</article></body></html>'
  ].join('\n');
  const converted = makoHtml.htmlToMako(html, { profile: 'aimd', language: 'ar' });
  assert.strictEqual(converted.frontmatter.aimd, '1.0');
  assert.strictEqual(converted.frontmatter.language, 'ar');
  assert.ok(converted.frontmatter.entity.includes('🚀'), 'emoji preserved');
  assert.ok(converted.body.includes('日本語'), 'CJK preserved');
  assert.ok(converted.body.includes('العربية'), 'Arabic preserved');

  const parsed = makoLib.parseFrontmatter(Buffer.from(converted.text, 'utf8'));
  assert.deepStrictEqual(parsed.errors, []);
  assert.deepStrictEqual(makoLib.validateAimdFields(parsed.frontmatter), []);

  const { privateKey, publicKey } = cryptoLib.generateKeyPair();
  const idnUrl = 'https://xn--tko-7qa.example/berita/ai';
  const container = makoLib.signMakoContainer(privateKey, idnUrl, Buffer.from(converted.text, 'utf8'), { context: 'aimd' });
  const verified = makoLib.verifyMakoContainer({
    containerText: JSON.stringify(container),
    pageUrl: idnUrl,
    bodyBytes: Buffer.from(converted.text, 'utf8'),
    publicKey,
    context: 'aimd'
  });
  assert.strictEqual(verified.ok, true, JSON.stringify(verified.errors));
});

test('alternates (translations) are validated for global sites', () => {
  const base = '---\naimd: "1.0"\ntype: article\nentity: "Global"\nupdated: 2026-09-15\ntokens: 10\nlanguage: id\n';
  const valid = makoLib.parseFrontmatter(Buffer.from(base + 'alternates:\n  - url: https://xn--tko-7qa.example/en/ai\n    lang: en\n---\n\nBody.\n', 'utf8'));
  assert.deepStrictEqual(valid.errors, []);
  assert.deepStrictEqual(makoLib.validateAimdFields(valid.frontmatter), []);

  const badLang = makoLib.parseFrontmatter(Buffer.from(base + 'alternates:\n  - url: /en/ai\n    lang: not a tag!\n---\n\nBody.\n', 'utf8'));
  assert.ok(makoLib.validateAimdFields(badLang.frontmatter).some((item) => item.message.includes('alternates.lang')));

  const extraKey = makoLib.parseFrontmatter(Buffer.from(base + 'alternates:\n  - url: /en/ai\n    lang: en\n    price: 10\n---\n\nBody.\n', 'utf8'));
  assert.ok(makoLib.validateAimdFields(extraKey.frontmatter).some((item) => item.message.includes('url and lang')));
});

test('optional AIFeed Markdown fields are validated strictly', () => {
  const base = { aimd: '1.0', type: 'article', entity: 'x', updated: '2026-09-15', tokens: 10, language: 'en' };
  const valid = {
    ...base,
    canonical: 'https://x.example/a',
    tags: ['a', 'b'],
    related: ['/b'],
    audience: 'developers',
    freshness: 'hourly',
    media: { images: 2, cover: { url: '/a.png', alt: 'A' } },
    actions: [{ name: 'do_it', description: 'Do it', method: 'POST', endpoint: '/api/do' }],
    links: { internal: [{ url: '/b', context: 'next' }] }
  };
  assert.deepStrictEqual(makoLib.validateAimdFields(valid), []);

  assert.ok(makoLib.validateAimdFields({ ...base, freshness: 'nope' }).length > 0);
  assert.ok(makoLib.validateAimdFields({ ...base, tags: Array.from({ length: 51 }, () => 't') }).length > 0);
  assert.ok(makoLib.validateAimdFields({ ...base, related: [42] }).length > 0);
  assert.ok(makoLib.validateAimdFields({ ...base, media: { cover: { url: '/a.png' } } }).length > 0);
  assert.ok(makoLib.validateAimdFields({ ...base, media: { images: -1 } }).length > 0);
  assert.ok(makoLib.validateAimdFields({ ...base, actions: [{ name: 'Bad Name', description: 'x' }] }).length > 0);
  assert.ok(makoLib.validateAimdFields({ ...base, actions: [{ name: 'do_it', description: 'x' }, { name: 'do_it', description: 'y' }] }).length > 0);
  assert.ok(makoLib.validateAimdFields({ ...base, links: { internal: [{ url: '/a' }] } }).length > 0);
  assert.ok(makoLib.validateAimdFields({ ...base, summary: 'x'.repeat(301) }).length > 0);
});
