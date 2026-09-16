'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { importOpenApi } = require('../lib/openapi');
const { buildManifest } = require('../lib/scaffold');
const { validate } = require('../lib/schema');
const manifestSchema = require('../schema/ai-json.v0.1.json');
const cryptoLib = require('../lib/crypto');
const { privateKeyFromSeed, SEED_PRIMARY } = require('../tools/gen-vectors');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');
const NOW = new Date('2026-09-14T08:00:00Z');

const SPEC = {
  openapi: '3.0.3',
  info: { title: 'Shop API', version: '1.0.0' },
  paths: {
    '/products': {
      get: {
        operationId: 'searchProducts',
        summary: 'Cari produk',
        security: [{ oauth: [] }],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', maxLength: 128 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'X-Trace', in: 'header', schema: { type: 'string' } }
        ],
        responses: { 200: { content: { 'application/json': { schema: { type: 'array' } } } } }
      }
    },
    '/products/{product_id}': {
      get: {
        operationId: 'getProduct',
        summary: 'Detail produk',
        parameters: [{ name: 'product_id', in: 'path', required: true, schema: { type: 'string', maxLength: 64 } }],
        responses: { 200: { content: { 'application/json': { schema: { type: 'object' } } } } }
      }
    },
    '/orders': {
      post: {
        operationId: 'createOrder',
        summary: 'Buat pesanan',
        security: [{ oauth: [] }],
        externalDocs: { url: 'https://shop.example/docs/auth' },
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['product_id'],
                properties: {
                  product_id: { type: 'string', maxLength: 64 },
                  quantity: { type: 'integer', minimum: 1, maximum: 99 },
                  note: { type: 'string' },
                  meta: { type: 'object' }
                }
              }
            }
          }
        },
        responses: { 201: { content: { 'application/json': { schema: { type: 'object' } } } } }
      }
    },
    '/orders/{order_id}': {
      delete: {
        operationId: 'cancelOrder',
        summary: 'Batalkan',
        security: [{ oauth: [] }],
        parameters: [{ name: 'order_id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { content: { 'application/json': { schema: { type: 'object' } } } } }
      }
    }
  }
};

test('imports capabilities and actions from OpenAPI', () => {
  const result = importOpenApi(SPEC);
  assert.strictEqual(result.stats.capabilities, 2);
  assert.strictEqual(result.stats.actions, 2);

  const search = result.fragment.capabilities.search_products;
  assert.strictEqual(search.endpoint, '/products');
  assert.strictEqual(search.method, 'GET');
  assert.strictEqual(search.auth_required, true);
  assert.strictEqual(search.params.q.required, true);
  assert.strictEqual(search.params.q.in, 'query');
  assert.strictEqual(search.params.limit.maximum, 100);
  assert.strictEqual(search.params.x_trace, undefined);
  assert.ok(result.warnings.some((warning) => warning.includes('header')));

  const getProduct = result.fragment.capabilities.get_product;
  assert.strictEqual(getProduct.params.product_id.in, 'path');

  const createOrder = result.fragment.actions.create_order;
  assert.strictEqual(createOrder.method, 'POST');
  assert.strictEqual(createOrder.requires_auth, true);
  assert.strictEqual(createOrder.auth.type, 'oauth2');
  assert.strictEqual(createOrder.auth.documentation_url, 'https://shop.example/docs/auth');
  assert.strictEqual(createOrder.human_confirmation_required, true);
  assert.strictEqual(createOrder.params.product_id.in, 'body');
  assert.strictEqual(createOrder.params.product_id.required, true);
  assert.strictEqual(createOrder.params.quantity.maximum, 99);
  assert.strictEqual(createOrder.params.meta, undefined);
  assert.ok(result.warnings.some((warning) => warning.includes('meta')));

  const cancelOrder = result.fragment.actions.cancel_order;
  assert.strictEqual(cancelOrder.requires_auth, true);
});

test('imported fragment merges into a schema-valid manifest', () => {
  const privateKey = privateKeyFromSeed(SEED_PRIMARY);
  const publicKey = cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(privateKey));
  const manifest = buildManifest({ domain: 'shop.example', profile: 'ecommerce', publicKey, now: NOW });
  const result = importOpenApi(SPEC);
  manifest.capabilities = result.fragment.capabilities;
  manifest.actions = result.fragment.actions;
  const errors = validate(manifest, manifestSchema);
  assert.deepStrictEqual(errors, []);
});

test('CLI import-openapi writes a fragment file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-openapi-'));
  const specPath = path.join(dir, 'spec.json');
  const outPath = path.join(dir, 'fragment.json');
  fs.writeFileSync(specPath, JSON.stringify(SPEC));
  const result = spawnSync(process.execPath, [CLI, 'import-openapi', specPath, '--out', outPath], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.strictEqual(summary.capabilities, 2);
  assert.strictEqual(summary.actions, 2);
  const fragment = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.ok(fragment.capabilities.search_products);
  assert.ok(fragment.actions.create_order);
});
