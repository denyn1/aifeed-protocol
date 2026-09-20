'use strict';

const test = require('node:test');
const assert = require('node:assert');
const makoHtml = require('../lib/mako-html');
const makoLib = require('../lib/mako');

const SAMPLE = [
  '<!doctype html><html lang="id-ID"><head><title>Panduan AIFeed</title>',
  '<meta name="description" content="Cara memasang AIFeed &amp; MAKO.">',
  '<link rel="canonical" href="https://berita.example/artikel/aifeed"></head>',
  '<body><nav>Menu</nav><article><h1>Panduan AIFeed</h1>',
  '<p>AIFeed adalah <strong>lapisan kepercayaan</strong> &mdash; aman.</p>',
  '<ul><li>Manifest bertanda tangan</li><li>Anchor DNS</li></ul>',
  '<p>Baca <a href="https://aifeed.md">dokumentasi</a>.</p>',
  '<pre><code>aifeed mako sign file.mako.md</code></pre>',
  '</article><footer>footer text</footer></body></html>'
].join('\n');

test('htmlToMako produces parseable MAKO with expected structure', () => {
  const result = makoHtml.htmlToMako(SAMPLE, {});
  assert.strictEqual(result.frontmatter.mako, '1.0');
  assert.strictEqual(result.frontmatter.type, 'article');
  assert.strictEqual(result.frontmatter.entity, 'Panduan AIFeed');
  assert.strictEqual(result.frontmatter.language, 'id');
  assert.strictEqual(result.frontmatter.canonical, 'https://berita.example/artikel/aifeed');
  assert.ok(result.frontmatter.tokens >= 1);
  assert.ok(result.body.includes('# Panduan AIFeed'));
  assert.ok(result.body.includes('**lapisan kepercayaan**'));
  assert.ok(result.body.includes('- Manifest bertanda tangan'));
  assert.ok(result.body.includes('[dokumentasi](https://aifeed.md)'));
  assert.ok(result.body.includes('```'));
  assert.ok(result.body.includes('\u2014'));
  assert.ok(!result.body.includes('Menu'));
  assert.ok(!result.body.includes('footer text'));

  const parsed = makoLib.parseFrontmatter(Buffer.from(result.text, 'utf8'));
  assert.deepStrictEqual(parsed.errors, []);
  assert.deepStrictEqual(makoLib.validateMakoFields(parsed.frontmatter), []);
});

test('htmlToMako truncates over-long bodies with a warning', () => {
  const long = '<html><body><p>' + 'kata '.repeat(3000) + '</p></body></html>';
  const result = makoHtml.htmlToMako(long, { maxTokens: 100 });
  assert.ok(result.truncated);
  assert.ok(result.warnings.some((item) => item.code === 'mako_body_truncated'));
  assert.ok(result.frontmatter.tokens <= 100);
});

test('htmlToMako includes aifeed block when provided', () => {
  const result = makoHtml.htmlToMako(SAMPLE, {
    aifeed: { policy_version: '0.2', usage: { training: 'deny' }, attribution: 'required' }
  });
  assert.strictEqual(result.frontmatter.aifeed.policy_version, '0.2');
  assert.strictEqual(result.frontmatter.aifeed.usage.training, 'deny');
  const parsed = makoLib.parseFrontmatter(Buffer.from(result.text, 'utf8'));
  assert.deepStrictEqual(parsed.errors, []);
  assert.deepStrictEqual(makoLib.validateMakoFields(parsed.frontmatter), []);
});

test('invalid type falls back to article with warning', () => {
  const result = makoHtml.htmlToMako(SAMPLE, { type: 'not-a-type' });
  assert.strictEqual(result.frontmatter.type, 'article');
  assert.ok(result.warnings.some((item) => item.code === 'mako_type_invalid'));
});

