#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const nodeCrypto = require('node:crypto');
const makoLib = require('../lib/mako');
const makoHtmlLib = require('../lib/mako-html');
const cryptoLib = require('../lib/crypto');
const { sha256Base64 } = require('../lib/digest');
const { mulberry32 } = require('./fuzz');

const ROOT = path.join(__dirname, '..');
const BENCH_DIR = path.join(ROOT, 'benchmarks');
const NOW = '2026-09-15T08:00:00Z';

const UA = {
  compliant: 'AIFeedBot/0.3 (+https://aifeed.md)',
  training: 'GPTBot/1.0',
  plain: 'CrawlerX/1.0',
  human: 'Mozilla/5.0 (BenchVisitor)'
};

const WORDS = ('konten situs data izin crawl delta protokol markdown bandwidth origin domain kunci manifest kepercayaan indeks digest negosiasi ' +
  'halaman struktur metadata ringkasan konteks jaringan sistem publikasi redaksi laporan analisis industri teknologi pengguna').split(' ');

function randomText(random, words) {
  const parts = [];
  for (let index = 0; index < words; index++) {
    parts.push(WORDS[Math.floor(random() * WORDS.length)]);
  }
  return parts.join(' ') + '.';
}

function buildPageHtml(seed, tenant, pageId, paragraphs) {
  const random = mulberry32(seed);
  const body = [];
  body.push('<h1>Halaman ' + pageId + ' dari tenant ' + tenant + '</h1>');
  for (let index = 0; index < paragraphs; index++) {
    body.push('<p>' + randomText(random, 24) + '</p>');
  }
  body.push('<ul><li>' + randomText(random, 8) + '</li><li>' + randomText(random, 8) + '</li></ul>');
  const navigation = [];
  for (let index = 0; index < 24; index++) {
    navigation.push('<li><a href="/p/' + index + '">Menu ' + index + '</a></li>');
  }
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<title>Halaman ' + pageId + ' - Tenant ' + tenant + '</title>',
    '<meta name="description" content="' + randomText(random, 10) + '">',
    '<link rel="canonical" href="https://' + tenant + '/p/' + pageId + '">',
    '<script src="/assets/tracker.js"></script>',
    '<style>.ad{display:block}</style></head><body>',
    '<header><nav><ul>' + navigation.join('') + '</ul></nav></header>',
    '<div class="ad">Iklan banner 728x90</div>',
    '<main><article>' + body.join('\n') + '</article></main>',
    '<footer><p>Copyright tenant ' + tenant + '.</p></footer>',
    '<script>window.tracker = {init: function () { return 1; }};</script>',
    '</body></html>'
  ].join('\n');
}

function hrtimeMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function httpRequest({ port, requestPath, method = 'GET', headers = {}, timeout = 15000 }) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on('data', (chunk) => {
        bytes += chunk.length;
        chunks.push(chunk);
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks),
          bytes,
          ms: hrtimeMs(start)
        });
      });
    });
    request.setTimeout(timeout, () => request.destroy(new Error('request timeout')));
    request.on('error', reject);
    request.end();
  });
}

async function pool(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = [];
  const size = Math.min(limit, items.length);
  for (let index = 0; index < size; index++) {
    runners.push((async () => {
      for (;;) {
        const current = cursor++;
        if (current >= items.length) return;
        results[current] = await worker(items[current], current);
      }
    })());
  }
  await Promise.all(runners);
  return results;
}

function signContainer(privateKey, url, bytes, options = {}) {
  return makoLib.signMakoContainer(privateKey, url, bytes, { signedAt: NOW, ...options });
}

