#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const makoLib = require('../lib/mako');
const makoHtmlLib = require('../lib/mako-html');
const cryptoLib = require('../lib/crypto');
const { sha256Base64 } = require('../lib/digest');
const { mulberry32 } = require('./fuzz');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'benchmarks');
const DEFAULT_PAGES = 60;
const CHANGE_RATIO = 0.1;

const WORDS = ('konten situs artikel berita data izin tanda tangan verifikasi crawl delta protokol standar agen ' +
  'markdown hemat bandwidth server origin domain kunci ed25519 manifest kepercayaan lisensi atribusi ' +
  'indeks digest negosiasi teks halaman struktur metadata ringkasan konteks situs web pengguna ' +
  'jaringan sistem konten digital publikasi redaksi laporan analisis industri pasar teknologi').split(' ');

function sentence(random, wordCount) {
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(WORDS[Math.floor(random() * WORDS.length)]);
  }
  return words.join(' ') + '.';
}

function paragraph(random, sentences) {
  const parts = [];
  for (let i = 0; i < sentences; i++) {
    parts.push(sentence(random, 8 + Math.floor(random() * 12)));
  }
  return parts.join(' ');
}

function buildHtml(seed, options = {}) {
  const random = mulberry32(seed);
  const paragraphs = options.paragraphs ?? 12;
  const navLinks = [];
  for (let i = 0; i < 30; i++) {
    navLinks.push('<li class="nav-item"><a class="nav-link" href="/kategori/' + i + '">Kategori ' + i + '</a></li>');
  }
  const sidebar = [];
  for (let i = 0; i < 20; i++) {
    sidebar.push('<li><a href="/populer/' + i + '">Artikel populer ' + i + '</a><span class="meta">5 menit baca</span></li>');
  }
  const related = [];
  for (let i = 0; i < 20; i++) {
    related.push('<article class="related-card"><a href="/terkait/' + i + '"><h3>Artikel terkait ' + i + '</h3></a><p>' + sentence(random, 12) + '</p></article>');
  }
  const comments = [];
  for (let i = 0; i < 15; i++) {
    comments.push('<li class="comment" data-id="' + i + '"><span class="comment-author">Pembaca ' + i + '</span><p>' + sentence(random, 16) + '</p><time datetime="2026-09-1' + (i % 9) + 'T10:00:00Z">1' + (i % 9) + ' Sep</time></li>');
  }
  const body = [];
  body.push('<h1 itemprop="headline">Analisis Konten Digital ' + seed + '</h1>');
  body.push('<p class="byline">Oleh Redaksi <time datetime="2026-09-15T08:00:00Z">15 September 2026</time> - 5 menit baca</p>');
  for (let i = 0; i < paragraphs; i++) {
    body.push('<p>' + paragraph(random, 4) + '</p>');
    if (i % 3 === 0) {
      body.push('<ul class="poin"><li>' + sentence(random, 8) + '</li><li>' + sentence(random, 8) + '</li></ul>');
    }
    if (i % 5 === 2) {
      body.push('<div class="ad in-article"><span>Iklan</span><a href="/promo/' + i + '">Promo berlangganan</a></div>');
    }
  }
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: 'Analisis Konten Digital ' + seed,
    description: sentence(random, 12),
    author: { '@type': 'Organization', name: 'Contoh Berita' },
    datePublished: '2026-09-15T08:00:00Z',
    publisher: { '@type': 'Organization', name: 'Contoh Berita' }
  });
  return [
    '<!doctype html>',
    '<html lang="id-ID"><head><meta charset="utf-8">',
    '<title>Analisis Konten Digital ' + seed + ' - Contoh Berita</title>',
    '<meta name="description" content="' + sentence(random, 10) + '">',
    '<link rel="canonical" href="https://bench.example/artikel/' + seed + '">',
    '<link rel="stylesheet" href="/assets/main.css?v=42">',
    '<link rel="stylesheet" href="/assets/ads.css">',
    '<script type="application/ld+json">' + jsonLd + '</script>',
    '<script src="/assets/tracker.js"></script>',
    '<script src="/assets/ads.js" async></script>',
    '<style>.ad{display:block;margin:12px 0}.nav{color:#333}.comment{border-top:1px solid #eee}.related-card{padding:8px}</style>',
    '</head><body>',
    '<header class="site-header"><div class="brand"><a href="/">Contoh Berita</a></div><nav><ul>' + navLinks.join('') + '</ul></nav>',
    '<nav class="breadcrumb"><ol><li><a href="/">Beranda</a></li><li><a href="/analisis">Analisis</a></li><li>Konten Digital ' + seed + '</li></ol></nav></header>',
    '<div class="ad leaderboard">Iklan banner 728x90 - beli sekarang</div>',
    '<main class="layout"><article class="post">' + body.join('\n') + '</article>',
    '<aside class="sidebar"><h2>Terpopuler</h2><ul>' + sidebar.join('') + '</ul>',
    '<div class="ad sidebar-ad">Iklan 300x250</div></aside></main>',
    '<section class="related"><h2>Artikel Terkait</h2>' + related.join('\n') + '</section>',
    '<section class="comments"><h2>Komentar (' + comments.length + ')</h2><ul>' + comments.join('\n') + '</ul></section>',
    '<footer class="site-footer"><p>Copyright Contoh Berita. Kebijakan privasi. Syarat layanan. Kontak redaksi. Pedoman media siber. RSS. Newsletter.</p></footer>',
    '<script>window.tracker = {init: function() { return 1; }}; window.ads = {load: function() { return []; }};</script>',
    '</body></html>'
  ].join('\n');
}

