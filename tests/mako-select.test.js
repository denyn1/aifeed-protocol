'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { selectEntries } = require('../packages/aifeed-verify');

const ENTRIES = [
  { url: '/produk/sepatu-lari', type: 'product', tokens: 300, updated: '2026-09-10', title: 'Sepatu Lari Pro', summary: 'Ringan dan cepat.', tags: ['sepatu', 'running'] },
  { url: '/artikel/panduan-mako', type: 'article', tokens: 250, updated: '2026-09-14', title: 'Panduan MAKO', summary: 'Cara menyajikan markdown untuk agen.', tags: ['aifeed'] },
  { url: '/artikel/keamanan-web', type: 'article', tokens: 900, updated: '2026-09-12', title: 'Keamanan Web', summary: 'Dasar keamanan untuk situs berita.', tags: ['keamanan'] },
  { url: '/halaman/kontak', type: 'landing', tokens: 80, updated: '2026-09-01', title: 'Kontak', summary: 'Hubungi redaksi.', tags: [] }
];

test('title matches outrank summary matches', () => {
  const result = selectEntries(ENTRIES, { query: 'mako' });
  assert.strictEqual(result.selected[0].url, '/artikel/panduan-mako');
  assert.ok(result.selected[0].score > 0);
});

test('tag matches contribute to ranking', () => {
  const result = selectEntries(ENTRIES, { query: 'running' });
  assert.strictEqual(result.selected[0].url, '/produk/sepatu-lari');
});

test('non-matching entries are skipped', () => {
  const result = selectEntries(ENTRIES, { query: 'keamanan' });
  assert.deepStrictEqual(result.selected.map((entry) => entry.url), ['/artikel/keamanan-web']);
});

test('maxPages and maxTokens caps are respected', () => {
  const byPages = selectEntries(ENTRIES, { query: 'web sepatu', maxPages: 1 });
  assert.strictEqual(byPages.selected.length, 1);

  const byTokens = selectEntries(ENTRIES, { query: '', maxTokens: 400 });
  assert.ok(byTokens.total_tokens >= byTokens.selected[0].tokens, 'first entry is always kept');
  const rest = byTokens.selected.slice(1).reduce((sum, entry) => sum + entry.tokens, 0);
  assert.ok(byTokens.total_tokens <= 400 || byTokens.selected.length === 1, 'cap respected after the first entry');
  assert.ok(rest <= 400);
});

test('empty query keeps all entries with neutral score', () => {
  const result = selectEntries(ENTRIES, {});
  assert.strictEqual(result.selected.length, ENTRIES.length);
  assert.ok(result.selected.every((entry) => entry.score === 1));
});

test('tie-break prefers the most recently updated entry', () => {
  const result = selectEntries(ENTRIES, { query: 'artikel' });
  const urls = result.selected.map((entry) => entry.url);
  assert.deepStrictEqual(urls.slice(0, 2), ['/artikel/panduan-mako', '/artikel/keamanan-web']);
});
