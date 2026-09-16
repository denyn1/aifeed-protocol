'use strict';

const test = require('node:test');
const assert = require('node:assert');
const nodeCrypto = require('node:crypto');
const cryptoLib = require('../lib/crypto');
const remote = require('../lib/remote');
const { sha256Base64, rawDigestOf, verifyContentDigest } = require('../lib/digest');
const { verifyAll } = require('../lib/validate');
const { startFixtureServer, sendJson } = require('./helpers/tls-server');
const { privateKeyFromSeed, SEED_PRIMARY } = require('../tools/gen-vectors');

const NOW = new Date('2026-10-01T00:00:00Z');

function buildSite() {
  const privateKey = privateKeyFromSeed(SEED_PRIMARY);
  const publicKeyValue = cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(privateKey));
  const manifest = {
    $schema: 'https://aifeed.md/schema/ai-json/v0.1.json',
    version: '0.1',
    identity: {
      domain: '127.0.0.1',
      name: 'Fixture Site',
      type: 'docs',
      locale: 'en',
      contact: 'https://127.0.0.1/contact',
      public_key: publicKeyValue,
      key_id: 'fixture-2026-key1',
      signature_url: '/.well-known/ai-signature.json'
    },
    validity: { signed_at: '2026-09-14T08:00:00Z', expires_at: '2027-09-14T08:00:00Z' },
    content: { languages: ['en'] },
    permissions: {
      default: 'deny',
      usage: { search: 'allow', retrieval: 'allow', input: 'allow', training: 'deny' },
      attribution: 'required'
    },
    revocation: {
      list_url: 'https://aifeed.md/revoke/v1/127.0.0.1.json',
      maximum_check_interval_hours: 24
    },
    metadata: { generated_at: '2026-09-14T08:00:00Z' }
  };
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  const signatureBytes = cryptoLib.signManifest(privateKey, manifest);
  const container = {
    algorithm: 'ed25519',
    canonicalization: 'jcs-rfc8785',
    signature: cryptoLib.encodeSignature(signatureBytes),
    raw_digest: rawDigestOf(Buffer.from(manifestText, 'utf8'))
  };
  return { manifestText, signatureText: JSON.stringify(container, null, 2) + '\n' };
}

async function withServer(handler, run) {
  const fixture = await startFixtureServer(handler);
  try {
    return await run(fixture);
  } finally {
    await fixture.close();
  }
}

test('happy path: fetch with Content-Digest then full verification', async () => {
  const site = buildSite();
  await withServer((request, response) => {
    if (request.url === '/.well-known/ai.json') {
      const body = Buffer.from(site.manifestText, 'utf8');
      sendJson(response, site.manifestText, { 'content-digest': 'sha-256=:' + sha256Base64(body) + ':' });
      return;
    }
    if (request.url === '/.well-known/ai-signature.json') {
      sendJson(response, site.signatureText, {
        'content-digest': 'sha-256=:' + sha256Base64(Buffer.from(site.signatureText, 'utf8')) + ':'
      });
      return;
    }
    response.writeHead(404);
    response.end();
  }, async (fixture) => {
    const manifestResponse = await remote.fetchText(fixture.origin + '/.well-known/ai.json', {
      ca: fixture.ca,
      allowPrivate: true,
      maxBytes: 100 * 1024
    });
    const digestCheck = verifyContentDigest(manifestResponse.headers['content-digest'], manifestResponse.buffer);
    assert.strictEqual(digestCheck.ok, true, JSON.stringify(digestCheck.errors));

    const signatureResponse = await remote.fetchText(fixture.origin + '/.well-known/ai-signature.json', {
      ca: fixture.ca,
      allowPrivate: true,
      maxBytes: 2 * 1024
    });

    const result = verifyAll({
      manifestText: manifestResponse.text,
      manifestBytes: manifestResponse.buffer,
      signatureText: signatureResponse.text,
      domain: '127.0.0.1',
      now: NOW
    });
    assert.strictEqual(result.result, 'VERIFIED', JSON.stringify(result.errors));
  });
});

test('Content-Digest mismatch is detected', async () => {
  await withServer((request, response) => {
    sendJson(response, '{"a":1}', { 'content-digest': 'sha-256=:' + sha256Base64(Buffer.from('other')) + ':' });
  }, async (fixture) => {
    const response = await remote.fetchText(fixture.origin + '/x', { ca: fixture.ca, allowPrivate: true });
    const result = verifyContentDigest(response.headers['content-digest'], response.buffer);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.errors[0].code, 'content_digest_mismatch');
  });
});

