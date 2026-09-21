'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { manifestFor } = require('../tools/build-mcpb');

const PKG_DIR = path.join(__dirname, '..', 'packages', 'aifeed-mcp-server');

test('mcpb manifest matches package and registry metadata', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
  const server = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'server.json'), 'utf8'));
  const manifest = manifestFor(pkg, server);

  assert.strictEqual(manifest.manifest_version, '0.3');
  assert.strictEqual(manifest.name, 'aifeed-mcp-server');
  assert.strictEqual(manifest.version, pkg.version);
  assert.strictEqual(manifest.version, server.version);
  assert.strictEqual(manifest.description, server.description);
  assert.ok(manifest.description.length <= 100, 'registry description limit');
  assert.strictEqual(manifest.server.type, 'node');
  assert.strictEqual(manifest.server.entry_point, 'server/index.js');
  assert.deepStrictEqual(manifest.server.mcp_config.args, ['${__dirname}/server/index.js']);
  assert.strictEqual(manifest.server.mcp_config.env.AIFEED_MCP_ALLOW_PRIVATE, '${user_config.allow_private}');
  assert.strictEqual(manifest.user_config.allow_private.default, '0');
  assert.strictEqual(server.name, 'io.github.denyn1/aifeed-mcp-server');
  assert.strictEqual(server.packages[0].identifier, pkg.name);
  assert.strictEqual(server.packages[0].version, pkg.version);
  assert.strictEqual(server.packages[0].transport.type, 'stdio');
});

test('mcpb manifest rejects a version drift between package.json and server.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
  const server = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'server.json'), 'utf8'));
  server.version = '9.9.9';
  assert.throws(() => manifestFor(pkg, server), /does not match/);
});

test('mcpb server entries exist for the bundle', () => {
  for (const name of ['index.js', 'lib', 'schema', 'LICENSE']) {
    assert.ok(fs.existsSync(path.join(PKG_DIR, name)), name);
  }
});