function buildTenant(tenantIndex, options) {
  const domain = 't' + tenantIndex + '.bench.example';
  const random = mulberry32(1000 + tenantIndex);
  const keyPair = cryptoLib.generateKeyPair();
  const publicKeyValue = cryptoLib.encodePublicKey(keyPair.publicKey);
  const pages = [];
  for (let pageId = 1; pageId <= options.pagesPerTenant; pageId++) {
    const html = buildPageHtml(2000 + tenantIndex * 100 + pageId, tenantIndex, pageId, options.paragraphs);
    const converted = makoHtmlLib.htmlToMako(html, {
      canonical: 'https://' + domain + '/p/' + pageId,
      language: 'en',
      updated: '2026-09-15'
    });
    pages.push({
      id: pageId,
      url: 'https://' + domain + '/p/' + pageId,
      html,
      mako: converted.text,
      tokens: converted.frontmatter.tokens
    });
  }

  const originalDigests = {};
  for (const page of pages) {
    originalDigests['/p/' + page.id] = sha256Base64(Buffer.from(page.mako, 'utf8'));
  }

  const changed = new Set();
  const changeCount = Math.round(pages.length * (options.changeRatio ?? 0.2));
  for (let index = 0; index < changeCount; index++) {
    const page = pages[(index * 3) % pages.length];
    if (changed.has(page.id)) continue;
    changed.add(page.id);
    page.mako = page.mako.trimEnd() + '\n\nPembaruan ' + index + '.\n';
  }

  const currentDigests = {};
  const containers = new Map();
  for (const page of pages) {
    const bytes = Buffer.from(page.mako, 'utf8');
    currentDigests['/p/' + page.id] = sha256Base64(bytes);
    containers.set(page.id, signContainer(keyPair.privateKey, page.url, bytes));
  }

  const index = {
    version: '0.2',
    domain,
    site: {
      name: 'Tenant ' + tenantIndex,
      description: 'Situs uji tenant nomor ' + tenantIndex + '.',
      type: 'blog',
      languages: ['en'],
      updated_at: NOW
    },
    generated_at: NOW,
    page: 1,
    page_count: 1,
    entries: pages.map((page) => ({
      url: '/p/' + page.id,
      type: 'article',
      tokens: page.tokens,
      title: 'Halaman ' + page.id,
      summary: 'Ringkasan halaman ' + page.id + '.',
      lang: 'en',
      updated: '2026-09-15',
      etag: '"mako-' + currentDigests['/p/' + page.id].slice(0, 16).replace(/[+/=]/g, '') + '"',
      'sha-256': currentDigests['/p/' + page.id]
    }))
  };
  const indexText = JSON.stringify(index, null, 2) + '\n';
  const indexSignature = signContainer(keyPair.privateKey, 'https://' + domain + '/.well-known/mako-index.json', Buffer.from(indexText, 'utf8'), { context: 'mako-index' });

  const manifest = {
    $schema: 'https://aifeed.md/schema/ai-json/v0.2.json',
    version: '0.2',
    identity: {
      domain,
      name: 'Tenant ' + tenantIndex,
      type: 'blog',
      locale: 'en',
      contact: 'mailto:bench@example.com',
      public_key: publicKeyValue,
      key_id: 'bench-' + tenantIndex,
      signature_url: '/.well-known/ai-signature.json'
    },
    validity: {
      signed_at: NOW,
      expires_at: '2027-09-15T08:00:00Z'
    },
    content: {
      languages: ['en'],
      mako: {
        index_url: '/.well-known/mako-index.json',
        signature: 'optional',
        overrides: 'restrict-only'
      }
    },
    permissions: {
      default: 'allow',
      usage: {
        search: 'allow',
        retrieval: 'allow',
        input: 'allow',
        training: 'deny',
        quote: 'allow',
        summarize: 'allow',
        reproduce: 'deny',
        translate: 'allow',
        modify: 'deny',
        embed: 'deny',
        commercial_use: 'deny'
      },
      attribution: 'optional'
    },
    limits: {
      requests_per_minute: options.requestsPerMinute ?? 15,
      concurrent: options.concurrent ?? 2,
      crawl_delay_seconds: 0
    },
    revocation: {
      list_url: 'https://aifeed.md/revoke/v1/' + domain + '.json',
      maximum_check_interval_hours: 24
    },
    metadata: {
      generated_at: NOW,
      generated_by: 'bench-enforcement/0.1'
    }
  };
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  const manifestSignature = {
    algorithm: 'ed25519',
    canonicalization: 'jcs-rfc8785',
    signature: cryptoLib.encodeSignature(cryptoLib.signManifest(keyPair.privateKey, manifest))
  };

  return {
    domain,
    keyPair,
    publicKeyValue,
    pages,
    changed,
    containers,
    manifest,
    manifestText,
    manifestSignatureText: JSON.stringify(manifestSignature, null, 2) + '\n',
    indexText,
    indexSignatureText: JSON.stringify(indexSignature, null, 2) + '\n',
    originalDigests,
    currentDigests
  };
}

function classifyAgent(userAgent) {
  const value = String(userAgent || '');
  if (value.includes('AIFeedBot')) return 'compliant';
  if (value.includes('GPTBot') || value.includes('CCBot') || value.includes('Bytespider')) return 'training';
  if (value.includes('CrawlerX')) return 'plain';
  return 'human';
}

