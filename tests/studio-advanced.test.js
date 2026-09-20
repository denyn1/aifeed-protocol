'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateAdvanced, importOpenApi } = require('../studio/lib/advanced');
const { Workspace } = require('../studio/workspace');
const { publishProject } = require('../studio/lib/publish');
const { verifyBuild } = require('../studio/lib/verify');
const { createServer } = require('../studio/server');

function makeWorkspace() {
  return new Workspace(fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-adv-')));
}

function publicKeyOf(workspace, id) {
  return fs.readFileSync(workspace.paths(id).publicKeyPath, 'utf8').trim().split('\n')[0];
}

function sampleSpec() {
  return {
    openapi: '3.0.0',
    paths: {
      '/api/search': {
        get: {
          operationId: 'search_products',
          summary: 'Search products',
          parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'ok',
              content: { 'application/json': { schema: { type: 'array', items: { type: 'string' } } } }
            }
          }
        }
      },
      '/api/orders': {
        post: {
          operationId: 'purchase',
          summary: 'Buy a product',
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object', required: ['product_id'], properties: { product_id: { type: 'string' } } }
              }
            }
          },
          responses: {
            '201': {
              description: 'created',
              content: { 'application/json': { schema: { type: 'object' } } }
            }
          }
        }
      }
    }
  };
}

test('advanced fragments validate against the manifest schema', () => {
  const workspace = makeWorkspace();
  const created = workspace.create({ domain: 'adv.example', name: 'Adv' });
  const publicKey = publicKeyOf(workspace, created.id);
  const fragment = importOpenApi(sampleSpec()).fragment;
  assert.ok(fragment.capabilities.search_products);
  assert.ok(fragment.actions.purchase);
  assert.deepStrictEqual(validateAdvanced(fragment, created, publicKey), []);

  const unknown = validateAdvanced({ ...fragment, weird: {} }, created, publicKey);
  assert.ok(unknown.some((message) => message.includes('unknown advanced field')));
  const badAction = validateAdvanced({ actions: { bad: { description: 'x', endpoint: '/x', method: 'FLY' } } }, created, publicKey);
  assert.ok(badAction.length > 0);
});

test('publish merges advanced fields into the manifest and verifies', () => {
  const workspace = makeWorkspace();
  const created = workspace.create({ domain: 'advpub.example', name: 'AdvPub' });
  const paths = workspace.paths(created.id);
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-advsrc-'));
  fs.writeFileSync(path.join(source, 'index.html'), '<html lang="en"><head><title>Home</title></head><body><main><h1>Home</h1></main></body></html>');
  const advanced = importOpenApi(sampleSpec()).fragment;
  const project = { ...created, advanced };

  const built = publishProject({
    project,
    policy: workspace.policy(created.id),
    sourceDir: source,
    outDir: paths.outDir,
    keyPath: paths.keyPath,
    statePath: paths.statePath,
    advanced
  });
  assert.strictEqual(built.processed, 1);
  const manifest = JSON.parse(fs.readFileSync(path.join(paths.outDir, '.well-known', 'ai.json'), 'utf8'));
  assert.ok(manifest.capabilities.search_products);
  assert.ok(manifest.actions.purchase);
  assert.strictEqual(manifest.actions.purchase.human_confirmation_required, true);

  const report = verifyBuild({ outDir: paths.outDir, domain: created.domain, keyPath: paths.keyPath });
  assert.strictEqual(report.result, 'VERIFIED', JSON.stringify(report));
});

test('API validates advanced fields and imports OpenAPI specs', async () => {
  const workspace = makeWorkspace();
  const created = workspace.create({ domain: 'advapi.example', name: 'AdvApi' });
  const { server, token } = createServer({ workspace });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = (apiPath, options = {}) => fetch(base + '/api' + apiPath, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-studio-token': token,
      ...(options.headers || {})
    }
  });

  try {
    const invalid = await call('/projects/' + created.id + '/advanced', {
      method: 'PUT',
      body: JSON.stringify({ advanced: { actions: { bad: { description: 'x', endpoint: '/x', method: 'FLY' } } } })
    });
    assert.strictEqual(invalid.status, 400);

    const imported = await call('/projects/' + created.id + '/advanced/import-openapi', {
      method: 'POST',
      body: JSON.stringify({ spec: sampleSpec() })
    });
    assert.strictEqual(imported.status, 200);
    const result = await imported.json();
    assert.strictEqual(result.stats.capabilities, 1);
    assert.strictEqual(result.stats.actions, 1);

    const saved = await call('/projects/' + created.id + '/advanced', {
      method: 'PUT',
      body: JSON.stringify({ advanced: result.fragment })
    });
    if (saved.status !== 200) throw new Error('save failed: ' + saved.status + ' ' + (await saved.text()));
    const savedBody = await saved.json();
    assert.ok(savedBody.advanced.capabilities.search_products);
  } finally {
    await new Promise((done) => server.close(done));
  }
});
