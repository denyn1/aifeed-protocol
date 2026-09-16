'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { buildSite } = require('../lib/site');
const { createAifeedHandler } = require('../integrations/node/aifeed-serve');
const sdk = require('../packages/aifeed-verify');

function makeSite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-serve-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<html lang="id"><head><title>Beranda</title></head><body><p>Halo.</p></body></html>');
  fs.mkdirSync(path.join(dir, 'artikel'));
  fs.writeFileSync(path.join(dir, 'artikel', 'satu.html'), '<html lang="id"><head><title>Satu</title></head><body><p>Isi.</p></body></html>');
  fs.writeFileSync(path.join(dir, 'artikel', 'index.html'), '<html lang="id"><head><title>Indeks</title></head><body><p>Daftar.</p></body></html>');
  const { privateKey } = nodeCrypto.generateKeyPairSync('ed25519');
  const keyPath = path.join(dir, 'aifeed-private.pem');
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  buildSite({ dir, domain: 'serve.example', baseUrl: 'https://serve.example', name: 'Serve Test', locale: 'id', contact: 'mailto:ai@serve.example', keyPath, keyId: 'k1', profile: 'both', llms: true, inject: true });
  return dir;
}

function startServer(handler, fallback) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (handler(req, res)) return;
      fallback(req, res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function request(port, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: requestPath,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, buffer, text: buffer.toString('utf8') });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test('node handler serves AIFeed Markdown, manifest, index, and llms.txt with verified signatures', async () => {
  const dir = makeSite();
  const handler = createAifeedHandler({ root: dir, mako: true });
  const { server, port } = await startServer(handler, (req, res) => { res.writeHead(404); res.end('fallback'); });
  try {
    const manifestResponse = await request(port, '/.well-known/ai.json');
    assert.strictEqual(manifestResponse.status, 200);
    const manifest = JSON.parse(manifestResponse.text);
    assert.strictEqual(manifest.identity.domain, 'serve.example');
    assert.strictEqual(manifest.content.profile, 'both');

    const llmsResponse = await request(port, '/llms.txt');
    assert.strictEqual(llmsResponse.status, 200);
    assert.match(llmsResponse.text, /^# Serve Test/);

    const aimdResponse = await request(port, '/artikel/satu', { headers: { Accept: 'text/aifeed+markdown' } });
    assert.strictEqual(aimdResponse.status, 200);
    assert.ok(String(aimdResponse.headers['content-type']).includes('text/aifeed+markdown'));
    assert.strictEqual(aimdResponse.headers['x-aifeed-profile'], 'aimd');
    assert.ok(String(aimdResponse.headers.vary).toLowerCase().includes('accept'));
    const inline = aimdResponse.headers['x-aifeed-signature'];
    assert.ok(typeof inline === 'string' && inline.startsWith('aimd1:'));
    const containerText = Buffer.from(inline.slice('aimd1:'.length), 'base64url').toString('utf8');
    const publicKeyValue = sdk.crypto.encodePublicKey(nodeCrypto.createPublicKey(fs.readFileSync(path.join(dir, 'aifeed-private.pem'))));
    const verified = sdk.mako.verifyMakoContainer({
      containerText,
      pageUrl: 'https://serve.example/artikel/satu',
      bodyBytes: aimdResponse.buffer,
      publicKey: sdk.crypto.decodePublicKey(publicKeyValue),
      context: 'aimd'
    });
    assert.strictEqual(verified.ok, true, JSON.stringify(verified.errors));

    const indexResponse = await request(port, '/.well-known/aifeed-index.json');
    assert.strictEqual(indexResponse.status, 200);
    const makoIndex = await request(port, '/.well-known/mako-index.json');
    assert.strictEqual(makoIndex.status, 200, 'MAKO index served in dual mode');

    const nestedResponse = await request(port, '/artikel', { headers: { Accept: 'text/aifeed+markdown' } });
    assert.strictEqual(nestedResponse.status, 200, 'nested directory index is served');
    assert.ok(String(nestedResponse.headers['content-type']).includes('text/aifeed+markdown'));
    assert.ok(nestedResponse.text.includes('Indeks'), 'nested index content served');

    const makoResponse = await request(port, '/artikel/satu', { headers: { Accept: 'text/mako+markdown' } });
    assert.strictEqual(makoResponse.status, 200, 'MAKO negotiation served');
    assert.ok(String(makoResponse.headers['content-type']).includes('text/mako+markdown'));
    assert.strictEqual(makoResponse.headers['x-aifeed-profile'], 'mako');
    const makoInline = makoResponse.headers['x-aifeed-signature'];
    assert.ok(typeof makoInline === 'string' && makoInline.startsWith('mako1:'));
    const makoContainerText = Buffer.from(makoInline.slice('mako1:'.length), 'base64url').toString('utf8');
    const makoVerified = sdk.mako.verifyMakoContainer({
      containerText: makoContainerText,
      pageUrl: 'https://serve.example/artikel/satu',
      bodyBytes: makoResponse.buffer,
      publicKey: sdk.crypto.decodePublicKey(publicKeyValue),
      context: 'mako'
    });
    assert.strictEqual(makoVerified.ok, true, JSON.stringify(makoVerified.errors));
    assert.ok(makoResponse.text.includes('mako: "1.0"'), 'dual marker in MAKO file');

    const htmlFallback = await request(port, '/artikel/satu');
    assert.strictEqual(htmlFallback.text, 'fallback');
  } finally {
    await new Promise((done) => server.close(done));
  }
});

test('node handler refuses path traversal and non-GET methods', async () => {
  const dir = makeSite();
  const handler = createAifeedHandler({ root: dir });
  const { server, port } = await startServer(handler, (req, res) => { res.writeHead(404); res.end('fallback'); });
  try {
    const traversal = await request(port, '/..%2f..%2fetc%2fpasswd', { headers: { Accept: 'text/aifeed+markdown' } });
    assert.strictEqual(traversal.text, 'fallback');
    const method = await request(port, '/', { method: 'POST' });
    assert.strictEqual(method.text, 'fallback');
  } finally {
    await new Promise((done) => server.close(done));
  }
});
