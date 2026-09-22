'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { buildHarness } = require('../tools/build-harness');
const makoLib = require('../lib/mako');
const cryptoLib = require('../lib/crypto');
const digestLib = require('../lib/digest');

buildHarness();

const HARNESS_DIR = path.join(__dirname, '..', 'integrations', 'deepseek-harness');

const ASSET_BYTES = Buffer.from('demo asset bytes');
const ASSET_DIGEST = digestLib.sha256Base64(ASSET_BYTES);

const PAGE_TEXT = [
  '---',
  'aimd: "1.0"',
  'type: article',
  'entity: "Harness Fixture"',
  'updated: 2026-09-21',
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
  '---',
  '',
  '# Harness Fixture',
  '',
  'Signed content for the DeepSeek Harness plugin test.',
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
      const container = JSON.stringify(makoLib.signMakoContainer(privateKey, pageUrl, pageBytes, { context: 'aimd' }));
      routes.set('/page', { type: 'text/aifeed+markdown; charset=utf-8', body: pageBytes, signature: 'aimd1:' + Buffer.from(container, 'utf8').toString('base64url') });
      routes.set('/files/report.pdf', { type: 'application/pdf', body: ASSET_BYTES });
      const index = {
        version: '0.2',
        domain: '127.0.0.1',
        generated_at: '2026-09-21T00:00:00Z',
        page: 1,
        page_count: 1,
        entries: [
          { url: '/page', type: 'article', tokens: 40, title: 'Harness Fixture', updated: '2026-09-21', etag: '"x"', 'sha-256': digestLib.sha256Base64(pageBytes), assets: 1 }
        ]
      };
      routes.set('/.well-known/aifeed-index.json', { type: 'application/json', body: Buffer.from(JSON.stringify(index), 'utf8') });
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

async function loadTools(config) {
  const moduleUrl = pathToFileURL(path.join(HARNESS_DIR, 'tools.js')).href;
  const module = await import(moduleUrl);
  return module.createAifeedTools(config);
}

test('harness plugin package ships generated engine copies and peer deps only', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(HARNESS_DIR, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.name, '@aifeed/deepseek-harness');
  assert.strictEqual(pkg.type, 'module');
  assert.ok(!('dependencies' in pkg) && !('devDependencies' in pkg), 'zero-dependency rule');
  assert.ok(pkg.peerDependencies['@deepseek-ai/dsh-tools'], 'dsh-tools peer');
  assert.ok(pkg.peerDependencies['@deepseek-ai/cordis'], 'cordis peer');
  for (const file of ['index.js', 'tools.js', 'engine/server.js', 'engine/package.json', 'README.md', 'cordis.example.yml']) {
    assert.ok(fs.existsSync(path.join(HARNESS_DIR, file)), file);
  }
  const enginePkg = JSON.parse(fs.readFileSync(path.join(HARNESS_DIR, 'engine', 'package.json'), 'utf8'));
  assert.strictEqual(enginePkg.type, 'commonjs');
  const glue = fs.readFileSync(path.join(HARNESS_DIR, 'index.js'), 'utf8');
  assert.ok(glue.includes("inject = ['tools']"), 'tools injection');
  assert.ok(glue.includes('ctx.tools.register'), 'registration');
});

test('harness plugin exposes six AIFeed tools with typed parameters', async () => {
  const tools = await loadTools({ allowPrivate: true });
  assert.deepStrictEqual(
    tools.map((tool) => tool.name),
    ['aifeed_verify_manifest', 'aifeed_fetch_aifeed', 'aifeed_list_assets', 'aifeed_verify_asset', 'aifeed_select_index', 'aifeed_decide_usage']
  );
  for (const tool of tools) {
    assert.strictEqual(typeof tool.description, 'string');
    assert.strictEqual(typeof tool.execute, 'function');
    assert.strictEqual(tool.output.schema.type, 'object');
    assert.strictEqual(typeof tool.output.render, 'function');
  }
  const verify = tools.find((tool) => tool.name === 'aifeed_verify_manifest');
  assert.strictEqual(verify.parameters.domain.required, true);
  assert.strictEqual(verify.parameters.domain.type, 'string');
  const fetch = tools.find((tool) => tool.name === 'aifeed_fetch_aifeed');
  assert.strictEqual(fetch.parameters.url.required, true);
  assert.strictEqual(fetch.parameters.max_tokens.type, 'number');
  const select = tools.find((tool) => tool.name === 'aifeed_select_index');
  assert.strictEqual(select.parameters.domain.required, true);
  assert.strictEqual(select.parameters.query.required, undefined);
});

test('harness tools fetch, budget, list, verify, select, and decide on a fixture', async () => {
  const fixture = await startFixture();
  try {
    const tools = await loadTools({ allowPrivate: true });
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    const fetched = await byName.get('aifeed_fetch_aifeed').execute({
      url: fixture.pageUrl,
      publicKeyValue: fixture.publicKeyValue,
      max_tokens: 1000
    });
    assert.strictEqual(fetched.ok, true, JSON.stringify(fetched.errors));
    assert.strictEqual(fetched.verified, true);
    assert.strictEqual(fetched.usage.training, 'deny');
    assert.ok(fetched.markdown.includes('# Harness Fixture'));

    const budgeted = await byName.get('aifeed_fetch_aifeed').execute({
      url: fixture.pageUrl,
      publicKeyValue: fixture.publicKeyValue,
      max_tokens: 4
    });
    assert.strictEqual(budgeted.truncated, true);
    assert.ok(budgeted.markdown.length < fetched.markdown.length);

    const listed = await byName.get('aifeed_list_assets').execute({ url: fixture.pageUrl });
    assert.strictEqual(listed.assets.length, 1);
    assert.strictEqual(listed.assets[0].mime, 'application/pdf');

    const verified = await byName.get('aifeed_verify_asset').execute({
      assetUrl: fixture.base + '/files/report.pdf',
      pageUrl: fixture.pageUrl
    });
    assert.strictEqual(verified.ok, true, JSON.stringify(verified.errors));
    assert.strictEqual(verified['sha-256'], ASSET_DIGEST);

    await assert.rejects(
      byName.get('aifeed_verify_asset').execute({ assetUrl: fixture.base + '/files/other.pdf', pageUrl: fixture.pageUrl }),
      /not declared/
    );

    const selected = await byName.get('aifeed_select_index').execute({
      domain: '127.0.0.1',
      query: 'harness fixture',
      indexUrl: fixture.base + '/.well-known/aifeed-index.json'
    });
    assert.strictEqual(selected.selected.length, 1);
    assert.strictEqual(selected.selected[0].assets, 1);

    const decision = await byName.get('aifeed_decide_usage').execute({
      domain: '127.0.0.1',
      usage: 'training',
      manifestUrl: fixture.base + '/.well-known/ai.json'
    });
    assert.strictEqual(decision.allowed, false);
    assert.strictEqual(decision.attribution, 'required');
  } finally {
    fixture.server.closeAllConnections();
    fixture.server.close();
  }
});

test('harness tools reject bad input and unreachable https origins', async () => {
  const tools = await loadTools({ allowPrivate: true });
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  await assert.rejects(byName.get('aifeed_verify_manifest').execute({ domain: 'not a domain!' }), /invalid domain/);
  await assert.rejects(
    byName.get('aifeed_fetch_aifeed').execute({ url: 'http://example.com/page' }),
    /only https URLs are allowed/
  );
});