function estimateTokens(bytes) {
  return Math.ceil(bytes / 4);
}

function buildCorpus(pages) {
  const corpus = [];
  for (let i = 1; i <= pages; i++) {
    const html = buildHtml(i);
    const converted = makoHtmlLib.htmlToMako(html, {
      canonical: 'https://bench.example/artikel/' + i,
      language: 'id',
      updated: '2026-09-15'
    });
    corpus.push({
      id: i,
      html,
      mako: converted.text,
      tokens: converted.frontmatter.tokens
    });
  }
  return corpus;
}

function buildIndex(corpus, baseUrl) {
  const entries = corpus.map((page) => {
    const body = Buffer.from(page.mako, 'utf8');
    const digest = sha256Base64(body);
    return {
      url: '/artikel/' + page.id,
      type: 'article',
      tokens: page.tokens,
      updated: '2026-09-15',
      etag: '"mako-' + digest.slice(0, 22).replace(/[+/=]/g, '') + '"',
      'sha-256': digest
    };
  });
  return {
    version: '0.2',
    domain: 'bench.example',
    generated_at: '2026-09-15T08:00:00Z',
    page: 1,
    page_count: 1,
    entries
  };
}

function simulateChange(corpus, ratio) {
  const count = Math.max(1, Math.round(corpus.length * ratio));
  const changed = [];
  for (let i = 0; i < count; i++) {
    const page = corpus[i * 7 % corpus.length];
    page.mako = page.mako.trimEnd() + '\n\nPembaruan: ' + i + '.\n';
    changed.push(page);
  }
  return changed;
}