test('assets (images, video, documents) are listed as links in frontmatter and body', () => {
  const html = [
    '<html lang="id"><head><title>Aset</title></head><body><article>',
    '<h1>Halaman Aset</h1>',
    '<p>Lihat <a href="/laporan.pdf">laporan lengkap</a> dan <a href="/arsip.zip">unduhan arsip</a>.</p>',
    '<img src="/uploads/sampul.webp" alt="Sampul">',
    '<video controls><source src="/media/demo.mp4" type="video/mp4"></video>',
    '<audio src="/media/podcast.mp3"></audio>',
    '<a href="/panduan.docx">Panduan</a>',
    '<p><a href="/halaman-lain">Tautan biasa bukan aset</a></p>',
    '</article></body></html>'
  ].join('\n');
  const result = makoHtml.htmlToMako(html, {});
  const assets = result.frontmatter.aifeed.assets;
  const urls = assets.map((item) => item.url);
  assert.ok(urls.includes('/uploads/sampul.webp'));
  assert.ok(urls.includes('/media/demo.mp4'));
  assert.ok(urls.includes('/media/podcast.mp3'));
  assert.ok(urls.includes('/laporan.pdf'));
  assert.ok(urls.includes('/arsip.zip'));
  assert.ok(urls.includes('/panduan.docx'));
  assert.ok(!urls.includes('/halaman-lain'), 'plain page links are not assets');
  assert.strictEqual(assets.find((item) => item.url === '/laporan.pdf').type, 'document');
  assert.strictEqual(assets.find((item) => item.url === '/arsip.zip').type, 'archive');
  assert.strictEqual(assets.find((item) => item.url === '/media/demo.mp4').type, 'video');
  assert.strictEqual(assets.find((item) => item.url === '/media/podcast.mp3').type, 'audio');
  assert.ok(result.body.includes('## Media & Unduhan'));
  assert.ok(result.body.includes('- [laporan lengkap](/laporan.pdf) \u2014 document'));

  const parsed = makoLib.parseFrontmatter(Buffer.from(result.text, 'utf8'));
  assert.deepStrictEqual(parsed.errors, []);
  assert.deepStrictEqual(makoLib.validateMakoFields(parsed.frontmatter), []);
});

test('asset entries carry mime and optional size/sha-256 details', () => {
  const html = '<html><body><article><img src="/media/cover.webp" alt="Cover">' +
    '<p><a href="/laporan.pdf" download>Laporan</a></p></article></body></html>';
  const plain = makoHtml.htmlToMako(html, {});
  const plainAssets = plain.frontmatter.aifeed.assets;
  assert.strictEqual(plainAssets.find((item) => item.url === '/media/cover.webp').mime, 'image/webp');
  assert.strictEqual(plainAssets.find((item) => item.url === '/laporan.pdf').mime, 'application/pdf');
  assert.ok(!('size' in plainAssets[0]), 'no size without a resolver');

  const digest = 'A'.repeat(43) + '=';
  const detailed = makoHtml.htmlToMako(html, {
    assetDetails: (url) => (url === '/media/cover.webp' ? { size: 12, sha256: digest } : null)
  });
  const cover = detailed.frontmatter.aifeed.assets.find((item) => item.url === '/media/cover.webp');
  assert.strictEqual(cover.size, 12);
  assert.strictEqual(cover['sha-256'], digest);
  assert.ok(!('size' in detailed.frontmatter.aifeed.assets.find((item) => item.url === '/laporan.pdf')));

  const parsed = makoLib.parseFrontmatter(Buffer.from(detailed.text, 'utf8'));
  assert.deepStrictEqual(parsed.errors, []);
  assert.deepStrictEqual(makoLib.validateMakoFields(parsed.frontmatter), []);
});

test('assets section and structured list can be disabled independently', () => {
  const html = '<html><body><article><p><a href="/file.pdf">PDF</a></p></article></body></html>';
  const withoutSection = makoHtml.htmlToMako(html, { assetsSection: false });
  assert.strictEqual(withoutSection.frontmatter.aifeed.assets.length, 1);
  assert.ok(!withoutSection.body.includes('Media & Unduhan'));

  const withoutAssets = makoHtml.htmlToMako(html, { assets: false });
  assert.strictEqual(withoutAssets.frontmatter.aifeed, undefined);
  assert.ok(!withoutAssets.body.includes('Media & Unduhan'));
});