test('missing Content-Digest leaves header undefined', async () => {
  await withServer((request, response) => {
    sendJson(response, '{"a":1}');
  }, async (fixture) => {
    const response = await remote.fetchText(fixture.origin + '/x', { ca: fixture.ca, allowPrivate: true });
    assert.strictEqual(response.headers['content-digest'], undefined);
  });
});

test('redirects are rejected', async () => {
  await withServer((request, response) => {
    response.writeHead(302, { location: 'https://127.0.0.1/other' });
    response.end();
  }, async (fixture) => {
    await assert.rejects(
      remote.fetchText(fixture.origin + '/x', { ca: fixture.ca, allowPrivate: true }),
      (error) => error.code === 'redirect_not_allowed'
    );
  });
});

test('non-JSON content type is rejected', async () => {
  await withServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<html></html>');
  }, async (fixture) => {
    await assert.rejects(
      remote.fetchText(fixture.origin + '/x', { ca: fixture.ca, allowPrivate: true }),
      (error) => error.code === 'content_type_invalid'
    );
  });
});

test('non-identity content encoding is rejected', async () => {
  await withServer((request, response) => {
    sendJson(response, '{"a":1}', { 'content-encoding': 'gzip' });
  }, async (fixture) => {
    await assert.rejects(
      remote.fetchText(fixture.origin + '/x', { ca: fixture.ca, allowPrivate: true }),
      (error) => error.code === 'unsupported_content_encoding'
    );
  });
});

test('404 maps to not_found', async () => {
  await withServer((request, response) => {
    response.writeHead(404);
    response.end();
  }, async (fixture) => {
    await assert.rejects(
      remote.fetchText(fixture.origin + '/missing', { ca: fixture.ca, allowPrivate: true }),
      (error) => error.code === 'not_found'
    );
  });
});

test('oversized response is rejected while streaming', async () => {
  const big = 'x'.repeat(2048);
  await withServer((request, response) => {
    sendJson(response, JSON.stringify({ big }));
  }, async (fixture) => {
    await assert.rejects(
      remote.fetchText(fixture.origin + '/x', { ca: fixture.ca, allowPrivate: true, maxBytes: 512 }),
      (error) => error.code === 'response_too_large'
    );
  });
});

test('timeout aborts slow responses', async () => {
  await withServer((request, response) => {
    setTimeout(() => {
      try {
        sendJson(response, '{"a":1}');
      } catch (error) {
        // socket already destroyed by the client timeout
      }
    }, 400);
  }, async (fixture) => {
    await assert.rejects(
      remote.fetchText(fixture.origin + '/slow', { ca: fixture.ca, allowPrivate: true, timeout: 100 }),
      (error) => error.code === 'timeout'
    );
  });
});

test('private addresses are blocked unless explicitly allowed', async () => {
  await assert.rejects(
    remote.fetchText('https://127.0.0.1:4443/x'),
    (error) => error.code === 'private_address_blocked'
  );
});

test('self-signed certificate is rejected without a trust anchor', async () => {
  await withServer((request, response) => {
    sendJson(response, '{"a":1}');
  }, async (fixture) => {
    await assert.rejects(
      remote.fetchText(fixture.origin + '/x', { allowPrivate: true }),
      (error) => typeof error.code === 'string' && error.code.length > 0
    );
  });
});

test('discovery finds manifest via Link header rel=ai-feed', async () => {
  await withServer((request, response) => {
    response.writeHead(200, {
      'content-type': 'text/html',
      link: '</.well-known/ai.json>; rel="ai-feed"; type="application/json"'
    });
    response.end('<html><head><title>site</title></head></html>');
  }, async (fixture) => {
    const result = await remote.discoverManifestUrl(fixture.origin + '/', { ca: fixture.ca, allowPrivate: true });
    assert.strictEqual(result.discoveredVia, 'link-header');
    assert.strictEqual(result.manifestUrl, fixture.origin + '/.well-known/ai.json');
  });
});

test('discovery finds manifest via HTML link element', async () => {
  await withServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<html><head><link rel="ai-feed" href="/custom/ai.json" type="application/json" /></head></html>');
  }, async (fixture) => {
    const result = await remote.discoverManifestUrl(fixture.origin + '/', { ca: fixture.ca, allowPrivate: true });
    assert.strictEqual(result.discoveredVia, 'html-link');
    assert.strictEqual(result.manifestUrl, fixture.origin + '/custom/ai.json');
  });
});

test('discovery falls back to the well-known path without hints', async () => {
  await withServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<html><head><title>no hints</title></head></html>');
  }, async (fixture) => {
    const result = await remote.discoverManifestUrl(fixture.origin + '/', { ca: fixture.ca, allowPrivate: true });
    assert.strictEqual(result.discoveredVia, 'fallback');
    assert.strictEqual(result.manifestUrl, fixture.origin + '/.well-known/ai.json');
  });
});
