'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('cloudflare worker negotiates AIFeed markdown from its assets binding', async () => {
  const worker = await import(pathToFileURL(path.join(__dirname, '..', 'integrations', 'cloudflare', 'worker.mjs')).href);
  assert.strictEqual(worker.negotiateTarget('/', 'text/aifeed+markdown').target, '/index.aifeed.md');
  assert.strictEqual(worker.negotiateTarget('/dir/', 'text/aifeed+markdown').target, '/dir/index.aifeed.md');
  assert.strictEqual(worker.negotiateTarget('/dir/page', 'text/aifeed+markdown').target, '/dir/page.aifeed.md');
  assert.strictEqual(worker.negotiateTarget('/dir/page.html', 'text/mako+markdown').target, '/dir/page.mako.md');
  assert.strictEqual(worker.negotiateTarget('/page', 'text/html'), null);

  const store = {
    '/page.aifeed.md': '---\naimd: "1.0"\n---\n\nbody\n',
    '/page.aifeed.md.sig': '{"algorithm":"ed25519","context":"aimd"}'
  };
  const env = {
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        const body = store[url.pathname];
        if (!body) return new Response('not found', { status: 404 });
        return new Response(body, { status: 200 });
      }
    }
  };

  const negotiated = await worker.default.fetch(new Request('https://example.com/page', {
    headers: { accept: 'text/aifeed+markdown' }
  }), env);
  assert.strictEqual(negotiated.status, 200);
  assert.strictEqual(negotiated.headers.get('content-type'), 'text/aifeed+markdown; charset=utf-8');
  assert.strictEqual(negotiated.headers.get('vary'), 'accept');
  assert.strictEqual(negotiated.headers.get('x-aifeed-profile'), 'aimd');
  assert.ok(String(negotiated.headers.get('x-aifeed-signature')).startsWith('aimd1:'));
  assert.strictEqual(await negotiated.text(), store['/page.aifeed.md']);

  const plain = await worker.default.fetch(new Request('https://example.com/page', {
    headers: { accept: 'text/html' }
  }), env);
  assert.strictEqual(plain.status, 404);
});
