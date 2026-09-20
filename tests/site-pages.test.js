'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { renderStudioHtml, renderUpdatesHtml, renderMarkdown } = require('../tools/render-html');

test('studio page documents the local publisher app and links the guides', () => {
  const html = renderStudioHtml();
  assert.ok(html.startsWith('<!doctype html>'), 'doctype');
  assert.ok(html.includes('AIFeed Studio'), 'title');
  assert.ok(html.includes('npm run studio'), 'quick start command');
  assert.ok(html.includes('127.0.0.1:7777'), 'local address');

  for (const link of ['publisher-ai-guide.md', 'publisher-ai-guide.id.md', 'publisher-ai-guide.zh.md']) {
    assert.ok(html.includes(link), link);
  }
  const repoLinks = html.match(/href="https:\/\/github\.com\/[^"]+"/g) || [];
  assert.ok(repoLinks.length >= 4, 'repository links');
  for (const link of repoLinks) {
    assert.ok(link.includes('github.com/denyn1/aifeed-protocol/'), link);
  }
});

test('updates page renders all three changelogs from source', () => {
  const html = renderUpdatesHtml({
    changelogs: {
      en: '# Title\n\n## Added\n\n- fast **safe** sites\n',
      id: '# Judul\n\n## Ditambahkan\n\n- situs **aman**\n',
      zh: '# 标题\n\n## 新增\n\n- **安全**站点\n'
    }
  });
  assert.ok(html.includes('panel-en') && html.includes('panel-id') && html.includes('panel-zh'), 'language panels');
  assert.ok(html.includes('<strong>safe</strong>'), 'bold rendered');
  assert.ok(html.includes('lang="id"') && html.includes('lang="zh"'), 'language attributes');
  assert.ok(html.includes('blob/main/CHANGELOG.md'), 'source link');
});

test('markdown renderer keeps list continuations and escapes html', () => {
  const html = renderMarkdown('- one\n  continued\n- two <script>alert(1)</script>\n');
  assert.ok(html.includes('<li>one continued</li>'), html);
  assert.ok(!html.includes('<script>'), 'escaped');
});