function startOrigin({ tenants, latencyMs = 6, workIterations = 0 }) {
  const byDomain = new Map(tenants.map((tenant) => [tenant.domain, tenant]));
  const stats = {
    requests: 0,
    bytes: 0,
    cpu_ms: 0,
    statuses: {},
    peak_concurrent: 0,
    active: 0,
    human_requests: 0
  };
  const server = http.createServer((request, response) => {
    const start = process.hrtime.bigint();
    const host = String(request.headers.host || '').split(':')[0];
    const tenant = byDomain.get(host) || tenants[0];
    stats.requests++;
    stats.active++;
    stats.peak_concurrent = Math.max(stats.peak_concurrent, stats.active);
    const finish = (status, headers, body) => {
      if (workIterations > 0 && body) {
        for (let index = 0; index < workIterations; index++) {
          nodeCrypto.createHash('sha256').update(body).digest();
        }
      }
      stats.statuses[status] = (stats.statuses[status] || 0) + 1;
      if (body) stats.bytes += Buffer.byteLength(body);
      stats.cpu_ms += hrtimeMs(start);
      setTimeout(() => {
        stats.active--;
        response.writeHead(status, headers);
        response.end(body || '');
      }, latencyMs);
    };

    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/.well-known/ai.json') {
      return finish(200, { 'content-type': 'application/json; charset=utf-8' }, tenant.manifestText);
    }
    if (url.pathname === '/.well-known/ai-signature.json') {
      return finish(200, { 'content-type': 'application/json; charset=utf-8' }, tenant.manifestSignatureText);
    }
    if (url.pathname === '/.well-known/mako-index.json') {
      return finish(200, { 'content-type': 'application/json; charset=utf-8' }, tenant.indexText);
    }
    if (url.pathname === '/.well-known/mako-index.json.sig') {
      return finish(200, { 'content-type': 'application/json; charset=utf-8' }, tenant.indexSignatureText);
    }
    const match = /^\/p\/(\d+)$/.exec(url.pathname);
    if (match) {
      const page = tenant.pages.find((item) => item.id === Number(match[1]));
      if (!page) return finish(404, { 'content-type': 'text/plain' }, 'not found');
      const accept = String(request.headers.accept || '');
      if (accept.includes('text/mako+markdown')) {
        const bytes = Buffer.from(page.mako, 'utf8');
        const container = tenant.containers.get(page.id);
        return finish(200, {
          'content-type': 'text/mako+markdown; charset=utf-8',
          'x-mako-version': '1.0',
          'x-mako-tokens': String(page.tokens),
          vary: 'Accept',
          'x-aifeed-signature': 'mako1:' + Buffer.from(JSON.stringify(container), 'utf8').toString('base64url')
        }, page.mako);
      }
      return finish(200, { 'content-type': 'text/html; charset=utf-8', vary: 'Accept' }, page.html);
    }
    finish(404, { 'content-type': 'text/plain' }, 'not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        server,
        port: server.address().port,
        stats,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

function createEdgePolicy(scenario) {
  const windows = new Map();
  const active = new Map();
  return {
    classify: classifyAgent,
    decide(profile, tenant) {
      if (profile === 'human' || profile === 'compliant') {
        return { action: 'allow' };
      }
      if (scenario >= 1 && profile === 'training' && tenant.manifest.permissions.usage.training === 'deny') {
        return { action: 'block' };
      }
      if (scenario >= 2) {
        const concurrentLimit = tenant.manifest.limits.concurrent;
        const key = tenant.domain + '|' + profile;
        const current = active.get(key) || 0;
        if (current >= concurrentLimit) {
          return { action: 'limit', reason: 'concurrent' };
        }
        const rpm = tenant.manifest.limits.requests_per_minute;
        const now = Date.now();
        const list = (windows.get(key) || []).filter((stamp) => now - stamp < 60000);
        if (list.length >= rpm) {
          windows.set(key, list);
          return { action: 'limit', reason: 'rpm' };
        }
        list.push(now);
        windows.set(key, list);
      }
      return { action: 'allow' };
    },
    begin(profile, tenant) {
      const key = tenant.domain + '|' + profile;
      active.set(key, (active.get(key) || 0) + 1);
    },
    end(profile, tenant) {
      const key = tenant.domain + '|' + profile;
      active.set(key, Math.max(0, (active.get(key) || 0) - 1));
    }
  };
}

function startEdge({ originPort, tenants, scenario }) {
  const byDomain = new Map(tenants.map((tenant) => [tenant.domain, tenant]));
  const policy = createEdgePolicy(scenario);
  const stats = {
    forwarded: 0,
    blocked: 0,
    limited: 0,
    bytes_to_clients: 0,
    policy_cpu_ms: 0,
    peak_concurrent: {},
    active: {},
    by_profile: {}
  };
  const profileStats = (profile) => {
    if (!stats.by_profile[profile]) {
      stats.by_profile[profile] = { requests: 0, forwarded: 0, blocked: 0, limited: 0, bytes: 0 };
    }
    return stats.by_profile[profile];
  };
  const server = http.createServer((request, response) => {
    const start = process.hrtime.bigint();
    const host = String(request.headers.host || '').split(':')[0];
    const tenant = byDomain.get(host) || tenants[0];
    const profile = classifyAgent(request.headers['user-agent']);
    const perProfile = profileStats(profile);
    perProfile.requests++;
    const decision = policy.decide(profile, tenant);
    stats.policy_cpu_ms += hrtimeMs(start);
    if (decision.action === 'block') {
      stats.blocked++;
      perProfile.blocked++;
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('training denied by manifest');
      return;
    }
    if (decision.action === 'limit') {
      stats.limited++;
      perProfile.limited++;
      response.writeHead(429, {
        'content-type': 'text/plain; charset=utf-8',
        'retry-after': '2',
        'x-aifeed-limit': decision.reason
      });
      response.end('rate limited');
      return;
    }
    policy.begin(profile, tenant);
    stats.active[profile] = (stats.active[profile] || 0) + 1;
    stats.peak_concurrent[profile] = Math.max(stats.peak_concurrent[profile] || 0, stats.active[profile]);
    const proxy = http.request({
      host: '127.0.0.1',
      port: originPort,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: tenant.domain }
    }, (upstream) => {
      response.writeHead(upstream.statusCode, upstream.headers);
      upstream.on('data', (chunk) => {
        stats.bytes_to_clients += chunk.length;
        perProfile.bytes += chunk.length;
        response.write(chunk);
      });
      upstream.on('end', () => {
        policy.end(profile, tenant);
        stats.active[profile] = Math.max(0, stats.active[profile] - 1);
        response.end();
      });
    });
    proxy.on('error', () => {
      policy.end(profile, tenant);
      stats.active[profile] = Math.max(0, stats.active[profile] - 1);
      response.writeHead(502, { 'content-type': 'text/plain' });
      response.end('bad gateway');
    });
    request.pipe(proxy);
    stats.forwarded++;
    perProfile.forwarded++;
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        server,
        port: server.address().port,
        stats,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

function emptyClientMetrics(profile) {
  return {
    profile,
    requests: 0,
    received_bytes: 0,
    statuses: {},
    verified: 0,
    verify_failed: 0,
    verify_cpu_ms: 0,
    index_cpu_ms: 0,
    pages_fetched: 0,
    skipped_unchanged: 0,
    latencies: []
  };
}

async function runCompliantClient({ edgePort, tenants, scenario, limitTenants }) {
  const metrics = emptyClientMetrics('compliant');
  const selected = tenants.slice(0, limitTenants);
  for (const tenant of selected) {
    const manifestResponse = await httpRequest({
      port: edgePort,
      requestPath: '/.well-known/ai.json',
      headers: { host: tenant.domain, 'user-agent': UA.compliant, accept: 'application/json' }
    });
    metrics.requests++;
    metrics.received_bytes += manifestResponse.bytes;
    metrics.statuses[manifestResponse.status] = (metrics.statuses[manifestResponse.status] || 0) + 1;

    let targets = tenant.pages.map((page) => '/p/' + page.id);
    if (scenario >= 3) {
      const indexResponse = await httpRequest({
        port: edgePort,
        requestPath: '/.well-known/mako-index.json',
        headers: { host: tenant.domain, 'user-agent': UA.compliant, accept: 'application/json' }
      });
      metrics.requests++;
      metrics.received_bytes += indexResponse.bytes;
      const signatureResponse = await httpRequest({
        port: edgePort,
        requestPath: '/.well-known/mako-index.json.sig',
        headers: { host: tenant.domain, 'user-agent': UA.compliant, accept: 'application/json' }
      });
      metrics.requests++;
      metrics.received_bytes += signatureResponse.bytes;
      const start = process.hrtime.bigint();
      const verified = makoLib.verifyMakoIndex({
        indexText: indexResponse.body.toString('utf8'),
        indexUrl: 'https://' + tenant.domain + '/.well-known/mako-index.json',
        publicKeyValue: tenant.publicKeyValue,
        signatureText: signatureResponse.body.toString('utf8'),
        requireSignature: false
      });
      metrics.index_cpu_ms += hrtimeMs(start);
      if (!verified.ok) metrics.verify_failed++;
      const index = JSON.parse(indexResponse.body.toString('utf8'));
      const changed = [];
      for (const entry of index.entries) {
        if (tenant.originalDigests[entry.url] === entry['sha-256']) {
          metrics.skipped_unchanged++;
        } else {
          changed.push(entry.url);
        }
      }
      targets = changed;
    }

    for (const target of targets) {
      const response = await httpRequest({
        port: edgePort,
        requestPath: target,
        headers: {
          host: tenant.domain,
          'user-agent': UA.compliant,
          accept: scenario === 0 ? 'text/html' : 'text/mako+markdown'
        }
      });
      metrics.requests++;
      metrics.received_bytes += response.bytes;
      metrics.statuses[response.status] = (metrics.statuses[response.status] || 0) + 1;
      metrics.pages_fetched++;
      if (scenario === 0 || !String(response.headers['content-type'] || '').includes('text/mako+markdown')) {
        continue;
      }
      const inline = response.headers['x-aifeed-signature'];
      if (typeof inline === 'string' && inline.startsWith('mako1:')) {
        const containerText = Buffer.from(inline.slice('mako1:'.length), 'base64url').toString('utf8');
        const start = process.hrtime.bigint();
        const result = makoLib.verifyMakoContainer({
          containerText,
          pageUrl: 'https://' + tenant.domain + target,
          bodyBytes: response.body,
          publicKey: cryptoLib.decodePublicKey(tenant.publicKeyValue)
        });
        metrics.verify_cpu_ms += hrtimeMs(start);
        if (result.ok) metrics.verified++;
        else metrics.verify_failed++;
      }
    }
  }
  return metrics;
}

async function runTrainingBot({ edgePort, tenants, limitTenants }) {
  const metrics = emptyClientMetrics('training');
  const selected = tenants.slice(0, limitTenants);
  const targets = [];
  for (const tenant of selected) {
    for (const page of tenant.pages) {
      targets.push({ tenant, path: '/p/' + page.id });
    }
  }
  await pool(targets, 40, async ({ tenant, path: target }) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await httpRequest({
        port: edgePort,
        requestPath: target,
        headers: { host: tenant.domain, 'user-agent': UA.training, accept: 'text/html' }
      });
      metrics.requests++;
      metrics.received_bytes += response.bytes;
      metrics.statuses[response.status] = (metrics.statuses[response.status] || 0) + 1;
      if (response.status === 403 || response.status === 200) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  });
  return metrics;
}

async function runPlainCrawler({ edgePort, tenants, limitTenants }) {
  const metrics = emptyClientMetrics('plain');
  const selected = tenants.slice(0, limitTenants);
  const targets = [];
  for (const tenant of selected) {
    for (const page of tenant.pages) {
      targets.push({ tenant, path: '/p/' + page.id });
    }
  }
  await pool(targets, 4, async ({ tenant, path: target }) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await httpRequest({
        port: edgePort,
        requestPath: target,
        headers: { host: tenant.domain, 'user-agent': UA.plain, accept: 'text/html' }
      });
      metrics.requests++;
      metrics.received_bytes += response.bytes;
      metrics.statuses[response.status] = (metrics.statuses[response.status] || 0) + 1;
      if (response.status === 200) return;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  });
  return metrics;
}

async function runHumanVisitors({ edgePort, tenants, limitTenants, requestsPerTenant }) {
  const metrics = emptyClientMetrics('human');
  const selected = tenants.slice(0, limitTenants);
  for (const tenant of selected) {
    for (let index = 0; index < requestsPerTenant; index++) {
      const page = tenant.pages[index % tenant.pages.length];
      const response = await httpRequest({
        port: edgePort,
        requestPath: '/p/' + page.id,
        headers: { host: tenant.domain, 'user-agent': UA.human, accept: 'text/html' }
      });
      metrics.requests++;
      metrics.received_bytes += response.bytes;
      metrics.latencies.push(response.ms);
      metrics.statuses[response.status] = (metrics.statuses[response.status] || 0) + 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }
  return metrics;
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[index];
}

async function runScenario(config, scenario) {
  const tenants = [];
  for (let index = 1; index <= config.tenants; index++) {
    tenants.push(buildTenant(index, config));
  }
  const origin = await startOrigin({
    tenants,
    latencyMs: config.originLatencyMs,
    workIterations: config.cpuWorkIterations
  });
  const edge = await startEdge({ originPort: origin.port, tenants, scenario });
  const clients = {
    compliant: await runCompliantClient({ edgePort: edge.port, tenants, scenario, limitTenants: config.compliantTenants }),
    training: await runTrainingBot({ edgePort: edge.port, tenants, limitTenants: config.trainingTenants }),
    plain: await runPlainCrawler({ edgePort: edge.port, tenants, limitTenants: config.plainTenants }),
    human: await runHumanVisitors({ edgePort: edge.port, tenants, limitTenants: config.humanTenants, requestsPerTenant: config.humanRequests })
  };
  const result = {
    scenario,
    tenants: tenants.length,
    origin: {
      requests: origin.stats.requests,
      bytes: origin.stats.bytes,
      cpu_ms: Number(origin.stats.cpu_ms.toFixed(2)),
      peak_concurrent: origin.stats.peak_concurrent,
      statuses: origin.stats.statuses
    },
    edge: {
      forwarded: edge.stats.forwarded,
      blocked: edge.stats.blocked,
      limited: edge.stats.limited,
      bytes_to_clients: edge.stats.bytes_to_clients,
      policy_cpu_ms: Number(edge.stats.policy_cpu_ms.toFixed(2)),
      peak_concurrent: edge.stats.peak_concurrent,
      by_profile: edge.stats.by_profile
    },
    clients: {},
    human_p95_ms: Number(percentile(clients.human.latencies, 0.95).toFixed(2))
  };
  for (const key of Object.keys(clients)) {
    const metrics = clients[key];
    result.clients[key] = {
      requests: metrics.requests,
      received_bytes: metrics.received_bytes,
      statuses: metrics.statuses,
      verified: metrics.verified,
      verify_failed: metrics.verify_failed,
      verify_cpu_ms: Number(metrics.verify_cpu_ms.toFixed(3)),
      index_cpu_ms: Number(metrics.index_cpu_ms.toFixed(3)),
      pages_fetched: metrics.pages_fetched,
      skipped_unchanged: metrics.skipped_unchanged
    };
  }
  await edge.close();
  await origin.close();
  return result;
}

function clientReceivedTotal(result) {
  return Object.values(result.clients).reduce((sum, entry) => sum + entry.received_bytes, 0);
}

function computeSavings(baseline, scenario) {
  const publisher = {
    bytes_pct: baseline.origin.bytes === 0 ? 0 : Number((100 * (1 - scenario.origin.bytes / baseline.origin.bytes)).toFixed(2)),
    cpu_pct: baseline.origin.cpu_ms === 0 ? 0 : Number((100 * (1 - scenario.origin.cpu_ms / baseline.origin.cpu_ms)).toFixed(2)),
    peak_concurrent_pct: baseline.origin.peak_concurrent === 0 ? 0 : Number((100 * (1 - scenario.origin.peak_concurrent / baseline.origin.peak_concurrent)).toFixed(2)),
    blocked: scenario.edge.blocked,
    limited: scenario.edge.limited
  };
  const baselineClientBytes = clientReceivedTotal(baseline);
  const ai = {
    bytes_pct: baselineClientBytes === 0 ? 0 : Number((100 * (1 - clientReceivedTotal(scenario) / baselineClientBytes)).toFixed(2)),
    compliant_bytes_pct: baseline.clients.compliant.received_bytes === 0
      ? 0
      : Number((100 * (1 - scenario.clients.compliant.received_bytes / baseline.clients.compliant.received_bytes)).toFixed(2)),
    skipped_unchanged: scenario.clients.compliant.skipped_unchanged,
    verified: scenario.clients.compliant.verified,
    verify_failed: scenario.clients.compliant.verify_failed,
    verify_cpu_ms_per_page: scenario.clients.compliant.verified === 0
      ? 0
      : Number((scenario.clients.compliant.verify_cpu_ms / scenario.clients.compliant.verified).toFixed(3))
  };
  return { publisher, ai };
}

function createConfig(overrides = {}) {
  return {
    tenants: overrides.tenants ?? 1,
    pagesPerTenant: overrides.pagesPerTenant ?? 18,
    paragraphs: overrides.paragraphs ?? 6,
    changeRatio: overrides.changeRatio ?? 0.2,
    compliantTenants: overrides.compliantTenants ?? Math.min(1, overrides.tenants ?? 1),
    trainingTenants: overrides.trainingTenants ?? Math.min(1, overrides.tenants ?? 1),
    plainTenants: overrides.plainTenants ?? Math.min(1, overrides.tenants ?? 1),
    humanTenants: overrides.humanTenants ?? Math.min(1, overrides.tenants ?? 1),
    humanRequests: overrides.humanRequests ?? 8,
    requestsPerMinute: overrides.requestsPerMinute ?? 15,
    concurrent: overrides.concurrent ?? 2,
    originLatencyMs: overrides.originLatencyMs ?? 6,
    cpuWorkIterations: overrides.cpuWorkIterations ?? 120
  };
}

async function runEnforcementBenchmark(options = {}) {
  const singleConfig = createConfig(options.single || {});
  const multiConfig = createConfig({
    tenants: options.multi?.tenants ?? 100,
    pagesPerTenant: options.multi?.pagesPerTenant ?? 4,
    paragraphs: options.multi?.paragraphs ?? 2,
    compliantTenants: options.multi?.compliantTenants ?? 20,
    trainingTenants: options.multi?.trainingTenants ?? 50,
    plainTenants: options.multi?.plainTenants ?? 30,
    humanTenants: options.multi?.humanTenants ?? 20,
    humanRequests: options.multi?.humanRequests ?? 3,
    originLatencyMs: options.multi?.originLatencyMs ?? 2,
    cpuWorkIterations: options.multi?.cpuWorkIterations ?? 40
  });

  const single = {};
  for (const scenario of [0, 1, 2, 3]) {
    single['S' + scenario] = await runScenario(singleConfig, scenario);
  }
  const singleSavings = {
    S1: computeSavings(single.S0, single.S1),
    S2: computeSavings(single.S0, single.S2),
    S3: computeSavings(single.S0, single.S3)
  };

  const multi = {
    baseline: await runScenario(multiConfig, 0),
    enforced: await runScenario(multiConfig, 3)
  };
  const multiSavings = computeSavings(multi.baseline, multi.enforced);
  const per1000 = {
    label: 'model',
    origin_bytes_saved: Math.round((multi.baseline.origin.bytes - multi.enforced.origin.bytes) * 10),
    origin_cpu_ms_saved: Number(((multi.baseline.origin.cpu_ms - multi.enforced.origin.cpu_ms) * 10).toFixed(2)),
    blocked: multi.enforced.edge.blocked * 10,
    limited: multi.enforced.edge.limited * 10
  };

  return {
    version: '0.1',
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    methodology: {
      transport: 'real local HTTP (origin and PDP edge in-process, loopback)',
      byte_accounting: 'response body bytes only; headers excluded',
      cpu_accounting: 'origin handler wall time and edge policy decision time (hrtime sums)',
      human_control: '10% human visitors exempt from AI policy; p95 latency measured at the client',
      rate_limits: 'manifest limits (rpm ' + singleConfig.requestsPerMinute + ', concurrent ' + singleConfig.concurrent + ') applied to non-compliant AI profiles',
      delta_model: 'compliant client stores digests, fetches index, retrieves only changed pages (' + Math.round(singleConfig.changeRatio * 100) + '% changed)',
      determinism: 'content generation and client order are seeded; network timing and rolling rate-limit windows can cause small run-to-run variance',
      cost_model: 'origin requests perform deterministic SHA-256 work (' + singleConfig.cpuWorkIterations + ' iterations) to model per-request rendering cost',
      labels: {
        measured: 'terukur-simulasi (local harness, real HTTP)',
        model: 'model (extrapolation)',
        estimate: 'estimasi'
      },
      caveats: [
        'Loopback harness, not a production CDN or shared-hosting cluster.',
        'Synthetic corpus and deterministic clients; absolute percentages depend on boilerplate ratio.',
        'Verification CPU is CPU on the benchmark machine.',
        'Without enforcement, savings are approximately zero (see S0).'
      ]
    },
    single_origin: {
      config: singleConfig,
      scenarios: single,
      savings: singleSavings
    },
    multi_origin: {
      config: multiConfig,
      baseline: multi.baseline,
      enforced: multi.enforced,
      savings: multiSavings,
      per_1000_tenants: per1000
    }
  };
}

function renderEnforcementMarkdown(results) {
  const line = (cells) => '| ' + cells.join(' | ') + ' |';
  const rows = [];
  rows.push('# Benchmark Penegakan AIFeed v0.2 — Penghematan Dua Sisi');
  rows.push('');
  rows.push('Generated by `node tools/bench-enforcement.js` (harness HTTP lokal, seed deterministik).');
  rows.push('');
  rows.push('> **Label bukti:** angka pada laporan ini adalah **terukur-simulasi** (harness HTTP lokal, bukan CDN nyata). Proyeksi hosting diberi label **model**.');
  rows.push('');
  rows.push('## Skenario (satu origin, ' + results.single_origin.config.pagesPerTenant + ' halaman)');
  rows.push('');
  rows.push(line(['Metrik', 'S0 (tanpa penegakan)', 'S1 (blokir training)', 'S2 (+rate limit)', 'S3 (+MAKO/delta)']));
  rows.push(line(['---', '---:', '---:', '---:', '---:']));
  const s = results.single_origin.scenarios;
  rows.push(line(['Request origin', s.S0.origin.requests, s.S1.origin.requests, s.S2.origin.requests, s.S3.origin.requests]));
  rows.push(line(['Byte origin', s.S0.origin.bytes, s.S1.origin.bytes, s.S2.origin.bytes, s.S3.origin.bytes]));
  rows.push(line(['CPU origin (ms)', s.S0.origin.cpu_ms, s.S1.origin.cpu_ms, s.S2.origin.cpu_ms, s.S3.origin.cpu_ms]));
  rows.push(line(['Puncak koneksi origin', s.S0.origin.peak_concurrent, s.S1.origin.peak_concurrent, s.S2.origin.peak_concurrent, s.S3.origin.peak_concurrent]));
  rows.push(line(['Blokir 403', s.S0.edge.blocked, s.S1.edge.blocked, s.S2.edge.blocked, s.S3.edge.blocked]));
  rows.push(line(['Batasi 429', s.S0.edge.limited, s.S1.edge.limited, s.S2.edge.limited, s.S3.edge.limited]));
  rows.push(line(['Byte diterima klien', clientReceivedTotal(s.S0), clientReceivedTotal(s.S1), clientReceivedTotal(s.S2), clientReceivedTotal(s.S3)]));
  rows.push(line(['p95 pengunjung manusia (ms)', s.S0.human_p95_ms, s.S1.human_p95_ms, s.S2.human_p95_ms, s.S3.human_p95_ms]));
  rows.push('');
  rows.push('## Penghematan Dua Sisi (vs S0)');
  rows.push('');
  rows.push(line(['Sisi', 'Metrik', 'S1', 'S2', 'S3']));
  rows.push(line(['---', '---', '---:', '---:', '---:']));
  const savingsByScenario = results.single_origin.savings;
  const metricRows = [
    ['Pemilik web / host', 'Byte egress', (saving) => saving.publisher.bytes_pct + '%'],
    ['Pemilik web / host', 'CPU origin', (saving) => saving.publisher.cpu_pct + '%'],
    ['Pemilik web / host', 'Puncak koneksi origin', (saving) => saving.publisher.peak_concurrent_pct + '%'],
    ['Pemilik web / host', 'Blokir 403', (saving) => String(saving.publisher.blocked)],
    ['Pemilik web / host', 'Batasi 429', (saving) => String(saving.publisher.limited)],
    ['Sisi AI', 'Byte diterima (semua profil)', (saving) => saving.ai.bytes_pct + '%'],
    ['Sisi AI', 'Byte klien patuh AIFeed', (saving) => saving.ai.compliant_bytes_pct + '%'],
    ['Sisi AI', 'Halaman tak berubah dilewati', (saving) => String(saving.ai.skipped_unchanged)],
    ['Sisi AI', 'Tanda tangan terverifikasi', (saving) => String(saving.ai.verified)],
    ['Sisi AI', 'CPU verifikasi (ms/halaman)', (saving) => String(saving.ai.verify_cpu_ms_per_page)]
  ];
  for (const [side, name, extract] of metricRows) {
    rows.push(line([side, name, extract(savingsByScenario.S1), extract(savingsByScenario.S2), extract(savingsByScenario.S3)]));
  }
  const last = results.single_origin.savings.S3;
  rows.push('');
  rows.push('Ringkasan S3: pemilik web menghemat **' + last.publisher.bytes_pct + '% byte** dan **' + last.publisher.cpu_pct + '% CPU origin**; sisi AI menghemat **' + last.ai.bytes_pct + '% byte** dengan **' + last.ai.skipped_unchanged + ' halaman tak berubah dilewati** dan verifikasi **' + last.ai.verify_cpu_ms_per_page + ' ms/halaman**.');
  rows.push('');
  rows.push('## Skala Hosting (multi-origin, ' + results.multi_origin.config.tenants + ' tenant)');
  rows.push('');
  rows.push(line(['Metrik', 'S0', 'S3 (penegakan penuh)', 'Selisih']));
  rows.push(line(['---', '---:', '---:', '---:']));
  const b = results.multi_origin.baseline.origin;
  const e = results.multi_origin.enforced.origin;
  rows.push(line(['Request origin', b.requests, e.requests, b.requests - e.requests]));
  rows.push(line(['Byte origin', b.bytes, e.bytes, b.bytes - e.bytes]));
  rows.push(line(['CPU origin (ms)', b.cpu_ms, e.cpu_ms, Number((b.cpu_ms - e.cpu_ms).toFixed(2))]));
  rows.push(line(['Blokir 403 / batasi 429', '0 / 0', results.multi_origin.enforced.edge.blocked + ' / ' + results.multi_origin.enforced.edge.limited, '—']));
  rows.push('');
  rows.push('Proyeksi per 1.000 tenant (**[model]**, ekstrapolasi linear dari 100 tenant): ' +
    results.multi_origin.per_1000_tenants.origin_bytes_saved + ' byte, ' +
    results.multi_origin.per_1000_tenants.origin_cpu_ms_saved + ' ms CPU origin, ' +
    results.multi_origin.per_1000_tenants.blocked + ' blokir, ' +
    results.multi_origin.per_1000_tenants.limited + ' pembatasan per bulan (jika siklus berulang).');
  rows.push('');
  rows.push('## Verifikasi tanda tangan (klien patuh)');
  rows.push('');
  rows.push(line(['Skenario', 'Halaman diambil', 'Terverifikasi', 'Gagal', 'CPU verifikasi (ms)']));
  rows.push(line(['---', '---:', '---:', '---:', '---:']));
  for (const key of ['S0', 'S1', 'S2', 'S3']) {
    const compliant = results.single_origin.scenarios[key].clients.compliant;
    rows.push(line([key, compliant.pages_fetched, compliant.verified, compliant.verify_failed, compliant.verify_cpu_ms]));
  }
  rows.push('');
  rows.push('## Metodologi');
  rows.push('');
  for (const [key, value] of Object.entries(results.methodology).filter(([, entry]) => typeof entry === 'string')) {
    rows.push('- ' + key + ': ' + value);
  }
  rows.push('');
  rows.push('## Caveat');
  rows.push('');
  for (const caveat of results.methodology.caveats) {
    rows.push('- ' + caveat);
  }
  rows.push('');
  rows.push('## Konfigurasi edge produksi');
  rows.push('');
  rows.push('Template nginx dan Caddy untuk paritas VPS tersedia di `benchmarks/edge/` (lihat README di sana).');
  rows.push('');
  return rows.join('\n');
}

async function main() {
  const results = await runEnforcementBenchmark({});
  fs.mkdirSync(BENCH_DIR, { recursive: true });
  fs.writeFileSync(path.join(BENCH_DIR, 'enforcement-report.json'), JSON.stringify(results, null, 2) + '\n');
  fs.writeFileSync(path.join(BENCH_DIR, 'enforcement-report.md'), renderEnforcementMarkdown(results), 'utf8');
  const last = results.single_origin.savings.S3;
  process.stdout.write('enforcement benchmark written: benchmarks/enforcement-report.md\n');
  process.stdout.write('S3 savings: publisher bytes ' + last.publisher.bytes_pct + '%, CPU ' + last.publisher.cpu_pct +
    '%, AI bytes ' + last.ai.bytes_pct + '%, verify ' + last.ai.verify_cpu_ms_per_page + ' ms/page\n');
}

module.exports = { runEnforcementBenchmark, renderEnforcementMarkdown, createConfig, classifyAgent };

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write('fatal: ' + error.stack + '\n');
    process.exitCode = 1;
  });
}
