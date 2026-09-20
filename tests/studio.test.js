'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const policyLib = require('../studio/lib/policy');
const { Workspace } = require('../studio/workspace');
const { publishProject } = require('../studio/lib/publish');
const { verifyBuild } = require('../studio/lib/verify');
const { createServer } = require('../studio/server');

function makeFixtureSite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-site-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<html lang="en"><head><title>Home</title><meta name="description" content="Home page"></head><body><nav>menu</nav><main><h1>Home</h1><p>Hello AIFeed studio.</p></main><footer>footer</footer></body></html>');
  fs.mkdirSync(path.join(dir, 'artikel'));
  fs.writeFileSync(path.join(dir, 'artikel', 'satu.html'), '<html lang="en"><head><title>Article one</title></head><body><main><h1>One</h1><p>Body of article one.</p></main></body></html>');
  fs.mkdirSync(path.join(dir, 'cart'));
  fs.writeFileSync(path.join(dir, 'cart', 'index.html'), '<html lang="en"><head><title>Cart</title></head><body><main><h1>Cart</h1><p>Checkout page.</p></main></body></html>');
  return dir;
}

function makeWorkspace() {
  return new Workspace(fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-ws-')));
}

function setupProject(workspace, overrides = {}) {
  return workspace.create({
    domain: 'studio.example',
    name: 'Studio Example',
    type: 'blog',
    locale: 'en',
    contact: 'mailto:ai@studio.example',
    description: 'Studio fixture',
    profile: 'both',
    ...overrides
  });
}

test('policy rejects loosening rules and resolves restrict-only overrides', () => {
  const globalPolicy = policyLib.normalizePolicy({});
  const loosening = policyLib.validatePolicy({
    ...globalPolicy,
    rules: [{ pattern: '/cart/**', usage: { training: 'allow' } }]
  });
  assert.ok(loosening.some((message) => message.includes('loosen')), loosening.join('; '));

  const strict = policyLib.validatePolicy({
    ...globalPolicy,
    usage: { ...globalPolicy.usage, training: 'allow' },
    rules: [{ pattern: '/cart/**', usage: { training: 'deny' }, limits: { requests_per_minute: 10 } }]
  });
  assert.deepStrictEqual(strict, []);

  const policy = policyLib.normalizePolicy({
    usage: { ...globalPolicy.usage, training: 'allow' },
    rules: [{ pattern: '/cart/**', usage: { training: 'deny' } }]
  });
  assert.deepStrictEqual(policyLib.resolveOverride(policy, '/artikel/satu'), null);
  assert.deepStrictEqual(policyLib.resolveOverride(policy, '/cart/').usage, { training: 'deny' });
  assert.strictEqual(policyLib.matchPath('/cart/**', '/cart/checkout'), true);
  assert.strictEqual(policyLib.matchPath('/cart/**', '/katalog'), false);
});

test('publish builds signed output, verifies, and skips unchanged pages on rebuild', () => {
  const workspace = makeWorkspace();
  const created = setupProject(workspace);
  const paths = workspace.paths(created.id);
  const source = makeFixtureSite();
  const policy = workspace.savePolicy(created.id, {
    ...policyLib.DEFAULT_POLICY,
    attribution_text: 'Source: Studio Example',
    limits: { requests_per_minute: 30, concurrent: 2, crawl_delay_seconds: 2 },
    license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }
  });

  const first = publishProject({
    project: created,
    policy,
    sourceDir: source,
    outDir: paths.outDir,
    keyPath: paths.keyPath,
    statePath: paths.statePath,
    previousState: null,
    incremental: true
  });
  assert.strictEqual(first.total, 3);
  assert.strictEqual(first.processed, 3);
  assert.strictEqual(first.skipped, 0);

  const manifest = JSON.parse(fs.readFileSync(path.join(paths.outDir, '.well-known', 'ai.json'), 'utf8'));
  assert.strictEqual(manifest.content.license.name, 'CC BY 4.0');
  assert.strictEqual(manifest.permissions.attribution_text, 'Source: Studio Example');
  assert.strictEqual(manifest.limits.requests_per_minute, 30);
  assert.strictEqual(manifest.limits.crawl_delay_seconds, 2);
  assert.ok(fs.existsSync(path.join(paths.outDir, 'artikel', 'satu.aifeed.md')));
  assert.ok(fs.existsSync(path.join(paths.outDir, 'artikel', 'satu.aifeed.md.sig')));
  assert.ok(fs.existsSync(path.join(paths.outDir, 'artikel', 'satu.mako.md')));
  assert.ok(fs.existsSync(path.join(paths.outDir, '.well-known', 'aifeed-index.json.sig')));
  assert.ok(fs.existsSync(path.join(paths.outDir, 'llms.txt')));

  const report = verifyBuild({
    outDir: paths.outDir,
    domain: created.domain,
    keyPath: paths.keyPath
  });
  assert.strictEqual(report.result, 'VERIFIED', JSON.stringify(report));
  assert.strictEqual(report.pages.total, 6);

  const second = publishProject({
    project: created,
    policy,
    sourceDir: source,
    outDir: paths.outDir,
    keyPath: paths.keyPath,
    statePath: paths.statePath,
    previousState: workspace.state(created.id),
    incremental: true
  });
  assert.strictEqual(second.processed, 0);
  assert.strictEqual(second.skipped, 3);
});

