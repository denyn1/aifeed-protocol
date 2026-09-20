'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { createTarGz } = require('../studio/lib/archive');
const { detectStack, STACK_ADAPTERS } = require('../studio/lib/crawl');
const { compareAnchor } = require('../studio/lib/live-verify');
const { Workspace } = require('../studio/workspace');
const { publishProject } = require('../studio/lib/publish');
const { verifyBuild } = require('../studio/lib/verify');
const { createServer } = require('../studio/server');

function readTar(buffer) {
  const files = {};
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim(), 8) || 0;
    offset += 512;
    files[name] = buffer.subarray(offset, offset + size).toString('utf8');
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

test('tar.gz export round-trips nested files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-tar-'));
  fs.mkdirSync(path.join(dir, '.well-known'));
  fs.writeFileSync(path.join(dir, '.well-known', 'ai.json'), '{"ok":true}\n');
  fs.writeFileSync(path.join(dir, 'a.aifeed.md'), '---\naimd: "1.0"\n---\n\nHi\n');
  const archive = createTarGz(dir);
  assert.strictEqual(archive[0], 0x1f);
  assert.strictEqual(archive[1], 0x8b);
  const files = readTar(zlib.gunzipSync(archive));
  assert.strictEqual(files['.well-known/ai.json'], '{"ok":true}\n');
  assert.ok(files['a.aifeed.md'].includes('aimd: "1.0"'));
});

test('detectStack maps common stacks to adapters', () => {
  assert.strictEqual(detectStack({ server: 'nginx' }, '').id, 'nginx');
  assert.strictEqual(detectStack({ 'x-powered-by': 'Next.js' }, '').id, 'nextjs');
  assert.strictEqual(detectStack({}, '<meta name="generator" content="WordPress 6.6">').id, 'wordpress');
  assert.strictEqual(detectStack({ 'x-powered-by': 'PHP/8.3' }, '').id, 'php');
  assert.strictEqual(detectStack({ server: 'cloudflare' }, '').id, 'cloudflare');
  assert.strictEqual(detectStack({ server: 'SOMETHING/1.0' }, '').id, 'unknown');
  assert.strictEqual(STACK_ADAPTERS.wordpress, 'wp-plugin');
  assert.strictEqual(detectStack({ server: 'nginx' }, '').adapter, 'integrations/nginx');
});

test('compareAnchor accepts a matching TXT record and rejects mismatches', () => {
  const publicKey = 'ed25519:MCowBQYDK2VwAyEAA6EHv/POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg=';
  const fingerprint = require('../lib/crypto').fingerprintOf(require('../lib/crypto').decodePublicKey(publicKey));
  const ok = compareAnchor([{ v: 'aifeed1', pk: publicKey, fp: fingerprint }], publicKey);
  assert.strictEqual(ok.anchored, true);
  assert.deepStrictEqual(ok.errors, []);

  const wrongKey = compareAnchor([{ v: 'aifeed1', pk: 'ed25519:other' }], publicKey);
  assert.strictEqual(wrongKey.anchored, false);
  assert.ok(wrongKey.errors.some((entry) => entry.code === 'dns_mismatch'));

  const duplicated = compareAnchor([{ pk: 'ed25519:a' }, { pk: 'ed25519:b' }], publicKey);
  assert.ok(duplicated.errors.some((entry) => entry.code === 'dns_mismatch'));

  const empty = compareAnchor([], publicKey);
  assert.strictEqual(empty.anchored, false);
  assert.ok(empty.warnings.some((entry) => entry.code === 'dns_not_anchored'));
});

test('studio build records asset digests, counts, and verify summaries', () => {
  const workspace = new Workspace(fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-assets-')));
  const created = workspace.create({ domain: 'assets.example', name: 'Assets' });
  const paths = workspace.paths(created.id);
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-assetsrc-'));
  fs.writeFileSync(path.join(source, 'index.html'), [
    '<html lang="en"><head><title>Home</title></head><body><main><h1>Home</h1>',
    '<p><a href="/berkas.pdf" download>Report</a></p></main></body></html>'
  ].join('\n'));
  fs.writeFileSync(path.join(source, 'berkas.pdf'), '%PDF-1.4 studio asset\n');

  const built = publishProject({
    project: created,
    policy: workspace.policy(created.id),
    sourceDir: source,
    outDir: paths.outDir,
    keyPath: paths.keyPath,
    statePath: paths.statePath
  });
  assert.strictEqual(built.assets.total, 1);
  assert.strictEqual(built.assets.hashed, 1);

  const md = fs.readFileSync(path.join(paths.outDir, 'index.aifeed.md'), 'utf8');
  assert.ok(md.includes('mime: "application/pdf"'), 'asset mime recorded');
  assert.ok(md.includes('sha-256:'), 'asset digest recorded');

  const index = JSON.parse(fs.readFileSync(path.join(paths.outDir, '.well-known', 'aifeed-index.json'), 'utf8'));
  assert.strictEqual(index.entries.find((entry) => entry.url === '/').assets, 1);

  const report = verifyBuild({ outDir: paths.outDir, domain: created.domain, keyPath: paths.keyPath });
  assert.strictEqual(report.result, 'VERIFIED', JSON.stringify(report));
  assert.deepStrictEqual(report.assets, { total: 1, hashed: 1 });
});

test('tar.gz endpoint serves the built overlay', async () => {
  const workspace = new Workspace(fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-tarapi-')));
  const created = workspace.create({ domain: 'tar.example', name: 'Tar' });
  const paths = workspace.paths(created.id);
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-tarsrc-'));
  fs.writeFileSync(path.join(source, 'index.html'), '<html lang="en"><head><title>Home</title></head><body><main><h1>Home</h1></main></body></html>');
  publishProject({
    project: created,
    policy: workspace.policy(created.id),
    sourceDir: source,
    outDir: paths.outDir,
    keyPath: paths.keyPath,
    statePath: paths.statePath
  });

  const { server, token } = createServer({ workspace });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const response = await fetch(base + '/api/projects/' + created.id + '/export.tar.gz?token=' + token);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('content-type'), 'application/gzip');
    assert.ok(String(response.headers.get('content-disposition')).includes('aifeed-tar.example.tar.gz'));
    const archive = Buffer.from(await response.arrayBuffer());
    assert.strictEqual(archive[0], 0x1f);
    const files = readTar(zlib.gunzipSync(archive));
    assert.ok(files['.well-known/ai.json'], 'archive contains the manifest');
    assert.ok(files['index.aifeed.md'], 'archive contains the page');
  } finally {
    await new Promise((done) => server.close(done));
  }
});
