'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { Workspace } = require('../studio/workspace');
const { createServer } = require('../studio/server');

function startFixture() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('User-agent: *\nDisallow: /private\n');
      return;
    }
    if (url.pathname === '/sitemap.xml') {
      res.writeHead(200, { 'content-type': 'application/xml' });
      res.end('<?xml version="1.0" encoding="UTF-8"?><urlset>' +
        ['/', '/a', '/b'].map((entry) => '<url><loc>http://127.0.0.1:' + server.address().port + entry + '</loc></url>').join('') +
        '</urlset>');
      return;
    }
    const pages = {
      '/': '<html lang="en"><head><title>Home</title></head><body><main><h1>Home</h1></main></body></html>',
      '/a': '<html lang="en"><head><title>A</title></head><body><main><h1>A</h1></main></body></html>',
      '/b': '<html lang="en"><head><title>B</title></head><body><main><h1>B</h1></main></body></html>'
    };
    const html = pages[url.pathname];
    if (!html) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
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

test('crawl API scans a fixture origin, builds from cache, and verifies', async () => {
  process.env.AIFEED_STUDIO_ALLOW_PRIVATE = '1';
  const fixture = await startFixture();
  const workspace = new Workspace(fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-studio-scan-')));
  const { server, token } = createServer({ workspace });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = (apiPath, options = {}) => fetch(base + '/api' + apiPath, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-studio-token': token, ...(options.headers || {}) }
  });

  try {
    const created = await (await call('/projects', {
      method: 'POST',
      body: JSON.stringify({ domain: 'scan.example', name: 'Scan', profile: 'aimd' })
    })).json();
    const id = created.project.id;

    const source = await call('/projects/' + id + '/source', {
      method: 'PUT',
      body: JSON.stringify({ type: 'crawl', origin: fixture.origin, maxPages: 10, requestsPerSecond: 50 })
    });
    assert.strictEqual(source.status, 200);

    async function runJob(jobPath) {
      const response = await call('/projects/' + id + jobPath, { method: 'POST' });
      assert.strictEqual(response.status, 202);
      const { jobId } = await response.json();
      let job = null;
      for (let attempt = 0; attempt < 200; attempt++) {
        job = await (await call('/projects/' + id + '/jobs/' + jobId)).json();
        if (job.status !== 'running') break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return job;
    }

    const scan = await runJob('/scan');
    assert.strictEqual(scan.status, 'done', JSON.stringify(scan));
    assert.strictEqual(scan.result.total, 3);
    assert.strictEqual(scan.result.sitemap, true);
    assert.strictEqual(scan.result.skippedRobots, 0);

    const build = await runJob('/build');
    assert.strictEqual(build.status, 'done', JSON.stringify(build));
    assert.strictEqual(build.result.total, 3);

    const verify = await (await call('/projects/' + id + '/verify', { method: 'POST' })).json();
    assert.strictEqual(verify.result, 'VERIFIED', JSON.stringify(verify.pages.failed));
    assert.strictEqual(verify.pages.total, 3);

    const exported = await (await call('/projects/' + id + '/export')).json();
    assert.strictEqual(exported.dns.name, '_aifeed.scan.example');
  } finally {
    await new Promise((done) => server.close(done));
    await fixture.close();
    delete process.env.AIFEED_STUDIO_ALLOW_PRIVATE;
  }
});
