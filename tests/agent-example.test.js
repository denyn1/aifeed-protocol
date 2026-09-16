'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { buildSite } = require('../lib/site');
const { createAifeedHandler } = require('../integrations/node/aifeed-serve');
const { startFixtureServer } = require('./helpers/tls-server');
const { assess, printReport } = require('../examples/agent/compliant-agent');

function makeSite(baseUrl, domain) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-agent-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<html lang="id"><head><title>Beranda</title></head><body><p>Halo.</p></body></html>');
  fs.mkdirSync(path.join(dir, 'artikel'));
  fs.writeFileSync(path.join(dir, 'artikel', 'satu.html'), '<html lang="id"><head><title>Satu</title></head><body><p>Artikel satu.</p></body></html>');
  const { privateKey } = nodeCrypto.generateKeyPairSync('ed25519');
  const keyPath = path.join(dir, 'aifeed-private.pem');
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  buildSite({ dir, domain, baseUrl, name: 'Agent Test', locale: 'id', contact: 'mailto:ai@127.0.0.1', keyPath, keyId: 'k1', profile: 'both', llms: true, inject: true });
  return dir;
}

test('compliant agent checks AIFeed before fetching and honours permissions', async () => {
  const handlerRef = { current: null };
  const tls = await startFixtureServer((req, res) => {
    if (handlerRef.current && handlerRef.current(req, res)) return;
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('fallback');
  });
  const dir = makeSite(tls.origin, '127.0.0.1');
  handlerRef.current = createAifeedHandler({ root: dir, mako: true });
  try {
    const report = await assess({
      baseUrl: tls.origin,
      use: 'retrieval',
      pagePath: '/artikel/satu',
      fetch: true,
      fetchOptions: { allowPrivate: true, ca: tls.ca }
    });

    assert.strictEqual(report.status, 'VERIFIED');
    assert.strictEqual(report.decision.allowed, true, 'retrieval allowed by default blog policy');
    assert.strictEqual(report.training.allowed, false, 'training denied by default policy');
    assert.strictEqual(report.decision.attribution, 'required');

    assert.ok(report.content, 'content fetched after verification');
    assert.strictEqual(report.content.profile, 'aimd');
    assert.strictEqual(report.content.mako, true);
    assert.strictEqual(report.content.mako_verified, true, 'document signature verified');
    assert.ok(Number(report.content.tokens) > 0, 'token count present');

    const text = printReport(report);
    assert.ok(text.includes('verify    : VERIFIED'), 'report shows verification');
    assert.ok(text.includes('training  : denied'), 'report shows training denial');
    assert.ok(text.includes('signature verified'), 'report shows document verification');
  } finally {
    await tls.close();
  }
});

test('compliant agent reports NO_DECLARATION for sites without AIFeed', async () => {
  const tls = await startFixtureServer((req, res) => {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('nope');
  });
  try {
    const report = await assess({
      baseUrl: tls.origin,
      domain: 'plain.example',
      use: 'training',
      fetchOptions: { allowPrivate: true, ca: tls.ca }
    });
    assert.strictEqual(report.status, 'NO_DECLARATION');
    assert.strictEqual(report.decision.allowed, false);
    assert.strictEqual(report.training.allowed, false);
  } finally {
    await tls.close();
  }
});