function runBenchmark(options = {}) {
  const pages = options.pages ?? DEFAULT_PAGES;
  const corpus = buildCorpus(pages);
  const keyPair = cryptoLib.generateKeyPair();
  const publicKey = keyPair.publicKey;

  const results = {
    corpus: {
      pages: corpus.length,
      html_bytes: 0,
      mako_bytes: 0,
      signature_bytes: 0,
      html_tokens_est: 0,
      mako_tokens_est: 0
    },
    scenarios: {},
    methodology: {}
  };

  const verifyTimes = [];
  const signTimes = [];
  const containers = new Map();
  for (const page of corpus) {
    const bytes = Buffer.from(page.mako, 'utf8');
    results.corpus.html_bytes += Buffer.byteLength(page.html, 'utf8');
    results.corpus.mako_bytes += bytes.length;
    results.corpus.html_tokens_est += estimateTokens(Buffer.byteLength(page.html, 'utf8'));
    results.corpus.mako_tokens_est += estimateTokens(bytes.length);

    let start = process.hrtime.bigint();
    const container = makoLib.signMakoContainer(keyPair.privateKey, 'https://bench.example/artikel/' + page.id, bytes, {
      signedAt: '2026-09-15T08:00:00Z'
    });
    signTimes.push(Number(process.hrtime.bigint() - start) / 1e6);
    const containerBytes = Buffer.byteLength(JSON.stringify(container), 'utf8');
    results.corpus.signature_bytes += containerBytes;
    containers.set(page.id, container);

    start = process.hrtime.bigint();
    const verified = makoLib.verifyMakoContainer({
      containerText: JSON.stringify(container),
      pageUrl: 'https://bench.example/artikel/' + page.id,
      bodyBytes: bytes,
      publicKey
    });
    verifyTimes.push(Number(process.hrtime.bigint() - start) / 1e6);
    if (!verified.ok) throw new Error('benchmark self-check failed for page ' + page.id);
  }

  // Scenario A: crawl full HTML once.
  let start = process.hrtime.bigint();
  let bytesA = 0;
  for (const page of corpus) {
    bytesA += Buffer.byteLength(page.html, 'utf8');
  }
  const wallA = Number(process.hrtime.bigint() - start) / 1e6;
  results.scenarios['A_html_crawl'] = {
    requests: corpus.length,
    bytes: bytesA,
    tokens_est: estimateTokens(bytesA),
    verify_cpu_ms: 0,
    wall_ms: wallA
  };

  // Scenario B: fetch MAKO for all pages with inline signature (no sidecar request).
  start = process.hrtime.bigint();
  let bytesB = 0;
  let verifyCpuB = 0;
  for (const page of corpus) {
    const bytes = Buffer.from(page.mako, 'utf8');
    const container = containers.get(page.id);
    const containerBytes = Buffer.byteLength(JSON.stringify(container), 'utf8');
    bytesB += bytes.length + containerBytes;
    const t0 = process.hrtime.bigint();
    const verified = makoLib.verifyMakoContainer({
      containerText: JSON.stringify(container),
      pageUrl: 'https://bench.example/artikel/' + page.id,
      bodyBytes: bytes,
      publicKey
    });
    verifyCpuB += Number(process.hrtime.bigint() - t0) / 1e6;
    if (!verified.ok) throw new Error('scenario B verify failed for page ' + page.id);
  }
  const wallB = Number(process.hrtime.bigint() - start) / 1e6;
  results.scenarios['B_mako_full'] = {
    requests: corpus.length,
    bytes: bytesB,
    tokens_est: estimateTokens(bytesB),
    verify_cpu_ms: verifyCpuB,
    wall_ms: wallB
  };

  // Scenario C: delta consumption - index + only changed pages, unchanged return 304 (0 bytes).
  const changed = simulateChange(corpus, options.changeRatio ?? CHANGE_RATIO);
  const changedIds = new Set(changed.map((page) => page.id));
  const storedDigests = {};
  for (const page of corpus) {
    const digest = sha256Base64(Buffer.from(page.mako, 'utf8'));
    if (!changedIds.has(page.id)) storedDigests['/artikel/' + page.id] = digest;
  }
  const freshIndex = buildIndex(corpus, 'https://bench.example');
  const indexBytes = Buffer.byteLength(JSON.stringify(freshIndex, null, 2) + '\n', 'utf8');
  start = process.hrtime.bigint();
  const changedEntries = freshIndex.entries.filter((entry) => storedDigests[entry.url] !== entry['sha-256']);
  let bytesC = indexBytes;
  let verifyCpuC = 0;
  const changedSet = new Set(changedEntries.map((entry) => entry.url));
  for (const page of corpus) {
    if (!changedSet.has('/artikel/' + page.id)) continue;
    const bytes = Buffer.from(page.mako, 'utf8');
    const container = makoLib.signMakoContainer(keyPair.privateKey, 'https://bench.example/artikel/' + page.id, bytes, {
      signedAt: '2026-09-15T08:00:00Z'
    });
    bytesC += bytes.length + Buffer.byteLength(JSON.stringify(container), 'utf8');
    const t0 = process.hrtime.bigint();
    const verified = makoLib.verifyMakoContainer({
      containerText: JSON.stringify(container),
      pageUrl: 'https://bench.example/artikel/' + page.id,
      bodyBytes: bytes,
      publicKey
    });
    verifyCpuC += Number(process.hrtime.bigint() - t0) / 1e6;
    if (!verified.ok) throw new Error('scenario C verify failed for page ' + page.id);
  }
  const wallC = Number(process.hrtime.bigint() - start) / 1e6;
  results.scenarios['C_mako_delta'] = {
    requests: 1 + changedEntries.length,
    bytes: bytesC,
    tokens_est: estimateTokens(bytesC),
    verify_cpu_ms: verifyCpuC,
    wall_ms: wallC,
    changed_pages: changedEntries.length,
    unchanged_pages: corpus.length - changedEntries.length
  };

  // Aggregates and comparisons.
  const totalVerify = verifyTimes.reduce((sum, value) => sum + value, 0);
  results.methodology = {
    html_corpus: 'synthetic article pages with nav/ads/boilerplate (see buildHtml)',
    token_estimate: 'ceil(bytes / 4), identical heuristic for both representations',
    signature_model: 'inline header delivery (X-Aifeed-Signature), JSON container bytes counted',
    delta_model: 'index fetch + changed pages only; unchanged pages assumed 304 (0 bytes)',
    change_ratio: options.changeRatio ?? CHANGE_RATIO,
    sign_ms_per_page: Number((signTimes.reduce((sum, v) => sum + v, 0) / signTimes.length).toFixed(4)),
    verify_ms_per_page: Number((totalVerify / verifyTimes.length).toFixed(4))
  };
  results.savings = {
    mako_vs_html_percent: Number((100 * (1 - results.scenarios.B_mako_full.bytes / results.scenarios.A_html_crawl.bytes)).toFixed(2)),
    delta_vs_html_percent: Number((100 * (1 - results.scenarios.C_mako_delta.bytes / results.scenarios.A_html_crawl.bytes)).toFixed(2)),
    delta_vs_mako_percent: Number((100 * (1 - results.scenarios.C_mako_delta.bytes / results.scenarios.B_mako_full.bytes)).toFixed(2))
  };

  return results;
}

