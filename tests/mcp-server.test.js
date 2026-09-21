'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const nodeCrypto = require('node:crypto');
const { buildMcp } = require('../tools/build-mcp');
const makoLib = require('../lib/mako');
const cryptoLib = require('../lib/crypto');
const digestLib = require('../lib/digest');

buildMcp();

test('smithery descriptor points at the published stdio server', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'packages', 'aifeed-mcp-server', 'smithery.yaml'), 'utf8');
  assert.ok(/^startCommand:$/m.test(text), 'startCommand block');
  assert.ok(/type:\s*stdio/.test(text), 'stdio transport');
  assert.ok(text.includes('aifeed-mcp-server'), 'server command');
  assert.ok(/configSchema:/.test(text), 'config schema block');
});
const SERVER = path.join(__dirname, '..', 'packages', 'aifeed-mcp-server', 'index.js');

const ASSET_BYTES = Buffer.from('demo asset bytes');
const ASSET_DIGEST = digestLib.sha256Base64(ASSET_BYTES);

const PAGE_TEXT = [
  '---',
  'aimd: "1.0"',
  'type: article',
  'entity: "MCP Fixture"',
  'updated: 2026-09-20',
  'tokens: 40',
  'language: en',
  'aifeed:',
  '  policy_version: "0.2"',
  '  usage:',
  '    retrieval: allow',
  '    training: deny',
  '  attribution: required',
  '  assets:',
  '    - url: /files/report.pdf',
  '      type: document',
  '      mime: application/pdf',
  '      size: ' + ASSET_BYTES.length,
  '      sha-256: "' + ASSET_DIGEST + '"',
  '    - url: https://cdn.example/logo.svg',
  '      type: image',
  '---',
  '',
  '# MCP Fixture',
  '',
  'Signed content for the MCP server test.',
  ''
].join('\n');

function startFixture() {
  const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync('ed25519');
  const publicKeyValue = cryptoLib.encodePublicKey(publicKey);
  const routes = new Map();
  const server = http.createServer((request, response) => {
    const route = routes.get(request.url);
    if (!route) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('nope');
      return;
    }
    const headers = { 'content-type': route.type, 'content-length': route.body.length };
    if (route.signature) headers['x-aifeed-signature'] = route.signature;
    response.writeHead(200, headers);
    response.end(route.body);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const base = 'http://127.0.0.1:' + server.address().port;
      const pageBytes = Buffer.from(PAGE_TEXT, 'utf8');
      const pageUrl = base + '/page';
      const pageSig = 'aimd1:' + Buffer.from(JSON.stringify(makoLib.signMakoContainer(privateKey, pageUrl, pageBytes, { context: 'aimd' })), 'utf8').toString('base64url');
      routes.set('/page', { type: 'text/aifeed+markdown; charset=utf-8', body: pageBytes, signature: pageSig });
      routes.set('/page.sig', { type: 'application/json', body: Buffer.from(JSON.stringify(makoLib.signMakoContainer(privateKey, pageUrl, pageBytes, { context: 'aimd' })), 'utf8') });
      routes.set('/files/report.pdf', { type: 'application/pdf', body: ASSET_BYTES });
      const index = {
        version: '0.2',
        domain: '127.0.0.1',
        generated_at: '2026-09-20T00:00:00Z',
        page: 1,
        page_count: 1,
        entries: [
          { url: '/page', type: 'article', tokens: 40, title: 'MCP Fixture', updated: '2026-09-20', etag: '"x"', 'sha-256': digestLib.sha256Base64(pageBytes), assets: 2 }
        ]
      };
      const indexText = JSON.stringify(index);
      routes.set('/.well-known/aifeed-index.json', { type: 'application/json', body: Buffer.from(indexText, 'utf8') });
      const manifest = {
        version: '0.2',
        domain: '127.0.0.1',
        identity: { public_key: publicKeyValue, key_id: 'test' },
        permissions: { usage: { retrieval: 'allow', training: 'deny' }, attribution: 'required' }
      };
      routes.set('/.well-known/ai.json', { type: 'application/json', body: Buffer.from(JSON.stringify(manifest), 'utf8') });
      resolve({ server, base, publicKeyValue, pageUrl });
    });
  });
}

function startServer() {
  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, AIFEED_MCP_ALLOW_PRIVATE: '1' },
    stdio: ['pipe', 'pipe', 'inherit']
  });
  let buffer = '';
  const pending = new Map();
  let nextId = 1;
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line === '') continue;
      const message = JSON.parse(line);
      const waiter = pending.get(message.id);
      if (waiter) {
        pending.delete(message.id);
        waiter(message);
      }
    }
  });
  function call(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n', (error) => {
        if (error) reject(error);
      });
    });
  }
  return { child, call };
}

