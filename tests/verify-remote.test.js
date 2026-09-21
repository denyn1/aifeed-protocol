'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startFixtureServer, sendJson } = require('./helpers/tls-server');
const { initSite } = require('../lib/scaffold');
const sdk = require('../packages/aifeed-verify');

function makeManifest(domain) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-remote-'));
  initSite({ dir, domain, profile: 'news', force: true });
  return {
    manifest: fs.readFileSync(path.join(dir, '.well-known', 'ai.json')),
    signature: fs.readFileSync(path.join(dir, '.well-known', 'ai-signature.json'))
  };
}

function serve(files) {
  return startFixtureServer((request, response) => {
    if (request.url === '/.well-known/ai.json') {
      sendJson(response, files.manifest);
      return;
    }
    if (request.url === '/.well-known/ai-signature.json') {
      sendJson(response, files.signature);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  });
}

test('verifyRemote verifies a remote manifest and reports the DNS anchor state', async () => {
  const files = makeManifest('serve.example');
  const fixture = await serve(files);
  try {
    const out = await sdk.verifyRemote('serve.example', {
      baseUrl: fixture.origin,
      domain: 'serve.example',
      ca: fixture.ca,
      allowPrivate: true,
      checkAnchor: false
    });
    assert.strictEqual(out.result, 'VERIFIED', JSON.stringify(out.errors));
    assert.strictEqual(out.anchor.status, 'skipped');
    assert.strictEqual(out.discovered_via, 'fallback');
    assert.ok(String(out.signature_url).endsWith('/.well-known/ai-signature.json'), out.signature_url);
    assert.strictEqual(out.manifest.identity.domain, 'serve.example');
  } finally {
    await fixture.close();
  }
});

test('verifyRemote rejects a tampered remote manifest', async () => {
  const files = makeManifest('serve.example');
  const tampered = JSON.parse(files.manifest.toString('utf8'));
  tampered.identity.name = 'Tampered';
  const fixture = await serve({
    manifest: Buffer.from(JSON.stringify(tampered, null, 2) + '\n', 'utf8'),
    signature: files.signature
  });
  try {
    const out = await sdk.verifyRemote('serve.example', {
      baseUrl: fixture.origin,
      domain: 'serve.example',
      ca: fixture.ca,
      allowPrivate: true,
      checkAnchor: false
    });
    assert.strictEqual(out.result, 'UNVERIFIED');
    assert.ok(
      out.errors.some((error) => ['raw_digest_mismatch', 'bad_signature'].includes(error.code)),
      JSON.stringify(out.errors)
    );
  } finally {
    await fixture.close();
  }
});