test('page overrides land in signed frontmatter', () => {
  const workspace = makeWorkspace();
  const created = setupProject(workspace);
  const paths = workspace.paths(created.id);
  const source = makeFixtureSite();
  const policy = workspace.savePolicy(created.id, {
    ...policyLib.DEFAULT_POLICY,
    usage: { ...policyLib.DEFAULT_POLICY.usage, training: 'allow' },
    rules: [{ pattern: '/cart/**', usage: { training: 'deny' } }]
  });

  publishProject({
    project: created,
    policy,
    sourceDir: source,
    outDir: paths.outDir,
    keyPath: paths.keyPath,
    statePath: paths.statePath
  });

  const cart = fs.readFileSync(path.join(paths.outDir, 'cart', 'index.aifeed.md'), 'utf8');
  const home = fs.readFileSync(path.join(paths.outDir, 'index.aifeed.md'), 'utf8');
  assert.ok(cart.includes('training: "deny"'), 'cart override present');
  assert.ok(!home.includes('aifeed:'), 'home has no page override');
  assert.ok(fs.existsSync(path.join(paths.outDir, 'cart', 'index.aifeed.md.sig')));
});

test('studio API creates, builds, verifies, and exports a project', async () => {
  const workspace = makeWorkspace();
  const source = makeFixtureSite();
  const { server, token } = createServer({ workspace });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port;
  const call = (apiPath, options = {}) => fetch(base + '/api' + apiPath, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-studio-token': token,
      ...(options.headers || {})
    }
  });

  try {
    const unauthorized = await fetch(base + '/api/info');
    assert.strictEqual(unauthorized.status, 401);

    const page = await fetch(base + '/');
    assert.strictEqual(page.status, 200);
    const html = await page.text();
    assert.ok(html.includes("window.__STUDIO_TOKEN__ = '" + token + "'"));
    assert.ok(!html.includes('%%STUDIO_TOKEN%%'));

    const appJs = await fetch(base + '/app.js');
    assert.strictEqual(appJs.status, 200);
    assert.ok(String(appJs.headers.get('content-type')).includes('javascript'));

    const createdResponse = await call('/projects', {
      method: 'POST',
      body: JSON.stringify({ domain: 'apistudio.example', name: 'API Studio' })
    });
    if (createdResponse.status !== 201) {
      throw new Error('create failed: ' + createdResponse.status + ' ' + (await createdResponse.text()));
    }
    const created = await createdResponse.json();
    const id = created.project.id;

    const sourceResponse = await call('/projects/' + id + '/source', {
      method: 'PUT',
      body: JSON.stringify({ type: 'local', dir: source })
    });
    assert.strictEqual(sourceResponse.status, 200);

    const buildResponse = await call('/projects/' + id + '/build', { method: 'POST' });
    assert.strictEqual(buildResponse.status, 202);
    const { jobId } = await buildResponse.json();

    let job = null;
    for (let attempt = 0; attempt < 100; attempt++) {
      const jobResponse = await call('/projects/' + id + '/jobs/' + jobId);
      job = await jobResponse.json();
      if (job.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.strictEqual(job.status, 'done', JSON.stringify(job));
    assert.strictEqual(job.result.total, 3);

    const verifyResponse = await call('/projects/' + id + '/verify', { method: 'POST' });
    const verifyReport = await verifyResponse.json();
    assert.strictEqual(verifyReport.result, 'VERIFIED', JSON.stringify(verifyReport));

    const exportResponse = await call('/projects/' + id + '/export');
    const exportInfo = await exportResponse.json();
    assert.strictEqual(exportInfo.dns.name, '_aifeed.apistudio.example');
    assert.ok(exportInfo.dns.value.includes('pk=ed25519:'));
    assert.ok(exportInfo.dns.value.includes('manifest=https://'));
    assert.deepStrictEqual(exportInfo.instructions, ['upload_overlay', 'add_dns_txt', 'verify_live']);

    const journal = fs.readFileSync(path.join(workspace.projectDir(id), 'journal.ndjson'), 'utf8');
    assert.ok(journal.includes('"project_created"'), journal);
    assert.ok(journal.includes('"source_set"'), journal);
    assert.ok(journal.includes('"build"'), journal);
    assert.ok(journal.includes('"verify"'), journal);

    const previewResponse = await call('/projects/' + id + '/preview?path=' + encodeURIComponent('/cart'));
    const preview = await previewResponse.json();
    assert.strictEqual(preview.built, true);
    assert.ok(preview.effective);
  } finally {
    await new Promise((done) => server.close(done));
  }
});

test('studio UI i18n files share the same keys', () => {
  const base = path.join(__dirname, '..', 'studio', 'ui', 'i18n');
  const files = ['en.json', 'id.json', 'zh.json'].map((name) => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8')));
  const keys = Object.keys(files[0]).sort();
  for (const file of files.slice(1)) {
    assert.deepStrictEqual(Object.keys(file).sort(), keys);
  }
  assert.ok(keys.length > 60);
});
