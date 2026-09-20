'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { crawlSite } = require('../studio/lib/crawl');
const { Workspace } = require('../studio/workspace');
const { publishProject } = require('../studio/lib/publish');
const { verifyBuild } = require('../studio/lib/verify');

function startFixture(options = {}) {
  const pages = {
    '/': '<html lang="en"><head><title>Home</title></head><body><main><h1>Home</h1><a href="/a">a</a></main></body></html>',
    '/a': '<html lang="en"><head><title>A</title></head><body><main><h1>A</h1><a href="/b">b</a></main></body></html>',
    '/b': '<html lang="en"><head><title>B</title></head><body><main><h1>B</h1><a href="/private/x">private</a></main></body></html>',
    '/private/x': '<html lang="en"><head><title>Private</title></head><body><main><h1>Private</h1></main></body></html>'
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('User-agent: *\nDisallow: /private\nCrawl-delay: 0\n');
      return;
    }
    if (url.pathname === '/sitemap.xml' && options.sitemap !== false) {
      res.writeHead(200, { 'content-type': 'application/xml' });
      res.end('<?xml version="1.0" encoding="UTF-8"?><urlset>' +
        ['/', '/a', '/b', '/private/x'].map((entry) => '<url><loc>http://127.0.0.1:' + server.address().port + entry + '</loc></url>').join('') +
        '</urlset>');
      return;
    }
    if (url.pathname === '/sitemap-index.xml') {
      res.writeHead(200, { 'content-type': 'application/xml' });
      res.end('<?xml version="1.0" encoding="UTF-8"?><sitemapindex><sitemap><loc>http://127.0.0.1:' + server.address().port + '/sitemap.xml</loc></sitemap></sitemapindex>');
      return;
    }
    const html = pages[url.pathname];
    if (!html) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    const etag = '"' + url.pathname.replace(/\W+/g, '_') + '-v1"';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { etag });
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', etag });
    res.end(html);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        server,
        origin: 'http://127.0.0.1:' + server.address().port,
        close: () => new Promise((done) => { server.closeAllConnections(); server.close(() => done()); })
      });
    });
  });
}

function makeWorkspace() {
  return new Workspace(fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-crawl-')));
}

test('crawl follows sitemap, respects robots, reuses the cache on 304, then publishes and verifies', async () => {
  const fixture = await startFixture();
  const workspace = makeWorkspace();
  const project = workspace.create({ domain: 'crawl.example', name: 'Crawl Example', profile: 'aimd' });
  const paths = workspace.paths(project.id);

  try {
    const first = await crawlSite({
      origin: fixture.origin,
      cacheDir: paths.cacheDir,
      maxPages: 10,
      requestsPerSecond: 100,
      allowPrivate: true,
      respectRobots: true
    });
    assert.strictEqual(first.stats.sitemap, true);
    const urlPaths = first.pages.map((page) => page.urlPath).sort();
    assert.deepStrictEqual(urlPaths, ['/', '/a', '/b']);
    assert.ok(first.stats.skippedRobots >= 1, 'private path skipped by robots');
    assert.strictEqual(first.stats.total, 3);

    const second = await crawlSite({
      origin: fixture.origin,
      cacheDir: paths.cacheDir,
      maxPages: 10,
      requestsPerSecond: 100,
      allowPrivate: true,
      respectRobots: true
    });
    assert.ok(second.stats.unchanged >= 3, 'conditional requests reused the cache: ' + JSON.stringify(second.stats));

    const policy = workspace.policy(project.id);
    const built = publishProject({
      project,
      policy,
      pages: second.pages.map((page) => ({ urlPath: page.urlPath, htmlPath: page.htmlPath })),
      sitemap: true,
      outDir: paths.outDir,
      keyPath: paths.keyPath,
      statePath: paths.statePath
    });
    assert.strictEqual(built.total, 3);
    assert.ok(fs.existsSync(path.join(paths.outDir, 'a.aifeed.md')));
    assert.ok(fs.existsSync(path.join(paths.outDir, 'index.aifeed.md')));

    const manifest = JSON.parse(fs.readFileSync(path.join(paths.outDir, '.well-known', 'ai.json'), 'utf8'));
    assert.strictEqual(manifest.content.sitemap, '/sitemap.xml');

    const report = verifyBuild({ outDir: paths.outDir, domain: project.domain, keyPath: paths.keyPath });
    assert.strictEqual(report.result, 'VERIFIED', JSON.stringify(report));
  } finally {
    await fixture.close();
  }
});

test('crawl falls back to link discovery when no sitemap exists', async () => {
  const fixture = await startFixture({ sitemap: false });
  const workspace = makeWorkspace();
  const project = workspace.create({ domain: 'links.example', name: 'Links Example', profile: 'aimd' });
  const paths = workspace.paths(project.id);

  try {
    const result = await crawlSite({
      origin: fixture.origin,
      cacheDir: paths.cacheDir,
      maxPages: 10,
      maxDepth: 3,
      requestsPerSecond: 100,
      allowPrivate: true,
      respectRobots: true
    });
    assert.strictEqual(result.stats.sitemap, false);
    const urlPaths = result.pages.map((page) => page.urlPath).sort();
    assert.deepStrictEqual(urlPaths, ['/', '/a', '/b']);
    assert.ok(result.stats.skippedRobots >= 1);
  } finally {
    await fixture.close();
  }
});