function renderReport(results) {
  const a = results.scenarios.A_html_crawl;
  const b = results.scenarios.B_mako_full;
  const c = results.scenarios.C_mako_delta;
  const kb = (value) => (value / 1024).toFixed(1);
  return [
    '# Benchmark: HTML vs MAKO vs Delta (AIFeed v0.2)',
    '',
    'Generated by `node tools/bench-mako.js` — reproducible with a fixed corpus and seed.',
    '',
    '## Results',
    '',
    '| Scenario | Requests | Bytes | KiB | Tokens (est.) | Verify CPU (ms) | Wall (ms) |',
    '|---|---:|---:|---:|---:|---:|---:|',
    '| A. Full HTML crawl | ' + a.requests + ' | ' + a.bytes + ' | ' + kb(a.bytes) + ' | ' + a.tokens_est + ' | 0 | ' + a.wall_ms.toFixed(1) + ' |',
    '| B. Full MAKO (signed) | ' + b.requests + ' | ' + b.bytes + ' | ' + kb(b.bytes) + ' | ' + b.tokens_est + ' | ' + b.verify_cpu_ms.toFixed(1) + ' | ' + b.wall_ms.toFixed(1) + ' |',
    '| C. Delta MAKO (' + c.changed_pages + '/' + (c.changed_pages + c.unchanged_pages) + ' changed) | ' + c.requests + ' | ' + c.bytes + ' | ' + kb(c.bytes) + ' | ' + c.tokens_est + ' | ' + c.verify_cpu_ms.toFixed(1) + ' | ' + c.wall_ms.toFixed(1) + ' |',
    '',
    '| Comparison | Reduction |',
    '|---|---:|',
    '| MAKO vs HTML | ' + results.savings.mako_vs_html_percent + '% |',
    '| Delta vs HTML | ' + results.savings.delta_vs_html_percent + '% |',
    '| Delta vs full MAKO | ' + results.savings.delta_vs_mako_percent + '% |',
    '',
    'Corpus: ' + results.corpus.pages + ' pages, HTML ' + kb(results.corpus.html_bytes) + ' KiB, MAKO ' +
      kb(results.corpus.mako_bytes) + ' KiB, signatures ' + kb(results.corpus.signature_bytes) + ' KiB total.',
    'Per page: sign ' + results.methodology.sign_ms_per_page + ' ms, verify ' + results.methodology.verify_ms_per_page + ' ms.',
    '',
    '## Methodology',
    '',
    '- Synthetic article corpus (' + results.corpus.pages + ' pages) with navigation, ads, sidebar, and footer to model real news pages; content generated deterministically.',
    '- MAKO documents produced by the AIFeed HTML to MAKO converter (`lib/mako-html.js`), then signed with Ed25519 via the v0.2 MAKO container.',
    '- Token estimate: `ceil(bytes / 4)` applied identically to both representations; HTML tokens are largely markup noise, which is exactly what MAKO removes.',
    '- Signature overhead counts the full JSON container as delivered inline (no extra request).',
    '- Delta model: 1 index request + only changed pages; unchanged pages assumed `304 Not Modified` (0 bytes). Change ratio: ' + results.methodology.change_ratio + '.',
    '- Measurements are in-process (no network latency); they isolate payload bytes and cryptographic CPU cost.',
    '',
    '## Caveats',
    '',
    '- Synthetic corpus: absolute percentages depend on boilerplate ratio; sites without heavy navigation/ads will show smaller gains.',
    '- Token estimates are heuristic; real tokenizer counts differ by model.',
    '- The MAKO specification claims up to 94% reduction per page. This benchmark measures ' + results.savings.mako_vs_html_percent + '% byte reduction for faithful conversion on this corpus; the remaining gap corresponds to semantic optimization (summaries, fact extraction), which is a publisher choice and is not performed automatically by the AIFeed converter.',
    '- Delta consumption reaches ' + results.savings.delta_vs_html_percent + '% versus re-crawling HTML, confirming that the delta index dominates steady-state savings.',
    '- Verification CPU is measured on this machine and scales with page count, not payload size.',
    ''
  ].join('\n');
}

function main() {
  const results = runBenchmark({});
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'mako-benchmark.json'), JSON.stringify(results, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT_DIR, 'mako-report.md'), renderReport(results), 'utf8');
  process.stdout.write('benchmark written: benchmarks/mako-report.md\n');
  process.stdout.write(
    'MAKO vs HTML: ' + results.savings.mako_vs_html_percent + '% | Delta vs HTML: ' +
    results.savings.delta_vs_html_percent + '% | Delta vs MAKO: ' + results.savings.delta_vs_mako_percent + '%\n'
  );
}

module.exports = { runBenchmark, renderReport, buildCorpus, buildHtml };

if (require.main === module) {
  main();
}