test('mcp package ships a runnable zero-dependency server', () => {
  const pkg = require('../packages/aifeed-mcp-server/package.json');
  assert.strictEqual(pkg.name, 'aifeed-mcp-server');
  assert.strictEqual(pkg.bin['aifeed-mcp-server'], 'index.js');
  assert.ok(!('dependencies' in pkg) && !('devDependencies' in pkg), 'zero-dependency rule');
  assert.ok(pkg.files.includes('lib') && pkg.files.includes('schema'), 'engine files ship');
});

test('mcp server handshakes, lists tools, and rejects unknown methods', async () => {
  const { child, call } = startServer();
  try {
    const hello = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    assert.strictEqual(hello.result.serverInfo.name, 'aifeed-mcp-server');
    assert.strictEqual(hello.result.protocolVersion, '2025-06-18');
    const listed = await call('tools/list', {});
    const names = listed.result.tools.map((tool) => tool.name).sort();
    assert.deepStrictEqual(names, ['decide_usage', 'fetch_aifeed', 'list_assets', 'select_index', 'verify_asset', 'verify_manifest']);
    for (const tool of listed.result.tools) {
      assert.strictEqual(tool.inputSchema.type, 'object', tool.name);
    }
    const missing = await call('nope/nothing', {});
    assert.strictEqual(missing.error.code, -32601);
  } finally {
    child.kill();
  }
});

test('mcp server fetches, budgets, lists, and verifies fixture content', async () => {
  const fixture = await startFixture();
  const { child, call } = startServer();
  try {
    await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } });

    const fetched = await call('tools/call', {
      name: 'fetch_aifeed',
      arguments: { url: fixture.pageUrl, publicKeyValue: fixture.publicKeyValue, max_tokens: 1000 }
    });
    const doc = JSON.parse(fetched.result.content[0].text);
    assert.strictEqual(doc.ok, true, JSON.stringify(doc.errors));
    assert.strictEqual(doc.verified, true);
    assert.strictEqual(doc.usage.training, 'deny');
    assert.strictEqual(doc.attribution, 'required');
    assert.ok(doc.markdown.includes('# MCP Fixture'));
    assert.strictEqual(doc.truncated, false);

    const budgeted = await call('tools/call', {
      name: 'fetch_aifeed',
      arguments: { url: fixture.pageUrl, publicKeyValue: fixture.publicKeyValue, max_tokens: 4 }
    });
    const short = JSON.parse(budgeted.result.content[0].text);
    assert.strictEqual(short.truncated, true);
    assert.ok(short.markdown.length < doc.markdown.length);

    const listed = await call('tools/call', { name: 'list_assets', arguments: { url: fixture.pageUrl } });
    const assets = JSON.parse(listed.result.content[0].text);
    assert.strictEqual(assets.assets.length, 2);
    assert.strictEqual(assets.assets[0].mime, 'application/pdf');
    assert.strictEqual(assets.assets[0].size, ASSET_BYTES.length);
    assert.strictEqual(assets.assets[0]['sha-256'], ASSET_DIGEST);

    const verified = await call('tools/call', {
      name: 'verify_asset',
      arguments: { assetUrl: fixture.base + '/files/report.pdf', pageUrl: fixture.pageUrl }
    });
    const proof = JSON.parse(verified.result.content[0].text);
    assert.strictEqual(proof.ok, true, JSON.stringify(proof.errors));
    assert.strictEqual(proof.verified, true);
    assert.strictEqual(proof.size, ASSET_BYTES.length);

    const missing = await call('tools/call', {
      name: 'verify_asset',
      arguments: { assetUrl: fixture.base + '/files/other.pdf', pageUrl: fixture.pageUrl }
    });
    assert.strictEqual(missing.result.isError, true);

    const selected = await call('tools/call', {
      name: 'select_index',
      arguments: { domain: '127.0.0.1', query: 'mcp fixture', indexUrl: fixture.base + '/.well-known/aifeed-index.json' }
    });
    const ranking = JSON.parse(selected.result.content[0].text);
    assert.strictEqual(ranking.selected.length, 1);
    assert.strictEqual(ranking.selected[0].assets, 2);

    const decision = await call('tools/call', {
      name: 'decide_usage',
      arguments: { domain: '127.0.0.1', usage: 'training', manifestUrl: fixture.base + '/.well-known/ai.json' }
    });
    const ruling = JSON.parse(decision.result.content[0].text);
    assert.strictEqual(ruling.allowed, false);
    assert.strictEqual(ruling.attribution, 'required');
  } finally {
    child.kill();
    fixture.server.close();
  }
});

test('mcp server rejects non-https origins and bad input', async () => {
  const { child, call } = startServer();
  try {
    await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    const plain = await call('tools/call', { name: 'fetch_aifeed', arguments: { url: 'http://example.com/page' } });
    assert.strictEqual(plain.result.isError, true);
    assert.ok(JSON.parse(plain.result.content[0].text).error.includes('https'));
    const badDomain = await call('tools/call', { name: 'verify_manifest', arguments: { domain: 'not a domain!' } });
    assert.strictEqual(badDomain.result.isError, true);
  } finally {
    child.kill();
  }
});
