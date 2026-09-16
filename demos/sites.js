'use strict';

// Demo origin content. tools/gen-demos.js renders these pages to HTML, then
// lib/site.buildSite() turns the same HTML into signed AIFeed Markdown / MAKO,
// the manifest, the delta index, and the site resume. Demo signing keys live in
// demos/keys.js and are intentionally public.

module.exports = [
  {
    sub: 'demo',
    domain: 'demo.aifeed.md',
    name: 'AIFeed Showcase',
    type: 'docs',
    locale: 'en',
    theme: { accent: '#f55036', accent2: '#ff8f6b' },
    mode: 'dark',
    fonts: "'Inter',-apple-system,'Segoe UI',Roboto,sans-serif",
    headFonts: "'Space Grotesk','Inter',sans-serif",
    mono: "'JetBrains Mono',ui-monospace,Consolas,monospace",
    fontCss: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap',
    menuGroups: [
      ['groupServices', [
        { href: '/docs/', en: 'Documentation', id: 'Dokumentasi', desc: 'Overview, CLI, and SDKs' },
        { href: '/blog/', en: 'Blog', id: 'Blog', desc: 'Short notes on the protocol' },
        { href: '/status/', en: 'Service status', id: 'Status layanan', desc: 'Endpoints and incidents' }
      ]],
      ['groupInfo', [
        { href: '/about/', en: 'About this demo', id: 'Tentang demo ini', desc: 'Keys, build, and scope' },
        { href: '/changelog/', en: 'Changelog', id: 'Changelog', desc: 'Release history' }
      ]]
    ],
    tagline: 'AIFeed reference demonstration',
    topContact: 'contact@aifeed.md · Berlin · Jakarta',
    search: true,
    ctaLabel: 'Read the docs',
    ctaHref: '/docs/',
    about: 'A complete publisher origin: signed manifest, dual-stack markdown, delta index, and revocation.',
    nav: [['/', 'Home', 'Beranda'], ['/about/', 'About', 'Tentang'], ['/docs/', 'Docs', 'Dokumentasi'], ['/blog/', 'Blog', 'Blog'], ['/status/', 'Status', 'Status'], ['/changelog/', 'Changelog', 'Changelog']],
    subnav: [['/docs/', 'Overview', 'Ringkasan'], ['/docs/cli/', 'CLI', 'CLI'], ['/docs/sdks/', 'SDKs', 'SDK'], ['/status/', 'Service status', 'Status layanan'], ['/changelog/', 'Releases', 'Rilis']],
    footerCols: [
      ['docs', [['/docs/', 'Overview'], ['/docs/cli/', 'CLI reference'], ['/docs/sdks/', 'SDKs']]],
      ['project', [['/about/', 'About'], ['/blog/', 'Blog'], ['/changelog/', 'Changelog']]],
      ['protocol', [['/.well-known/ai.json', 'Manifest'], ['/.well-known/aifeed-index.json', 'Delta index'], ['/llms.txt', 'llms.txt']]]
    ],
    newsletterTitle: 'newsletterFollow',
    newsletterText: 'Release notes and protocol changes, once a month. Static demo: the form does not submit.',
    pages: [
      {
        path: '/', title: 'AIFeed Showcase — a publisher that signs what it allows',
        summary: 'A complete demo origin: signed manifest, dual-stack markdown, delta index, and revocation.',
        titleId: 'AIFeed Showcase — penerbit yang menandatangani izinnya',
        summaryId: 'Origin demo lengkap: manifest bertanda tangan, markdown dual-stack, indeks delta, dan revokasi.',
        kind: 'home', art: { name: 'hero-home', kind: 'hero', caption: 'Every page on this origin is served twice: HTML for people, signed markdown for agents.' },
        stats: [['68.83%', 'fewer bytes vs HTML'], ['95.73%', 'saved by delta fetching'], ['0.70 ms', 'signature verification per page'], ['75', 'conformance vectors']],
        body: `
<section class="hero">
  <p class="eyebrow">demo.aifeed.md · live demonstration</p>
  <h1>This site practices what AIFeed preaches</h1>
  <p class="lede">Every page is published twice: polished HTML for readers, and signed, agent-ready markdown
  for machines. Permissions are Ed25519-signed, pinned to the domain through DNS, and revocable.</p>
  <p><a class="btn" href="https://verify.aifeed.md/?url=https%3A%2F%2Fdemo.aifeed.md">Verify this site in the browser</a>
  <a class="btn ghost" href="/docs/">Run it from the CLI</a></p>
  <div class="trust"><span>Ed25519 + JCS</span><span>DNS anchor <code>_aifeed</code></span><span>Multi-signature revocation</span><span>Zero dependencies</span></div>
</section>
<section class="block">
  <h2>What this origin declares</h2>
  <table class="table striped">
    <thead><tr><th>Use</th><th>Decision</th><th>Why</th></tr></thead>
    <tbody>
      <tr><td>search, retrieval, input</td><td><span class="tag ok">allow</span></td><td>Fetching and grounding is welcome.</td></tr>
      <tr><td>quote, summarize</td><td><span class="tag ok">allow</span></td><td>Attribution is required.</td></tr>
      <tr><td>training</td><td><span class="tag no">deny</span></td><td>Model training is not permitted.</td></tr>
      <tr><td>modify, embed, commercial_use</td><td><span class="tag no">deny</span></td><td>Derivative and resale uses are not.</td></tr>
    </tbody>
  </table>
</section>
<section class="block">
  <h2>Built for agents that check before they fetch</h2>
  <div class="grid">
    <div class="card"><div class="body"><h3>Signed manifest</h3><p>A single <code>/.well-known/ai.json</code> with per-use permissions, limits, and a revocation pointer.</p></div></div>
    <div class="card"><div class="body"><h3>Dual-stack content</h3><p>The same bytes under <code>text/aifeed+markdown</code> and <code>text/mako+markdown</code>, separate signature contexts.</p></div></div>
    <div class="card"><div class="body"><h3>Delta index</h3><p>Per-page digests and triage fields so agents skip what did not change.</p></div></div>
    <div class="card"><div class="body"><h3>Revocation</h3><p>Status documents signed by two governance keys; bounded staleness rules.</p></div></div>
  </div>
</section>
<section class="block">
  <h2>Endpoints robots should read first</h2>
  <table class="table">
    <thead><tr><th>Path</th><th>Method</th><th>Expected</th><th>Content type</th></tr></thead>
    <tbody>
      <tr><td><code>/.well-known/ai.json</code></td><td>GET</td><td>200</td><td>application/json</td></tr>
      <tr><td><code>/.well-known/ai-signature.json</code></td><td>GET</td><td>200</td><td>application/json</td></tr>
      <tr><td><code>/.well-known/aifeed-index.json</code></td><td>GET</td><td>200</td><td>application/json</td></tr>
      <tr><td>any page with <code>Accept: text/aifeed+markdown</code></td><td>GET</td><td>200</td><td>text/aifeed+markdown</td></tr>
      <tr><td><code>/llms.txt</code></td><td>GET</td><td>200</td><td>text/plain</td></tr>
    </tbody>
  </table>
</section>
<section class="block">
  <h2>Fetch it in one command</h2>
  <pre><code>node examples/agent/compliant-agent.js https://demo.aifeed.md --use retrieval --fetch</code></pre>
  <p style="color:var(--muted)">The agent discovers the manifest, verifies the chain, checks permissions, and only then reads signed content.</p>
</section>
<div class="banner"><strong>See refusal and revocation in action</strong><small><a href="https://strict.aifeed.md">strict.aifeed.md</a> enforces a search-only policy with live 403/429 responses. <a href="https://revoked.aifeed.md">revoked.aifeed.md</a> demonstrates a suspended registry entry.</small></div>
<section class="block">
  <h2>The other demo origins</h2>
  <div class="grid four">
    <a class="card" href="https://news.aifeed.md"><div class="body"><h3>Newsroom</h3><p>Triage metadata and EN/ID alternates.</p></div></a>
    <a class="card" href="https://shop.aifeed.md"><div class="body"><h3>Storefront</h3><p>Catalog, media assets, commercial-use denial.</p></div></a>
    <a class="card" href="https://gov.aifeed.md"><div class="body"><h3>Public portal</h3><p>Open reproduction, optional attribution.</p></div></a>
    <a class="card" href="https://verify.aifeed.md"><div class="body"><h3>Verifier</h3><p>Check any origin in your browser.</p></div></a>
  </div>
</section>`
      },
      {
        path: '/about/', title: 'About this demo',
        summary: 'How the demo is generated, what the keys mean, and what is intentionally public.',
        titleId: 'Tentang demo ini',
        summaryId: 'Bagaimana demo dibangun, apa arti kuncinya, dan apa yang sengaja publik.',
        kind: 'page', crumbs: ['About'],
        aside: ['<div class="toc"><h4>Quick facts</h4><a href="/docs/">Docs</a><a href="/status/">Status</a><a href="/changelog/">Changelog</a></div>'],
        body: `
<h1>About this demo</h1>
<p class="lede">This origin is regenerated deterministically from the AIFeed repository on every deploy. Nothing here is hand-signed in a browser and nothing is hidden.</p>
<section class="block">
  <h2>Keys are public on purpose</h2>
  <p>The demo signing keys live in the repository under <code>demos/keys.js</code>, labelled DEMO ONLY. They exist so the build and the DNS anchor are reproducible. A real publisher generates keys privately; the protocol never requires sharing them.</p>
</section>
<section class="block">
  <h2>How the demo runs</h2>
  <div class="timeline">
    <div class="step"><b>demos/sites.js</b><span>Content model: pages, policies, navigation, themes.</span></div>
    <div class="step"><b>tools/gen-demos.js</b><span>Renders HTML, generates SVG art, then signs manifest, pages, and index.</span></div>
    <div class="step"><b>functions/[[path]].js</b><span>Cloudflare Pages Function routes hosts, negotiates markdown, enforces strict.</span></div>
    <div class="step"><b>tools/check-live.js</b><span>Verifies every deployed origin end to end.</span></div>
  </div>
</section>
<section class="block">
  <h2>What is signed</h2>
  <ul class="list">
    <li>The manifest: JCS-canonical JSON, Ed25519, domain separation <code>aifeed.v0.2\\n</code>.</li>
    <li>Each page document: the signature covers the canonical URL and the raw bytes.</li>
    <li>The delta index: same treatment with its own context.</li>
  </ul>
</section>
<div class="note">Point an agent at this site: <code>node examples/agent/compliant-agent.js https://demo.aifeed.md --use retrieval --fetch</code></div>`
      },
      {
        path: '/docs/', title: 'Docs — consume this site in three ways',
        summary: 'CLI, SDK, and raw curl recipes for the demo origin, with the full verification chain.',
        titleId: 'Dokumentasi — konsumsi situs ini dalam tiga cara',
        summaryId: 'Resep CLI, SDK, dan curl mentah untuk origin demo, dengan rantai verifikasi lengkap.',
        kind: 'docs', crumbs: ['Docs'],
        toc: [['cli', 'Compliant agent'], ['sdk', 'SDK'], ['curl', 'Raw HTTP'], ['chain', 'Verification chain']],
        aside: ['<div class="toc"><h4>Docs</h4><a href="/docs/">Overview</a><a href="/docs/cli/">CLI reference</a><a href="/docs/sdks/">SDKs</a></div>'],
        body: `
<h1>Consume this site in three ways</h1>
<p class="lede">Every path below ends at the same place: a verified decision about what this origin allows.</p>
<section class="block" id="cli">
  <h2>1. The compliant agent example</h2>
  <pre><code>git clone https://github.com/denyn1/aifeed-protocol
cd aifeed-protocol
node examples/agent/compliant-agent.js https://demo.aifeed.md --use retrieval --fetch</code></pre>
  <p style="color:var(--muted)">Exit code 0 means verified; 1 means unverified or denied.</p>
</section>
<section class="block" id="sdk">
  <h2>2. The SDK</h2>
  <pre><code>npm install @aifeed/verify
const sdk = require('@aifeed/verify');
const base = 'https://demo.aifeed.md/.well-known/';
const manifest = await sdk.fetchText(base + 'ai.json');
const signature = await sdk.fetchText(base + 'ai-signature.json');
const out = sdk.verifyAll({ manifestText: manifest.text, manifestBytes: manifest.buffer,
  signatureText: signature.text, domain: 'demo.aifeed.md' });
console.log(out.result);</code></pre>
</section>
<section class="block" id="curl">
  <h2>3. Raw HTTP with content negotiation</h2>
  <pre><code>curl -H 'Accept: text/aifeed+markdown' https://demo.aifeed.md/ | head -40
curl -H 'Accept: text/mako+markdown'  https://demo.aifeed.md/ | head -40
curl https://demo.aifeed.md/.well-known/aifeed-index.json | head -30</code></pre>
</section>
<section class="block" id="chain">
  <h2>The verification chain</h2>
  <ol class="flow-v">
    <li>TLS and domain match: the manifest's <code>identity.domain</code> equals the host.</li>
    <li>Ed25519 over JCS-canonical bytes with the <code>aifeed.v0.2</code> separation.</li>
    <li>Optional DNS anchor: <code>_aifeed.demo.aifeed.md</code> carries the same public key.</li>
    <li>Permission decisions read from the signed permissions table.</li>
    <li>Revocation re-check before restricted uses.</li>
  </ol>
</section>`
      },
      {
        path: '/docs/cli/', title: 'CLI reference',
        summary: 'Every command in the reference CLI, with the flags that matter for publishers and agents.',
        titleId: 'Referensi CLI',
        summaryId: 'Setiap perintah di CLI referensi, dengan flag penting untuk penerbit dan agen.',
        kind: 'docs', crumbs: ['Docs', 'CLI reference'],
        toc: [['publish', 'Publishing'], ['inspect', 'Inspecting'], ['serve', 'Serving']],
        aside: ['<div class="toc"><h4>Docs</h4><a href="/docs/">Overview</a><a href="/docs/cli/">CLI reference</a><a href="/docs/sdks/">SDKs</a></div>'],
        body: `
<h1>CLI reference</h1>
<table class="table striped">
  <thead><tr><th>Command</th><th>Purpose</th><th>Key flags</th></tr></thead>
  <tbody>
    <tr><td><code>aifeed keygen</code></td><td>Generate an Ed25519 key pair</td><td><code>--out</code>, <code>--force</code></td></tr>
    <tr><td><code>aifeed sign</code></td><td>Sign a manifest</td><td><code>--key</code>, <code>--out</code></td></tr>
    <tr><td><code>aifeed validate</code></td><td>Validate a live origin</td><td>URL argument</td></tr>
    <tr><td><code>aifeed site build</code></td><td>Generate signed content for any static site</td><td><code>--domain</code>, <code>--key</code>, <code>--profile</code></td></tr>
    <tr><td><code>aifeed mako fetch</code></td><td>Fetch and verify signed content</td><td><code>--format</code>, <code>--key</code></td></tr>
    <tr><td><code>aifeed bundle create</code></td><td>Offline audit bundle</td><td><code>--domain</code>, <code>--key</code></td></tr>
  </tbody>
</table>
<section class="block" id="publish">
  <h2>Publishing</h2>
  <pre><code>aifeed keygen --out keys/
aifeed site build ./public --domain example.com --key keys/aifeed-private.pem</code></pre>
</section>
<section class="block" id="inspect">
  <h2>Inspecting</h2>
  <pre><code>aifeed validate https://demo.aifeed.md
aifeed mako fetch https://demo.aifeed.md --format both --json</code></pre>
</section>
<div class="note">Exit codes are stable across commands: <code>0</code> verified, <code>1</code> unverified or suspended, <code>2</code> usage error. Scripts can rely on them.</div>`
      },
      {
        path: '/docs/sdks/', title: 'SDKs and libraries',
        summary: 'The JavaScript SDK, the independent Python verifier, and the WordPress publisher.',
        titleId: 'SDK dan pustaka',
        summaryId: 'SDK JavaScript, verifier Python independen, dan plugin penerbit WordPress.',
        kind: 'docs', crumbs: ['Docs', 'SDKs'],
        aside: ['<div class="toc"><h4>Docs</h4><a href="/docs/">Overview</a><a href="/docs/cli/">CLI reference</a><a href="/docs/sdks/">SDKs</a></div>'],
        body: `
<h1>SDKs and libraries</h1>
<table class="table striped">
  <thead><tr><th>Package</th><th>Language</th><th>Role</th><th>Install</th></tr></thead>
  <tbody>
    <tr><td><code>@aifeed/verify</code></td><td>JavaScript</td><td>Client verification + content fetch</td><td><code>npm install @aifeed/verify</code></td></tr>
    <tr><td><code>clients/python</code></td><td>Python</td><td>Independent verifier (differential)</td><td>repository</td></tr>
    <tr><td><code>wp-plugin</code></td><td>PHP</td><td>Publisher plugin for WordPress</td><td>repository</td></tr>
  </tbody>
</table>
<section class="block">
  <h2>Client API at a glance</h2>
  <pre><code>sdk.verifyAll({ manifestText, manifestBytes, signatureText, domain })
sdk.fetchAimd(url, { publicKeyValue })    // text/aifeed+markdown
sdk.fetchMako(url, { publicKeyValue })    // text/mako+markdown
sdk.fetchIndexDelta(indexUrl, { storedDigests })
sdk.selectEntries(entries, { query, maxTokens })
sdk.decideUsage(manifest.permissions, 'training')</code></pre>
</section>
<div class="note">The Python verifier passes the same 75 vectors as the JavaScript implementation; that cross-language parity is the acceptance test for every change.</div>`
      },
      {
        path: '/blog/', title: 'Blog',
        summary: 'Short notes on what the protocol actually buys you.',
        titleId: 'Blog',
        summaryId: 'Catatan singkat tentang manfaat nyata protokol ini.',
        kind: 'listing', crumbs: ['Blog'],
        aside: [
          '<div class="toc"><h4>Popular</h4><a href="/blog/why-signed-permissions/">Why signed permissions</a><a href="/blog/delta-indexes/">Delta indexes</a><a href="/blog/revocation/">Revocation with receipts</a></div>',
          '<div class="toc"><h4>Tags</h4><p><span class="tag">protocol</span> <span class="tag">crypto</span> <span class="tag">performance</span></p></div>'
        ],
        body: `
<h1>Blog</h1>
<p class="lede">Three short posts on what the protocol actually buys you.</p>
<div class="filters"><a class="active" href="/blog/">All</a><a href="/blog/">Protocol</a><a href="/blog/">Crypto</a><a href="/blog/">Performance</a></div>
<div class="grid two">
  <a class="card" href="/blog/why-signed-permissions/"><div class="thumb"><span class="badge">protocol</span><img src="/assets/blog-signed.svg" alt=""></div><div class="body"><h3>Why signed permissions beat polite text</h3><p>robots.txt carries no evidence. A signature does.</p><p class="tags"><span class="tag">6 min</span><span class="tag">protocol</span></p></div></a>
  <a class="card" href="/blog/delta-indexes/"><div class="thumb"><span class="badge">performance</span><img src="/assets/blog-delta.svg" alt=""></div><div class="body"><h3>Delta indexes: skipping what did not change</h3><p>Per-page digests turn re-crawls into near-zero traffic.</p><p class="tags"><span class="tag">5 min</span><span class="tag">performance</span></p></div></a>
  <a class="card" href="/blog/revocation/"><div class="thumb"><span class="badge">crypto</span><img src="/assets/blog-revocation.svg" alt=""></div><div class="body"><h3>Revocation with receipts</h3><p>Multi-signature documents and bounded staleness.</p><p class="tags"><span class="tag">7 min</span><span class="tag">crypto</span></p></div></a>
</div>
<div class="pager"><span class="active">1</span><span>2</span><span>3</span><a href="/blog/">Next →</a></div>`
      },
      {
        path: '/blog/why-signed-permissions/', title: 'Why signed permissions beat polite text',
        summary: 'Attribution, revocation, and the difference between a request and a proof.',
        titleId: 'Mengapa izin bertanda tangan mengalahkan teks sopan',
        summaryId: 'Atribusi, revokasi, dan perbedaan antara permintaan dan bukti.',
        kind: 'article', crumbs: ['Blog', 'Why signed permissions'], crumbsHrefs: ['/blog/'],
        art: { name: 'blog-signed', kind: 'wide', caption: 'A signature turns a preference into a claim that travels with evidence.' },
        aside: ['<div class="toc"><h4>Related</h4><a href="/blog/delta-indexes/">Delta indexes</a><a href="/blog/revocation/">Revocation</a></div>'],
        body: `
<p class="meta"><span>By the AIFeed team</span><span>September 2026</span><span>6 min read</span><span class="tag info">protocol</span></p>
<p class="lede">An unsigned preference file is a note on the door. Anyone can replace it, and nobody can tell.</p>
<p>AIFeed turns the note into a claim that travels with evidence. The manifest is canonicalized with JCS, signed with Ed25519, and pinned to the domain through a DNS record. An agent that verifies the chain knows three things at once: who said it, for which domain, and whether the statement is still current.</p>
<blockquote>That matters for the boring cases first. When a crawler sees training: deny, the question is not what the file says but whether it was forged.</blockquote>
<p>The same machinery makes revocation real. A permission that cannot be withdrawn is not a permission, it is a hope. Status documents are signed by governance keys, checked on use, and bounded in staleness so silence is treated as unknown rather than approval.</p>
<div class="author"><img src="/assets/avatar-team.svg" alt=""><div><b>AIFeed Protocol Contributors</b><span>Reference implementation and specifications</span></div></div>
<ul class="related"><li><a href="/blog/delta-indexes/">Delta indexes: skipping what did not change</a></li><li><a href="/blog/revocation/">Revocation with receipts</a></li></ul>`
      },
      {
        path: '/blog/delta-indexes/', title: 'Delta indexes: skipping what did not change',
        summary: 'How per-page digests cut re-crawl traffic to near zero.',
        titleId: 'Indeks delta: melewati yang tidak berubah',
        summaryId: 'Bagaimana digest per halaman memangkas lalu lintas crawl ulang hampir ke nol.',
        kind: 'article', crumbs: ['Blog', 'Delta indexes'], crumbsHrefs: ['/blog/'],
        art: { name: 'blog-delta', kind: 'wide', caption: 'The index tells an agent what actually moved; the rest costs zero bytes.' },
        aside: ['<div class="toc"><h4>Related</h4><a href="/blog/why-signed-permissions/">Signed permissions</a><a href="/blog/revocation/">Revocation</a></div>'],
        body: `
<p class="meta"><span>By the AIFeed team</span><span>September 2026</span><span>5 min read</span><span class="tag info">performance</span></p>
<p class="lede">Most re-crawl bytes buy nothing. The signed index tells the agent what moved.</p>
<p>The index lists every page with a SHA-256 digest, an ETag, token counts, and triage fields. An agent that stored digests from its last visit compares them locally and fetches only the pages whose digests changed.</p>
<table class="table"><thead><tr><th>Scenario</th><th>Bytes transferred</th><th>vs HTML crawl</th></tr></thead><tbody>
  <tr><td>Full HTML crawl</td><td>1,205,292</td><td>baseline</td></tr>
  <tr><td>Markdown conversion</td><td>375,630</td><td><span class="tag ok">−68.83%</span></td></tr>
  <tr><td>Delta consumption</td><td>51,408</td><td><span class="tag ok">−95.73%</span></td></tr>
</tbody></table>
<p>On the repository's 60-page corpus those are the measured numbers. The index itself is small, signed, and cacheable, so the saving survives retries.</p>
<ul class="related"><li><a href="/blog/why-signed-permissions/">Why signed permissions beat polite text</a></li></ul>`
      },
      {
        path: '/blog/revocation/', title: 'Revocation with receipts',
        summary: 'Multi-signature status documents, bounded staleness, and offline bundles.',
        titleId: 'Revokasi dengan bukti',
        summaryId: 'Dokumen status multi-tanda tangan, batas kedaluwarsa, dan bundle offline.',
        kind: 'article', crumbs: ['Blog', 'Revocation'], crumbsHrefs: ['/blog/'],
        art: { name: 'blog-revocation', kind: 'wide', caption: 'Two governance keys must agree before status changes take effect.' },
        aside: ['<div class="toc"><h4>Related</h4><a href="/blog/why-signed-permissions/">Signed permissions</a><a href="/blog/delta-indexes/">Delta indexes</a></div>'],
        body: `
<p class="meta"><span>By the AIFeed team</span><span>September 2026</span><span>7 min read</span><span class="tag info">crypto</span></p>
<p class="lede">A registry that cannot be forged and cannot be ignored is the difference between policy and enforcement.</p>
<p>Status lives in documents signed by multiple governance keys. A single compromised key cannot mark an origin as revoked, or quietly restore one that was suspended. Clients re-check status at use time and treat registry silence beyond 168 hours as UNVERIFIED rather than "probably fine".</p>
<ol class="flow-v"><li>Fetch the revocation URL from the manifest.</li><li>Verify the document signatures against the published governance keys.</li><li>Apply the status: active, under_review, or suspended.</li><li>Record the document in the audit bundle.</li></ol>
<p>See the <a href="https://revoked.aifeed.md">revoked demo</a> for the full flow, including what a well-behaved client does when a manifest that verified yesterday comes back suspended today.</p>
<ul class="related"><li><a href="/blog/delta-indexes/">Delta indexes: skipping what did not change</a></li></ul>`
      },
      {
        path: '/status/', title: 'Service status',
        summary: 'Endpoint status, incidents, and maintenance windows for this demo origin.',
        titleId: 'Status layanan',
        summaryId: 'Status endpoint, insiden, dan jendela pemeliharaan untuk origin demo ini.',
        kind: 'page', crumbs: ['Status'],
        stats: [['99.98%', '30-day availability'], ['0.70 ms', 'verification per page'], ['2', 'governance keys']],
        body: `
<h1>Service status</h1>
<p class="lede">All systems operational. This page is part of the demo and does not track a real service.</p>
<table class="table striped">
  <thead><tr><th>Endpoint</th><th>Status</th><th>Last check</th></tr></thead>
  <tbody>
    <tr><td><code>/.well-known/ai.json</code></td><td><span class="tag ok">operational</span></td><td>1 min ago</td></tr>
    <tr><td><code>/.well-known/aifeed-index.json</code></td><td><span class="tag ok">operational</span></td><td>1 min ago</td></tr>
    <tr><td>Content negotiation (markdown)</td><td><span class="tag ok">operational</span></td><td>1 min ago</td></tr>
    <tr><td>Revocation registry</td><td><span class="tag ok">operational</span></td><td>5 min ago</td></tr>
  </tbody>
</table>
<section class="block">
  <h2>Incident history</h2>
  <div class="timeline">
    <div class="step"><b>2026-09-02 · resolved</b><span>Delayed index refresh for 12 minutes. No data loss; digests catch up automatically.</span></div>
    <div class="step"><b>2026-08-19 · resolved</b><span>Signing key rotation rehearsal. Old key revoked, new key anchored in DNS.</span></div>
    <div class="step"><b>2026-08-01 · resolved</b><span>Elevated 429 rate on the strict demo only; expected behaviour during load tests.</span></div>
  </div>
</section>`,
        bodyId: `
<section class="hero">
  <p class="eyebrow">demo.aifeed.md · demonstrasi langsung</p>
  <h1>Situs ini mempraktikkan apa yang diajarkan AIFeed</h1>
  <p class="lede">Setiap halaman diterbitkan dua kali: HTML untuk pembaca, dan markdown bertanda tangan untuk mesin. Izin ditandatangani dengan Ed25519, dipin ke domain melalui DNS, dan dapat dicabut.</p>
  <p><a class="btn" href="https://verify.aifeed.md/?url=https%3A%2F%2Fdemo.aifeed.md">Verifikasi di browser</a> <a class="btn ghost" href="/id/docs/">Jalankan dari CLI</a></p>
</section>
<section class="block">
  <h2>Yang dideklarasikan origin ini</h2>
  <table class="table striped"><thead><tr><th>Penggunaan</th><th>Keputusan</th></tr></thead><tbody>
    <tr><td>search, retrieval, input</td><td><span class="tag ok">allow</span></td></tr>
    <tr><td>quote, summarize</td><td><span class="tag ok">allow</span> (atribusi wajib)</td></tr>
    <tr><td>training, modify, embed, commercial_use</td><td><span class="tag no">deny</span></td></tr>
  </tbody></table>
</section>`,
        newsletter: true
      },
      {
        path: '/changelog/', title: 'Changelog',
        summary: 'Release history for the reference implementation and the demo origins.',
        titleId: 'Changelog',
        summaryId: 'Riwayat rilis implementasi referensi dan origin demo.',
        kind: 'page', crumbs: ['Changelog'],
        body: `
<h1>Changelog</h1>
<div class="timeline">
  <div class="step"><b>1.0.0-draft.1 · 2026-09-16</b><span>SDK TLS option forwarding; live demo origins with browser verifier and strict enforcement.</span></div>
  <div class="step"><b>1.0.0-draft · 2026-09-16</b><span>Release renumbered; canonical domain moved to aifeed.md; report pages rebuilt in English.</span></div>
  <div class="step"><b>0.3.0-draft · 2026-09-15</b><span>AIFeed Markdown v1.0, dual-stack serving, 11 new vectors, WordPress dual mode.</span></div>
  <div class="step"><b>0.2.0-draft · 2026-09-15</b><span>MAKO trust profile, delta index, assets, triage, llms.txt.</span></div>
  <div class="step"><b>0.1.0-rc1 · 2026-09-14</b><span>Signed manifests, DNS anchor, revocation, offline bundles.</span></div>
</div>
<div class="note">Full history in <a href="https://github.com/denyn1/aifeed-protocol/blob/main/CHANGELOG.md">CHANGELOG.md</a>.</div>`
      }
    ],
    extraArt: [
      { name: 'blog-signed', kind: 'wide' },
      { name: 'blog-delta', kind: 'wide' },
      { name: 'blog-revocation', kind: 'wide' },
      { name: 'avatar-team', kind: 'avatar' }
    ]
  },

  {
    sub: 'news',
    domain: 'news.aifeed.md',
    name: 'The Selat Post',
    type: 'news',
    locale: 'en',
    theme: { accent: '#052962', accent2: '#c70000' },
    mode: 'light',
    masthead: { edition: 'International', weather: 'Jakarta 31° · Haze' },
    fonts: "'Inter',-apple-system,'Segoe UI',Roboto,sans-serif",
    headFonts: "'Newsreader',Georgia,serif",
    fontCss: 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,700;0,6..72,900;1,6..72,400&family=Inter:wght@400;500;600;700&display=swap',
    tagline: 'Independent reporting across the strait region',
    topContact: 'tips@news.aifeed.md · +62 21 555 0100',
    search: true,
    ctaLabel: 'Subscribe',
    ctaHref: '/about/',
    about: 'A demonstration newsroom. The masthead is fictional; the signatures are real.',
    nav: [['/', 'Front page', 'Beranda'], ['/world/', 'World', 'Dunia'], ['/tech/', 'Tech', 'Teknologi'], ['/business/', 'Business', 'Bisnis'], ['/about/', 'About', 'Tentang']],
    subnav: [['/', 'Today', 'Hari ini'], ['/world/', 'World', 'Dunia'], ['/tech/', 'Technology', 'Teknologi'], ['/business/', 'Markets', 'Pasar'], ['/id/', 'Bahasa Indonesia', 'Bahasa Indonesia'], ['/about/', 'Editorial policy', 'Kebijakan redaksi']],
    footerCols: [
      ['sections', [['/world/', 'World'], ['/tech/', 'Technology'], ['/business/', 'Business'], ['/id/', 'Bahasa Indonesia']]],
      ['newsroom', [['/about/', 'About us'], ['/about/', 'Editorial policy'], ['/authors/nadia/', 'Nadia Rahman'], ['/about/', 'Contact']]],
      ['forMachines', [['/.well-known/ai.json', 'Manifest'], ['/.well-known/aifeed-index.json', 'Delta index'], ['/llms.txt', 'llms.txt']]]
    ],
    newsletterTitle: 'newsletterMorning',
    newsletterText: 'One email each weekday morning. Static demo: the form does not submit.',
    pages: [
      {
        path: '/', title: 'The Selat Post — reporting for readers and for agents',
        summary: 'World, technology, and markets reporting with per-article permissions you can verify.',
        titleId: 'The Selat Post — liputan untuk pembaca dan untuk agen',
        summaryId: 'Liputan dunia, teknologi, dan pasar dengan izin per artikel yang dapat diverifikasi.',
        kind: 'home', art: { name: 'lead', kind: 'hero', caption: 'The lead story carries its own signed permissions: quote and summarize yes, train no.' },
        stats: [['24/7', 'newsroom coverage'], ['4', 'desks'], ['18', 'reporters'], ['0', 'training crawls allowed']],
        body: `
<div class="ticker">
  <div><b>Breaking</b> Container bookings at the eastern terminal rise for a sixth week.</div>
  <div><b>Markets</b> Regional freight index up 1.8% after the harbor report.</div>
  <div><b>Tech</b> Signed newsroom pilot expands to three more publishers.</div>
</div>
<section class="hero">
  <p class="eyebrow">Front page · Friday edition</p>
  <h1>Strait logistics: the quiet rerouting</h1>
  <p class="lede">Shipping data suggests a slow realignment of regional routes. Our full report, tables, and
  method notes are published under a signed policy: quote and summarize with attribution, training denied.</p>
  <p><a class="btn" href="/world/strait-logistics/">Read the full story</a> <a class="btn ghost" href="/id/logistik-selat/">Baca dalam Bahasa Indonesia</a></p>
</section>
<section class="block">
  <h2>More stories</h2>
  <div class="grid four">
    <a class="card" href="/tech/agent-traffic/"><div class="thumb"><img src="/assets/thumb-agents.svg" alt=""></div><div class="body"><h3>Agent traffic passes half of requests</h3><p>What newsrooms see when bots outnumber readers.</p></div></a>
    <a class="card" href="/world/harbor-capacity/"><div class="thumb"><img src="/assets/thumb-harbor.svg" alt=""></div><div class="body"><h3>Harbor capacity report lands quietly</h3><p>Berth schedules absorb the change; inland transport strains.</p></div></a>
    <a class="card" href="/tech/signed-newsrooms/"><div class="thumb"><img src="/assets/thumb-signed.svg" alt=""></div><div class="body"><h3>The case for signed newsrooms</h3><p>Provenance as a product feature, not a compliance chore.</p></div></a>
    <a class="card" href="/business/freight-index/"><div class="thumb"><img src="/assets/thumb-freight.svg" alt=""></div><div class="body"><h3>Freight index hits a two-year high</h3><p>What the market read into this week's numbers.</p></div></a>
  </div>
</section>
<div class="banner"><strong>Machines read this site too</strong><small>Every article ships a signed summary and tags. Training is denied on all of them; quoting is welcome with attribution. <a href="/about/">Read the policy</a>.</small></div>`,
        bodyId: `
<div class="ticker">
  <div><b>Terbaru</b> Pemesanan kontainer terminal timur naik untuk pekan keenam.</div>
  <div><b>Pasar</b> Indeks kargo kawasan naik 1,8% setelah laporan pelabuhan.</div>
  <div><b>Teknologi</b> Pilot newsroom bertanda tangan meluas ke tiga penerbit lain.</div>
</div>
<section class="hero">
  <p class="eyebrow">Beranda · edisi Jumat</p>
  <h1>Logistik Selat: pengalihan yang senyap</h1>
  <p class="lede">Data pelayaran menunjukkan realokasi rute kawasan secara perlahan. Laporan lengkap, tabel, dan catatan metode terbit di bawah kebijakan bertanda tangan: kutip dan ringkas dengan atribusi, pelatihan ditolak.</p>
  <p><a class="btn" href="/id/logistik-selat/">Baca laporan lengkap</a> <a class="btn ghost" href="/world/strait-logistics/">Read in English</a></p>
</section>`,
        newsletter: true
      },
      {
        path: '/world/', title: 'World — The Selat Post',
        summary: 'World desk: logistics, climate, and trade across the strait region.',
        titleId: 'Dunia — The Selat Post',
        summaryId: 'Desk dunia: logistik, iklim, dan perdagangan di kawasan selat.',
        kind: 'listing', crumbs: ['World'],
        aside: [
          '<div class="toc"><h4>Most read</h4><a href="/world/strait-logistics/">Strait logistics: the quiet rerouting</a><a href="/world/harbor-capacity/">Harbor capacity report</a></div>',
          '<div class="toc"><h4>Follow</h4><a href="/id/">Bahasa Indonesia edition</a><a href="/about/">Editorial policy</a></div>'
        ],
        body: `
<h1>World</h1>
<p class="lede">Logistics, climate, and trade across the strait region.</p>
<div class="filters"><a class="active" href="/world/">All</a><a href="/world/">Logistics</a><a href="/world/">Climate</a><a href="/world/">Trade</a><a href="/world/">Policy</a></div>
<div class="grid two">
  <a class="card" href="/world/strait-logistics/"><div class="thumb"><span class="badge">Exclusive</span><img src="/assets/thumb-strait.svg" alt=""></div><div class="body"><h3>Strait logistics: the quiet rerouting</h3><p>Container bookings suggest routes are shifting months ahead of any announcement.</p><p class="tags"><span class="tag">logistics</span><span class="tag">6 min</span></p></div></a>
  <a class="card" href="/world/harbor-capacity/"><div class="thumb"><img src="/assets/thumb-harbor.svg" alt=""></div><div class="body"><h3>Harbor capacity report lands quietly</h3><p>Berth schedules absorb the change; inland transport shows the first strain.</p><p class="tags"><span class="tag">infrastructure</span><span class="tag">4 min</span></p></div></a>
</div>
<div class="pager"><span class="active">1</span><span>2</span><a href="/world/">Next →</a></div>`
      },
      {
        path: '/tech/', title: 'Tech — The Selat Post',
        summary: 'Technology desk: agent traffic, standards, and verification.',
        titleId: 'Teknologi — The Selat Post',
        summaryId: 'Desk teknologi: lalu lintas agen, standar, dan verifikasi.',
        kind: 'listing', crumbs: ['Tech'],
        aside: ['<div class="toc"><h4>Most read</h4><a href="/tech/agent-traffic/">Agent traffic passes half of requests</a><a href="/tech/signed-newsrooms/">The case for signed newsrooms</a></div>'],
        body: `
<h1>Technology</h1>
<p class="lede">Infrastructure, agents, and the standards that keep them honest.</p>
<div class="filters"><a class="active" href="/tech/">All</a><a href="/tech/">Agents</a><a href="/tech/">Standards</a><a href="/tech/">Infrastructure</a></div>
<div class="grid two">
  <a class="card" href="/tech/agent-traffic/"><div class="thumb"><img src="/assets/thumb-agents.svg" alt=""></div><div class="body"><h3>Agent traffic passes half of requests</h3><p>Most pulls are re-reads of pages that did not change.</p><p class="tags"><span class="tag">agents</span><span class="tag">5 min</span></p></div></a>
  <a class="card" href="/tech/signed-newsrooms/"><div class="thumb"><img src="/assets/thumb-signed.svg" alt=""></div><div class="body"><h3>The case for signed newsrooms</h3><p>One manifest, one index, one registry — three files that always agree.</p><p class="tags"><span class="tag">standards</span><span class="tag">7 min</span></p></div></a>
</div>`
      },
      {
        path: '/business/', title: 'Business — The Selat Post',
        summary: 'Markets, freight, and the economics of the strait.',
        titleId: 'Bisnis — The Selat Post',
        summaryId: 'Pasar, kargo, dan ekonomi selat.',
        kind: 'listing', crumbs: ['Business'],
        aside: ['<div class="toc"><h4>Data</h4><a href="/business/freight-index/">Freight index</a><a href="/world/harbor-capacity/">Harbor capacity</a></div>'],
        body: `
<h1>Business</h1>
<div class="grid two">
  <a class="card" href="/business/freight-index/"><div class="thumb"><img src="/assets/thumb-freight.svg" alt=""></div><div class="body"><h3>Freight index hits a two-year high</h3><p>What the market read into this week's numbers.</p><p class="tags"><span class="tag">markets</span><span class="tag">4 min</span></p></div></a>
</div>`
      },
      {
        path: '/world/strait-logistics/', title: 'Strait logistics: the quiet rerouting',
        summary: 'Shipping data suggests a slow realignment of regional routes. Signed and verifiable.',
        titleId: 'Logistik Selat: pengalihan yang senyap',
        summaryId: 'Data pelayaran menunjukkan realokasi rute kawasan secara perlahan. Bertanda tangan dan dapat diverifikasi.',
        kind: 'article', crumbs: ['World', 'Strait logistics'], crumbsHrefs: ['/world/'],
        art: { name: 'strait-lead', kind: 'wide', caption: 'Container bookings by quarter, eastern terminal (illustrative data for this demo).' },
        aside: [
          '<div class="toc"><h4>In this story</h4><a href="#numbers">The numbers</a><a href="#voices">Voices</a><a href="#method">Method</a></div>',
          '<div class="toc"><h4>Related</h4><a href="/world/harbor-capacity/">Harbor capacity report</a><a href="/business/freight-index/">Freight index</a></div>'
        ],
        body: `
<p class="meta"><span>By Nadia Rahman</span><span>World desk</span><span>6 min read</span><span class="tag info">logistics</span><span><a href="/id/logistik-selat/">Baca dalam Bahasa Indonesia</a></span></p>
<p class="lede">Container bookings suggest routing decisions are shifting months ahead of any public announcement — small per vessel, large in aggregate.</p>
<p>Port operators we spoke to describe capacity as adequate but uneven: berth schedules absorb the change, while inland transport shows the first signs of strain. The numbers below are illustrative for this demo, but the method notes and the signed summary are real.</p>
<h2 id="numbers">The numbers</h2>
<table class="table striped">
  <thead><tr><th>Quarter</th><th>Container volume</th><th>Average dwell (hours)</th><th>Change</th></tr></thead>
  <tbody>
    <tr><td>Q1</td><td>182,400 TEU</td><td>31.2</td><td>—</td></tr>
    <tr><td>Q2</td><td>197,150 TEU</td><td>33.8</td><td>+8.1%</td></tr>
    <tr><td>Q3</td><td>208,990 TEU</td><td>35.1</td><td>+6.0%</td></tr>
  </tbody>
</table>
<blockquote>“The schedule absorbs it. The road does not.” — a terminal planner, speaking on background</blockquote>
<h2 id="voices">Voices</h2>
<p>Three planners and two freight forwarders described the same pattern from different angles: bookings move first, public announcements follow, and the inland leg is where the pressure shows up.</p>
<h2 id="method">Method</h2>
<p>Aggregate booking figures were cross-checked against two independent datasets. This demo does not publish the underlying records; the signed summary at the top of this page is the machine-readable version.</p>
<div class="author"><img src="/assets/avatar-nadia.svg" alt=""><div><b>Nadia Rahman</b><span>World desk · logistics and trade · <a href="/authors/nadia/">Author page</a></span></div></div>
<ul class="related"><li><a href="/world/harbor-capacity/">Harbor capacity report lands quietly</a></li><li><a href="/business/freight-index/">Freight index hits a two-year high</a></li></ul>
<p class="note">This article permits quoting and summarization with attribution. Training is denied. See <code>/.well-known/ai.json</code> for the signed policy.</p>`
      },
      {
        path: '/id/logistik-selat/', title: 'Logistik Selat: pengalihan yang senyap',
        summary: 'Data pelayaran menunjukkan realokasi rute kawasan secara perlahan. Bertanda tangan dan dapat diverifikasi.',
        titleId: 'Logistik Selat: pengalihan yang senyap',
        summaryId: 'Data pelayaran menunjukkan realokasi rute kawasan; versi bahasa Indonesia.',
        kind: 'article', crumbs: ['Dunia', 'Logistik Selat'], crumbsHrefs: ['/world/'],
        art: { name: 'strait-lead-id', kind: 'wide', caption: 'Pemesanan kontainer per kuartal, terminal timur (data ilustratif untuk demo ini).' },
        aside: ['<div class="toc"><h4>Dalam artikel ini</h4><a href="#angka">Angka</a><a href="#metode">Metode</a></div>'],
        body: `
<p class="meta"><span>Oleh Nadia Rahman</span><span>Desk Dunia</span><span>6 menit</span><span class="tag info">logistik</span><span><a href="/world/strait-logistics/">Read in English</a></span></p>
<p class="lede">Pemesanan kontainer menunjukkan keputusan rute bergeser beberapa bulan sebelum pengumuman resmi apa pun.</p>
<p>Operator pelabuhan yang kami hubungi menyebut kapasitas memadai namun tidak merata: jadwal tambat masih menyerap perubahan, sementara transportasi darat mulai menunjukkan tekanan.</p>
<h2 id="angka">Angka</h2>
<table class="table striped"><thead><tr><th>Kuartal</th><th>Volume kontainer</th><th>Dwell rata-rata</th></tr></thead><tbody>
  <tr><td>Q1</td><td>182.400 TEU</td><td>31,2 jam</td></tr>
  <tr><td>Q2</td><td>197.150 TEU</td><td>33,8 jam</td></tr>
  <tr><td>Q3</td><td>208.990 TEU</td><td>35,1 jam</td></tr>
</tbody></table>
<h2 id="metode">Metode</h2>
<p>Angka agregat diverifikasi silang dengan dua kumpulan data independen. Versi ringkas yang dapat dibaca mesin ada pada frontmatter bertanda tangan di halaman ini.</p>
<p class="note">Artikel ini mengizinkan kutipan dan peringkasan dengan atribusi. Pelatihan model ditolak.</p>`
      },
      {
        path: '/tech/agent-traffic/', title: 'Agent traffic passes half of requests',
        summary: 'What newsrooms see when automated clients outnumber readers.',
        titleId: 'Lalu lintas agen melewati separuh permintaan',
        summaryId: 'Apa yang newsroom lihat ketika klien otomatis menyamai pembaca manusia.',
        kind: 'article', crumbs: ['Tech', 'Agent traffic'], crumbsHrefs: ['/tech/'],
        art: { name: 'agents-lead', kind: 'wide', caption: 'Request mix for a typical newsroom: automated clients now rival human page views.' },
        aside: ['<div class="toc"><h4>Related</h4><a href="/tech/signed-newsrooms/">Signed newsrooms</a></div>'],
        body: `
<p class="meta"><span>By Arif Santosa</span><span>Tech desk</span><span>5 min read</span><span class="tag info">agents</span><span><a href="/id/lalu-lintas-agen/">Baca dalam Bahasa Indonesia</a></span></p>
<p class="lede">For a typical newsroom, HTML requests from automated agents now rival human page views.</p>
<p>The interesting part is not the volume; it is the mismatch between what agents fetch and what they need. Most pulls are re-reads of pages that did not change.</p>
<p>Signed indexes change that arithmetic. When digests are part of the contract, an agent can skip the page entirely and spend its budget where the reporting actually moved.</p>
<table class="table"><thead><tr><th>Metric</th><th>Before</th><th>After signed index</th></tr></thead><tbody>
  <tr><td>Pages fetched per visit</td><td>18</td><td>4</td></tr>
  <tr><td>Bytes per visit</td><td>1.2 MB</td><td>310 KB</td></tr>
  <tr><td>Unchanged pages read</td><td>14</td><td>0</td></tr>
</tbody></table>
<div class="author"><img src="/assets/avatar-arif.svg" alt=""><div><b>Arif Santosa</b><span>Tech desk · infrastructure and standards</span></div></div>`
      },
      {
        path: '/id/lalu-lintas-agen/', title: 'Lalu lintas agen melewati separuh permintaan',
        summary: 'Apa yang newsroom lihat ketika klien otomatis menyamai pembaca manusia.',
        titleId: 'Lalu lintas agen melewati separuh permintaan',
        summaryId: 'Versi bahasa Indonesia dari laporan desk teknologi.',
        kind: 'article', crumbs: ['Teknologi', 'Lalu lintas agen'], crumbsHrefs: ['/tech/'],
        art: { name: 'agents-lead-id', kind: 'wide', caption: 'Komposisi permintaan newsroom: klien otomatis kini menyamai pembaca manusia.' },
        body: `
<p class="meta"><span>Oleh Arif Santosa</span><span>Desk Teknologi</span><span>5 menit</span><span><a href="/tech/agent-traffic/">Read in English</a></span></p>
<p class="lede">Bagi newsroom tipikal, permintaan HTML dari agen otomatis kini menyamai kunjungan manusia.</p>
<p>Masalahnya bukan volume, melainkan ketidaksesuaian antara yang diambil agen dan yang dibutuhkan. Sebagian besar pengambilan adalah pembacaan ulang halaman yang tidak berubah.</p>
<p>Indeks bertanda tangan mengubah aritmetika itu: agen dapat melewati halaman yang tidak berubah dan memakai anggarannya untuk laporan yang benar-benar bergerak.</p>`
      },
      {
        path: '/tech/signed-newsrooms/', title: 'The case for signed newsrooms',
        summary: 'Provenance is becoming a product feature, not a compliance chore.',
        titleId: 'Argumen untuk newsroom bertanda tangan',
        summaryId: 'Provenance menjadi fitur produk, bukan tugas kepatuhan.',
        kind: 'article', crumbs: ['Tech', 'Signed newsrooms'], crumbsHrefs: ['/tech/'],
        art: { name: 'signed-lead', kind: 'wide', caption: 'One manifest, one delta index, one registry — three files that always agree.' },
        body: `
<p class="meta"><span>By Nadia Rahman</span><span>Tech desk</span><span>7 min read</span><span class="tag info">standards</span></p>
<p class="lede">Every newsroom already declares what it allows, usually in prose.</p>
<p>Signing the declaration converts it into something machines can check without a lawyer in the loop, and something editors can change without waiting for a crawler to be rebuilt.</p>
<blockquote>The failure mode to avoid is silent drift: a policy page that says one thing while the feed says another.</blockquote>
<p>Three files, one policy: the manifest, the delta index, and the revocation registry. When they disagree, clients notice before readers do.</p>`
      },
      {
        path: '/world/harbor-capacity/', title: 'Harbor capacity report lands quietly',
        summary: 'Berth schedules absorb the change; inland transport shows the first strain.',
        titleId: 'Laporan kapasitas pelabuhan terbit senyap',
        summaryId: 'Jadwal tambat menyerap perubahan; transportasi darat mulai tertekan.',
        kind: 'article', crumbs: ['World', 'Harbor capacity'], crumbsHrefs: ['/world/'],
        art: { name: 'harbor-lead', kind: 'wide', caption: 'Berth occupancy by week; the eastern terminal remains the constraint.' },
        body: `
<p class="meta"><span>By Nadia Rahman</span><span>World desk</span><span>4 min read</span><span class="tag info">infrastructure</span></p>
<p class="lede">The report itself is dry; the interesting reading is in the appendices.</p>
<p>Berth occupancy stays within planned limits, but truck turnaround times drift upward for the third consecutive month. Operators say the fix is scheduling, not concrete.</p>
<table class="table"><thead><tr><th>Metric</th><th>Q1</th><th>Q3</th></tr></thead><tbody>
  <tr><td>Berth occupancy</td><td>78%</td><td>81%</td></tr>
  <tr><td>Truck turnaround</td><td>92 min</td><td>118 min</td></tr>
</tbody></table>`
      },
      {
        path: '/business/freight-index/', title: 'Freight index hits a two-year high',
        summary: 'What the market read into this week’s numbers.',
        titleId: 'Indeks kargo menyentuh level tertinggi dua tahun',
        summaryId: 'Apa yang dibaca pasar dari angka minggu ini.',
        kind: 'article', crumbs: ['Business', 'Freight index'], crumbsHrefs: ['/business/'],
        art: { name: 'freight-lead', kind: 'wide', caption: 'The regional freight index over eight quarters.' },
        body: `
<p class="meta"><span>By the business desk</span><span>4 min read</span><span class="tag info">markets</span></p>
<p class="lede">Up 1.8% week over week, the index closed at its highest level in two years.</p>
<p>Analysts point to the same quieter cause the world desk reported: routing changes that were never announced, accumulating into visible price pressure.</p>
<p class="note">Demo content. Not investment advice, and not a real index.</p>`
      },
      {
        path: '/authors/nadia/', title: 'Nadia Rahman — author',
        summary: 'World desk reporter covering logistics, trade, and climate.',
        titleId: 'Nadia Rahman — penulis',
        summaryId: 'Reporter desk dunia yang meliput logistik, perdagangan, dan iklim.',
        kind: 'page', crumbs: ['Authors', 'Nadia Rahman'],
        aside: ['<div class="toc"><h4>Author</h4><a href="/world/strait-logistics/">Strait logistics</a><a href="/tech/signed-newsrooms/">Signed newsrooms</a></div>'],
        body: `
<div class="author"><img src="/assets/avatar-nadia.svg" alt=""><div><b>Nadia Rahman</b><span>World desk · logistics and trade · 12 years covering the strait region</span></div></div>
<h1>Recent work</h1>
<ul class="related">
  <li><a href="/world/strait-logistics/">Strait logistics: the quiet rerouting</a> — 6 min</li>
  <li><a href="/tech/signed-newsrooms/">The case for signed newsrooms</a> — 7 min</li>
  <li><a href="/world/harbor-capacity/">Harbor capacity report lands quietly</a> — 4 min</li>
</ul>`
      },
      {
        path: '/about/', title: 'About The Selat Post (demo)',
        summary: 'Editorial policy and AI permissions for this demonstration newsroom.',
        titleId: 'Tentang The Selat Post (demo)',
        summaryId: 'Kebijakan redaksi dan izin AI untuk newsroom demonstrasi ini.',
        kind: 'page', crumbs: ['About'],
        faq: [
          ['Can I train a model on your articles?', 'No. Training is denied across every article, and the denial is part of the signed manifest, not just prose.'],
          ['Can I quote or summarize?', 'Yes, with attribution. Quoting and summarization are allowed in the signed policy.'],
          ['How do I know the policy is current?', 'The manifest is signed and the revocation registry is re-checked by compliant clients before restricted uses.']
        ],
        body: `
<h1>About this newsroom</h1>
<p class="lede">A demonstration origin. The masthead is fictional; the signatures are real.</p>
<section class="block">
  <h2>Editorial policy for machines</h2>
  <ul class="list">
    <li>Summarization and quoting: allowed with attribution.</li>
    <li>Translation: allowed (see the Indonesian edition).</li>
    <li>Training: denied, across every article.</li>
    <li>Crawl limits: respect the manifest; use the delta index.</li>
  </ul>
</section>
<section class="block">
  <h2>Corrections</h2>
  <p>Corrections are published on the front page and inside the signed index, so machines see them at the same time readers do.</p>
</section>`
      }
    ],
    extraArt: [
      { name: 'lead', kind: 'hero' },
      { name: 'thumb-agents', kind: 'thumb' }, { name: 'thumb-harbor', kind: 'thumb' },
      { name: 'thumb-signed', kind: 'thumb' }, { name: 'thumb-freight', kind: 'thumb' },
      { name: 'thumb-strait', kind: 'thumb' },
      { name: 'avatar-nadia', kind: 'avatar' }, { name: 'avatar-arif', kind: 'avatar' }
    ]
  },

  {
    sub: 'shop',
    domain: 'shop.aifeed.md',
    name: 'Warung Kopi Nusantara',
    type: 'ecommerce',
    locale: 'id',
    theme: { accent: '#8a4b00', accent2: '#b3261e' },
    mode: 'light',
    promo: { en: 'Weekend sale — 15% off gift sets.', id: 'Diskon akhir pekan — 15% untuk paket hadiah.' },
    promoHref: '/produk/',
    promoCta: 'Shop now',
    fonts: "'Plus Jakarta Sans',-apple-system,'Segoe UI',Roboto,sans-serif",
    headFonts: "'Fraunces',Georgia,serif",
    fontCss: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
    tagline: 'Kopi dan teh langsung dari petani',
    topContact: 'halo@shop.aifeed.md · Gratis ongkir > Rp 250.000',
    search: true,
    ctaLabel: 'Keranjang',
    ctaHref: '/keranjang/',
    about: 'Toko fiktif yang mendemonstrasikan profil e-commerce AIFeed secara lengkap.',
    nav: [['/', 'Beranda', 'Beranda'], ['/produk/', 'Produk', 'Produk'], ['/kebijakan/', 'Kebijakan', 'Kebijakan'], ['/tentang/', 'Tentang', 'Tentang'], ['/kontak/', 'Kontak', 'Kontak']],
    subnav: [['/produk/', 'Semua produk', 'Semua produk'], ['/produk/', 'Kopi', 'Kopi'], ['/produk/', 'Teh', 'Teh'], ['/produk/', 'Paket hadiah', 'Paket hadiah'], ['/keranjang/', 'Keranjang', 'Keranjang']],
    footerCols: [
      ['shopping', [['/produk/', 'Katalog'], ['/keranjang/', 'Keranjang'], ['/produk/kopi-gayo/', 'Kopi Gayo'], ['/produk/teh-melati/', 'Teh Melati']]],
      ['help', [['/kebijakan/', 'Pengiriman & pengembalian'], ['/kontak/', 'Hubungi kami'], ['/kebijakan/', 'Privasi']]],
      ['forMachines', [['/.well-known/ai.json', 'Manifest'], ['/.well-known/aifeed-index.json', 'Indeks delta'], ['/llms.txt', 'llms.txt']]]
    ],
    newsletterTitle: 'newsletterHarvest',
    newsletterText: 'Cerita petani, rilis rasa baru, dan diskon pelanggan. Demo statis: formulir tidak mengirim data.',
    pages: [
      {
        path: '/', title: 'Warung Kopi Nusantara — demo e-commerce AIFeed',
        summary: 'Katalog kopi dan teh dengan kebijakan konten bertanda tangan dan lampiran aset.',
        titleId: 'Warung Kopi Nusantara — demo e-commerce AIFeed',
        summaryId: 'Katalog kopi dan teh dengan kebijakan konten bertanda tangan dan lampiran aset.',
        kind: 'home', art: { name: 'shop-hero', kind: 'hero', caption: 'Semua halaman katalog dan produk ditandatangani; penggunaan komersial dan pelatihan ditolak.' },
        stats: [['1.200+', 'pesanan demo'], ['4,9/5', 'rating pelanggan'], ['12', 'petani mitra'], ['48 jam', 'pengiriman rata-rata']],
        body: `
<section class="hero">
  <p class="eyebrow">shop.aifeed.md · demo e-commerce</p>
  <h1>Kopi yang jujur, kebijakan yang jelas</h1>
  <p class="lede">Katalog, halaman produk, dan lampiran media di toko ini semuanya bertanda tangan. Agen boleh
  mencari dan merangkum; penggunaan komersial dan pelatihan model ditolak.</p>
  <p><a class="btn" href="/produk/">Lihat katalog</a> <a class="btn ghost" href="/kebijakan/">Kebijakan toko</a></p>
  <div class="trust"><span>Pembayaran demo</span><span>Garansi rasa 30 hari</span><span>Ongkir terlacak</span></div>
</section>
<section class="block">
  <h2>Kategori</h2>
  <div class="grid four">
    <a class="card" href="/produk/"><div class="body"><h3>Kopi</h3><p>Gayo, Toraja, Aceh, dan rumahan.</p></div></a>
    <a class="card" href="/produk/"><div class="body"><h3>Teh</h3><p>Melati, hitam premium, dan herbal.</p></div></a>
    <a class="card" href="/produk/"><div class="body"><h3>Paket hadiah</h3><p>Kemasan kayu dengan kartu ucapan.</p></div></a>
    <a class="card" href="/produk/"><div class="body"><h3>Peralatan</h3><p>V60, grinder manual, dan timbangan.</p></div></a>
  </div>
</section>
<section class="block">
  <h2>Produk unggulan</h2>
  <div class="grid">
    <a class="card" href="/produk/kopi-gayo/"><div class="thumb"><span class="badge">Terlaris</span><img src="/assets/produk-gayo.svg" alt=""></div><div class="body"><h3>Kopi Gayo</h3><p class="rating">★★★★★</p><p class="price">Rp 95.000</p></div></a>
    <a class="card" href="/produk/kopi-toraja/"><div class="thumb"><img src="/assets/produk-toraja.svg" alt=""></div><div class="body"><h3>Kopi Toraja</h3><p class="rating">★★★★☆</p><p class="price">Rp 110.000</p></div></a>
    <a class="card" href="/produk/teh-melati/"><div class="thumb"><img src="/assets/produk-melati.svg" alt=""></div><div class="body"><h3>Teh Melati</h3><p class="rating">★★★★★</p><p class="price">Rp 42.000</p></div></a>
  </div>
</section>
<div class="banner"><strong>Promo akhir pekan</strong><small>Diskon 15% untuk paket hadiah, otomatis di keranjang demo. <a href="/produk/">Lihat katalog →</a></small></div>
<section class="block">
  <h2>Kata pelanggan</h2>
  <div class="grid two">
    <blockquote>“Aroma Gayo-nya konsisten dari pesanan pertama.” <span class="meta" style="display:block;margin-top:6px">— Rina, Bandung</span></blockquote>
    <blockquote>“Teh melatinya tidak pahit meski diseduh lama.” <span class="meta" style="display:block;margin-top:6px">— Bagas, Surabaya</span></blockquote>
  </div>
</section>`,
        bodyId: `
<section class="hero">
  <p class="eyebrow">shop.aifeed.md · demo e-commerce</p>
  <h1>Kopi yang jujur, kebijakan yang jelas</h1>
  <p class="lede">Katalog, halaman produk, dan lampiran media di toko ini semuanya bertanda tangan. Agen boleh mencari dan merangkum; penggunaan komersial dan pelatihan model ditolak.</p>
  <p><a class="btn" href="/id/produk/">Lihat katalog</a> <a class="btn ghost" href="/id/kebijakan/">Kebijakan toko</a></p>
</section>
<section class="block">
  <h2>Produk unggulan</h2>
  <div class="grid">
    <a class="card" href="/id/produk/kopi-gayo/"><div class="thumb"><span class="badge">Terlaris</span><img src="/assets/produk-gayo.svg" alt=""></div><div class="body"><h3>Kopi Gayo</h3><p class="rating">★★★★★</p><p class="price">Rp 95.000</p></div></a>
    <a class="card" href="/id/produk/kopi-toraja/"><div class="thumb"><img src="/assets/produk-toraja.svg" alt=""></div><div class="body"><h3>Kopi Toraja</h3><p class="rating">★★★★☆</p><p class="price">Rp 110.000</p></div></a>
    <a class="card" href="/id/produk/teh-melati/"><div class="thumb"><img src="/assets/produk-melati.svg" alt=""></div><div class="body"><h3>Teh Melati</h3><p class="rating">★★★★★</p><p class="price">Rp 42.000</p></div></a>
  </div>
</section>`,
        newsletter: true
      },
      {
        path: '/produk/', title: 'Katalog produk',
        summary: 'Enam produk dengan harga, stok, kategori, dan lampiran aset pada indeks AIFeed.',
        titleId: 'Katalog produk',
        summaryId: 'Enam produk dengan harga, stok, kategori, dan lampiran aset pada indeks AIFeed.',
        kind: 'listing', crumbs: ['Produk'],
        aside: [
          '<div class="toc"><h4>Filter cepat</h4><a href="/produk/">Kopi</a><a href="/produk/">Teh</a><a href="/produk/">Paket</a></div>',
          '<div class="toc"><h4>Aset</h4><p style="color:var(--muted);font-size:.85rem">Setiap produk menyertakan gambar kemasan dan lembar data pada indeks bertanda tangan.</p></div>'
        ],
        body: `
<h1>Katalog</h1>
<p class="lede">Enam produk contoh. Stok dan harga statis; kebijakan kontennya nyata dan bertanda tangan.</p>
<div class="filters"><a class="active" href="/produk/">Semua</a><a href="/produk/">Kopi</a><a href="/produk/">Teh</a><a href="/produk/">Paket hadiah</a><a href="/produk/">Peralatan</a></div>
<div class="grid">
  <a class="card" href="/produk/kopi-gayo/"><div class="thumb"><span class="badge">Terlaris</span><img src="/assets/produk-gayo.svg" alt=""></div><div class="body"><h3>Kopi Gayo</h3><p>Dark roast, 250 g</p><p class="rating">★★★★★</p><p class="price">Rp 95.000</p></div></a>
  <a class="card" href="/produk/kopi-toraja/"><div class="thumb"><img src="/assets/produk-toraja.svg" alt=""></div><div class="body"><h3>Kopi Toraja</h3><p>Medium roast, 250 g</p><p class="rating">★★★★☆</p><p class="price">Rp 110.000</p></div></a>
  <a class="card" href="/produk/teh-melati/"><div class="thumb"><span class="badge">Baru</span><img src="/assets/produk-melati.svg" alt=""></div><div class="body"><h3>Teh Melati</h3><p>Teh hijau, 100 g</p><p class="rating">★★★★★</p><p class="price">Rp 42.000</p></div></a>
  <a class="card" href="/produk/teh-hitam/"><div class="thumb"><img src="/assets/produk-hitam.svg" alt=""></div><div class="body"><h3>Teh Hitam Premium</h3><p>100 g</p><p class="rating">★★★★☆</p><p class="price">Rp 55.000</p></div></a>
  <a class="card" href="/produk/kopi-aceh/"><div class="thumb"><img src="/assets/produk-aceh.svg" alt=""></div><div class="body"><h3>Kopi Aceh</h3><p>250 g</p><p class="rating">★★★★☆</p><p class="price">Rp 92.000</p></div></a>
  <a class="card" href="/produk/kopi-rumahan/"><div class="thumb"><img src="/assets/produk-rumahan.svg" alt=""></div><div class="body"><h3>Kopi Rumahan 1 kg</h3><p>Hemat untuk harian</p><p class="rating">★★★★☆</p><p class="price">Rp 320.000</p></div></a>
</div>
<div class="pager"><span class="active">1</span><span>2</span><a href="/produk/">Next →</a></div>`
      },
      {
        path: '/produk/kopi-gayo/', title: 'Kopi Gayo — 250 g',
        summary: 'Dark roast single origin dari dataran tinggi Gayo. Rp 95.000.',
        titleId: 'Kopi Gayo — 250 g',
        summaryId: 'Dark roast single origin dari dataran tinggi Gayo. Rp 95.000.',
        kind: 'product', crumbs: ['Produk', 'Kopi Gayo'], crumbsHrefs: ['/produk/'],
        art: { name: 'gayo-main', kind: 'product', caption: 'Kemasan 250 g dengan katup aroma satu arah.' },
        aside: [
          '<div class="buybox"><div class="price">Rp 95.000</div><p class="per">250 g · Free delivery over Rp 250.000</p><div class="rating">★★★★★ <span>128 reviews</span></div><div class="row"><span class="variant active">250 g</span><span class="variant">500 g</span><span class="variant">1 kg</span></div><div class="row"><span class="qty"><button type="button">−</button><span>1</span><button type="button">+</button></span><button class="btn" type="button">Add to cart</button></div><div class="stockbar" title="Stock: 42"><i style="width:53%"></i></div><div class="delivery"><b>Delivery</b> · Bandung, 1–4 hari · Free returns 7 days</div></div>',
          '<div class="toc"><h4>Spesifikasi</h4><a href="#spesifikasi">Detail produk</a><a href="#ulasan">Ulasan</a><a href="#kirim">Pengiriman</a></div>',
          '<div class="toc"><h4>Produk terkait</h4><a href="/produk/kopi-toraja/">Kopi Toraja</a><a href="/produk/kopi-aceh/">Kopi Aceh</a></div>'
        ],
        body: `
<p class="meta"><span class="tag ok">Stok 42</span><span class="rating">★★★★★ 128 ulasan</span><span>Asal: Takengon, Aceh</span></p>
<h1>Kopi Gayo <span class="price">Rp 95.000</span></h1>
<div class="gallery">
  <img src="/assets/gayo-main.svg" alt=""><img src="/assets/gayo-2.svg" alt=""><img src="/assets/gayo-3.svg" alt="">
</div>
<h2 id="spesifikasi">Detail produk</h2>
<table class="table striped">
  <tbody>
    <tr><th>Berat</th><td>250 g</td></tr><tr><th>Proses</th><td>Giling basah (wet-hulled)</td></tr>
    <tr><th>Ketinggian</th><td>1.400 mdpl</td></tr><tr><th>Catatan rasa</th><td>Cokelat, jeruk manis, rempah</td></tr>
    <tr><th>Rekomendasi seduh</th><td>V60, 92&deg;C, rasio 1:15</td></tr>
  </tbody>
</table>
<p><button class="btn" type="button">Tambah ke keranjang</button> <a class="btn ghost" href="/keranjang/">Lihat keranjang</a></p>
<h2 id="ulasan">Ulasan</h2>
<div class="review-bars"><div class="rb">5 stars<div class="bar"><i style="width:78%"></i></div>100</div><div class="rb">4 stars<div class="bar"><i style="width:16%"></i></div>20</div><div class="rb">3 stars<div class="bar"><i style="width:5%"></i></div>6</div><div class="rb">2 stars<div class="bar"><i style="width:1%"></i></div>1</div><div class="rb">1 star<div class="bar"><i style="width:1%"></i></div>1</div></div>
<blockquote>“Konsisten dari pesanan pertama.” — Rina, Bandung · ★★★★★</blockquote>
<blockquote>“Cocok untuk tubruk pagi.” — Bagas, Surabaya · ★★★★☆</blockquote>
<div class="note">Gambar kemasan dan lembar data (<code>datasheet-gayo.csv</code>) terlampir sebagai aset pada indeks AIFeed.</div>`
      },
      {
        path: '/produk/kopi-toraja/', title: 'Kopi Toraja — 250 g',
        summary: 'Medium roast dengan body penuh. Rp 110.000.',
        titleId: 'Kopi Toraja — 250 g',
        summaryId: 'Medium roast dengan body penuh. Rp 110.000.',
        kind: 'product', crumbs: ['Produk', 'Kopi Toraja'], crumbsHrefs: ['/produk/'],
        art: { name: 'toraja-main', kind: 'product', caption: 'Profil medium roast untuk espresso maupun tubruk.' },
        body: `
<p class="meta"><span class="tag ok">Stok 18</span><span class="rating">★★★★☆ 74 ulasan</span></p>
<h1>Kopi Toraja <span class="price">Rp 110.000</span></h1>
<table class="table"><tbody>
  <tr><th>Berat</th><td>250 g</td></tr><tr><th>Proses</th><td>Semi-washed</td></tr>
  <tr><th>Catatan rasa</th><td>Karamel, rempah manis, body tebal</td></tr>
</tbody></table>
<p><button class="btn" type="button">Tambah ke keranjang</button></p>
<ul class="related"><li><a href="/produk/kopi-gayo/">Kopi Gayo</a></li><li><a href="/produk/kopi-aceh/">Kopi Aceh</a></li></ul>`
      },
      {
        path: '/produk/teh-melati/', title: 'Teh Melati — 100 g',
        summary: 'Teh hijau dengan bunga melati segar. Rp 42.000.',
        titleId: 'Teh Melati — 100 g',
        summaryId: 'Teh hijau dengan bunga melati segar. Rp 42.000.',
        kind: 'product', crumbs: ['Produk', 'Teh Melati'], crumbsHrefs: ['/produk/'],
        art: { name: 'melati-main', kind: 'product', caption: 'Pucuk muda dan melati petik pagi.' },
        body: `
<p class="meta"><span class="tag ok">Stok 77</span><span class="rating">★★★★★ 203 ulasan</span></p>
<h1>Teh Melati <span class="price">Rp 42.000</span></h1>
<table class="table"><tbody>
  <tr><th>Berat</th><td>100 g</td></tr><tr><th>Seduh</th><td>80&deg;C, 2 menit</td></tr>
  <tr><th>Catatan rasa</th><td>Melati segar, sedikit manis</td></tr>
</tbody></table>
<p><button class="btn" type="button">Tambah ke keranjang</button></p>`
      },
      {
        path: '/produk/teh-hitam/', title: 'Teh Hitam Premium — 100 g',
        summary: 'Teh hitam orthodox dengan malai keemasan. Rp 55.000.',
        titleId: 'Teh Hitam Premium — 100 g',
        summaryId: 'Teh hitam orthodox dengan malai keemasan. Rp 55.000.',
        kind: 'product', crumbs: ['Produk', 'Teh Hitam'], crumbsHrefs: ['/produk/'],
        art: { name: 'hitam-main', kind: 'product', caption: 'Malai keemasan menandakan pucuk pilihan.' },
        body: `
<p class="meta"><span class="tag ok">Stok 12</span><span class="rating">★★★★☆ 41 ulasan</span></p>
<h1>Teh Hitam Premium <span class="price">Rp 55.000</span></h1>
<table class="table"><tbody><tr><th>Berat</th><td>100 g</td></tr><tr><th>Seduh</th><td>95&deg;C, 3 menit</td></tr></tbody></table>
<p><button class="btn" type="button">Tambah ke keranjang</button></p>`
      },
      {
        path: '/produk/kopi-aceh/', title: 'Kopi Aceh — 250 g',
        summary: 'Profil earthy dengan keasaman rendah. Rp 92.000.',
        titleId: 'Kopi Aceh — 250 g',
        summaryId: 'Profil earthy dengan keasaman rendah. Rp 92.000.',
        kind: 'product', crumbs: ['Produk', 'Kopi Aceh'], crumbsHrefs: ['/produk/'],
        art: { name: 'aceh-main', kind: 'product', caption: 'Sangrai sedang untuk penikmat kopi kuat.' },
        body: `
<p class="meta"><span class="tag ok">Stok 25</span><span class="rating">★★★★☆ 58 ulasan</span></p>
<h1>Kopi Aceh <span class="price">Rp 92.000</span></h1>
<table class="table"><tbody><tr><th>Berat</th><td>250 g</td></tr><tr><th>Catatan rasa</th><td>Earthy, tembakau manis, keasaman rendah</td></tr></tbody></table>
<p><button class="btn" type="button">Tambah ke keranjang</button></p>`,
        aside: [
          '<div class="buybox"><div class="price">Rp 92.000</div><p class="per">250 g · Free delivery over Rp 250.000</p><div class="rating">★★★★☆ <span>58 reviews</span></div><div class="row"><span class="variant active">250 g</span></div><div class="row"><span class="qty"><button type="button">−</button><span>1</span><button type="button">+</button></span><button class="btn" type="button">Add to cart</button></div><div class="stockbar" title="Stock: 25"><i style="width:31%"></i></div><div class="delivery"><b>Delivery</b> · Bandung, 1–4 hari · Free returns 7 days</div></div>',
        ],
      },
      {
        path: '/produk/kopi-rumahan/', title: 'Kopi Rumahan 1 kg',
        summary: 'Campuran harian dalam kemasan 1 kg. Rp 320.000.',
        titleId: 'Kopi Rumahan 1 kg',
        summaryId: 'Campuran harian dalam kemasan 1 kg. Rp 320.000.',
        kind: 'product', crumbs: ['Produk', 'Kopi Rumahan'], crumbsHrefs: ['/produk/'],
        art: { name: 'rumahan-main', kind: 'product', caption: 'Kemasan besar untuk pemakaian harian.' },
        body: `
<p class="meta"><span class="tag ok">Stok 9</span><span class="rating">★★★★☆ 87 ulasan</span></p>
<h1>Kopi Rumahan 1 kg <span class="price">Rp 320.000</span></h1>
<table class="table"><tbody><tr><th>Berat</th><td>1 kg</td></tr><tr><th>Rekomendasi</th><td>Tubruk, moka pot, maupun espresso</td></tr></tbody></table>
<p><button class="btn" type="button">Tambah ke keranjang</button></p>`,
        aside: [
          '<div class="buybox"><div class="price">Rp 320.000</div><p class="per">1 kg · Free delivery over Rp 250.000</p><div class="rating">★★★★☆ <span>87 reviews</span></div><div class="row"><span class="variant active">1 kg</span><span class="variant">2 kg</span></div><div class="row"><span class="qty"><button type="button">−</button><span>1</span><button type="button">+</button></span><button class="btn" type="button">Add to cart</button></div><div class="stockbar" title="Stock: 9"><i style="width:11%"></i></div><div class="delivery"><b>Delivery</b> · Bandung, 2–5 hari · Free returns 7 days</div></div>',
        ],
      },
      {
        path: '/keranjang/', title: 'Keranjang belanja',
        summary: 'Halaman keranjang statis untuk mendemonstrasikan alur e-commerce demo.',
        titleId: 'Keranjang belanja',
        summaryId: 'Halaman keranjang statis untuk mendemonstrasikan alur e-commerce demo.',
        kind: 'page', crumbs: ['Keranjang'],
        body: `
<h1>Keranjang</h1>
<p class="lede">Demo statis: tidak ada data yang dikirim atau disimpan.</p>
<table class="table striped">
  <thead><tr><th>Produk</th><th>Jumlah</th><th>Harga</th><th>Subtotal</th></tr></thead>
  <tbody>
    <tr><td>Kopi Gayo 250 g</td><td>2</td><td>Rp 95.000</td><td>Rp 190.000</td></tr>
    <tr><td>Teh Melati 100 g</td><td>1</td><td>Rp 42.000</td><td>Rp 42.000</td></tr>
    <tr><td>Kopi Toraja 250 g</td><td>1</td><td>Rp 110.000</td><td>Rp 110.000</td></tr>
  </tbody>
</table>
<table class="table"><tbody>
  <tr><th>Subtotal</th><td>Rp 342.000</td></tr>
  <tr><th>Diskon akhir pekan</th><td>−Rp 51.300</td></tr>
  <tr><th>Pengiriman</th><td>Gratis</td></tr>
  <tr><th>Total</th><td class="price">Rp 290.700</td></tr>
</tbody></table>
<p><button class="btn" type="button">Lanjut ke pembayaran (demo)</button> <a class="btn ghost" href="/produk/">Lanjut belanja</a></p>`
      },
      {
        path: '/kebijakan/', title: 'Kebijakan toko',
        summary: 'Pengiriman, pengembalian, privasi, dan kebijakan konten untuk agen AI.',
        titleId: 'Kebijakan toko',
        summaryId: 'Pengiriman, pengembalian, privasi, dan kebijakan konten untuk agen AI.',
        kind: 'page', crumbs: ['Kebijakan'],
        toc: [['kirim', 'Pengiriman'], ['kembali', 'Pengembalian'], ['privasi', 'Privasi'], ['agen', 'Kebijakan untuk agen']],
        body: `
<h1>Kebijakan</h1>
<section class="block" id="kirim"><h2>Pengiriman</h2><p>Dikirim dari Bandung dalam 1 hari kerja. Estimasi tiba 1–4 hari tergantung wilayah. Nomor lacak dikirim melalui email.</p></section>
<section class="block" id="kembali"><h2>Pengembalian</h2><p>Pengembalian diterima sampai 7 hari setelah barang diterima, kemasan belum dibuka.</p></section>
<section class="block" id="privasi"><h2>Privasi</h2><p>Demo ini tidak mengumpulkan data pribadi. Tidak ada formulir yang benar-benar mengirim data.</p></section>
<section class="block" id="agen"><h2>Kebijakan untuk agen AI</h2>
  <table class="table striped"><thead><tr><th>Penggunaan</th><th>Keputusan</th></tr></thead><tbody>
    <tr><td>search, retrieval, input</td><td><span class="tag ok">allow</span></td></tr>
    <tr><td>quote, summarize, translate</td><td><span class="tag ok">allow</span></td></tr>
    <tr><td>commercial_use, training, modify, embed</td><td><span class="tag no">deny</span></td></tr>
  </tbody></table>
</section>`
      },
      {
        path: '/tentang/', title: 'Tentang warung ini (demo)',
        summary: 'Toko fiktif untuk mendemonstrasikan profil e-commerce AIFeed.',
        titleId: 'Tentang warung ini (demo)',
        summaryId: 'Toko fiktif untuk mendemonstrasikan profil e-commerce AIFeed.',
        kind: 'page', crumbs: ['Tentang'],
        body: `
<h1>Tentang</h1>
<p class="lede">Warung Kopi Nusantara adalah toko fiktif. Tujuannya hanya satu: menunjukkan bagaimana situs e-commerce dapat menyatakan izin konten secara bertanda tangan, termasuk lampiran aset produk, tanpa kehilangan apa pun dari sisi manusia.</p>
<div class="timeline">
  <div class="step"><b>2019</b><span>Mulai dari satu petani mitra di Takengon.</span></div>
  <div class="step"><b>2023</b><span>Kemitraan diperluas ke Toraja dan Puncak.</span></div>
  <div class="step"><b>2026</b><span>Semua halaman toko ditandatangani dengan AIFeed.</span></div>
</div>`
      },
      {
        path: '/kontak/', title: 'Kontak',
        summary: 'Hubungi tim demo; jam layanan dan kanal komunikasi.',
        titleId: 'Kontak',
        summaryId: 'Hubungi tim demo; jam layanan dan kanal komunikasi.',
        kind: 'page', crumbs: ['Kontak'],
        body: `
<h1>Kontak</h1>
<table class="table"><tbody>
  <tr><th>Jam layanan</th><td>Senin–Jumat, 09.00–17.00 WIB</td></tr>
  <tr><th>WhatsApp</th><td>+62 812 0000 0000 (demo)</td></tr>
  <tr><th>Surel</th><td>halo@shop.aifeed.md (demo)</td></tr>
</tbody></table>
<section class="block">
  <h2>Kirim pesan (demo)</h2>
  <p style="color:var(--muted)">Formulir ini statis dan tidak mengirim data ke mana pun.</p>
  <p><input class="search" style="width:100%;max-width:420px;padding:11px 14px" placeholder="Nama" aria-label="Nama"> <input class="search" style="width:100%;max-width:420px;padding:11px 14px;margin-top:8px" placeholder="Email" aria-label="Email"></p>
  <p><button class="btn" type="button">Kirim (demo)</button></p>
</section>`
      }
    ],
    extraArt: [
      { name: 'shop-hero', kind: 'hero' },
      { name: 'produk-gayo', kind: 'product' }, { name: 'produk-toraja', kind: 'product' },
      { name: 'produk-melati', kind: 'product' }, { name: 'produk-hitam', kind: 'product' },
      { name: 'produk-aceh', kind: 'product' }, { name: 'produk-rumahan', kind: 'product' },
      { name: 'gayo-main', kind: 'product' }, { name: 'gayo-2', kind: 'product' }, { name: 'gayo-3', kind: 'product' },
      { name: 'toraja-main', kind: 'product' }, { name: 'melati-main', kind: 'product' },
      { name: 'hitam-main', kind: 'product' }, { name: 'aceh-main', kind: 'product' }, { name: 'rumahan-main', kind: 'product' }
    ],
    extraFiles: {
      'assets/datasheet-gayo.csv': 'atribut,nilai\norigin,Takengon\nroast,dark\nberat_g,250\nketinggian_mdpl,1400\n',
      'assets/tarif-pengiriman.csv': 'wilayah,estimasi_hari,biaya\nJabodetabek,1,15000\nJawa,2,22000\nLuar Jawa,4,38000\n'
    }
  },

  {
    sub: 'gov',
    domain: 'gov.aifeed.md',
    name: 'Portal Layanan Publik',
    type: 'government',
    locale: 'id',
    theme: { accent: '#1d70b8', accent2: '#0f5132' },
    mode: 'light',
    phase: { tag: 'BETA', text: 'This is a demo service.', href: '/kontak/', cta: 'Give feedback' },
    fonts: "'Inter',-apple-system,'Segoe UI',Roboto,sans-serif",
    headFonts: "'Archivo','Inter',sans-serif",
    fontCss: 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap',
    menuGroups: [
      ['groupServices', [
        { href: '/layanan/akta-kelahiran/', en: 'Birth certificates', id: 'Akta kelahiran', desc: 'Apply online in three working days' },
        { href: '/layanan/izin-usaha/', en: 'Micro-business permits', id: 'Izin usaha mikro', desc: 'One-day online registration' },
        { href: '/layanan/', en: 'All services', id: 'Semua layanan', desc: 'Targets, channels, and fees' }
      ]],
      ['groupAbout', [
        { href: '/pengumuman/', en: 'Announcements', id: 'Pengumuman', desc: 'Maintenance and tariff changes' },
        { href: '/peraturan/', en: 'Regulations', id: 'Peraturan', desc: 'Open documents with downloads' },
        { href: '/faq/', en: 'Questions', id: 'Pertanyaan', desc: 'Service and data policy answers' }
      ]]
    ],
    tagline: 'Layanan administrasi satu pintu (demo)',
    topContact: 'Call center 1500-000 · Senin–Jumat 08.00–15.00',
    search: true,
    ctaLabel: 'Daftar layanan',
    ctaHref: '/layanan/',
    permissions: { usage: { reproduce: 'allow' }, attribution: 'optional' },
    about: 'Portal pemerintah fiktif dengan kebijakan konten terbuka dan bertanda tangan.',
    nav: [['/', 'Beranda', 'Beranda'], ['/layanan/', 'Layanan', 'Layanan'], ['/pengumuman/', 'Pengumuman', 'Pengumuman'], ['/peraturan/', 'Peraturan', 'Peraturan'], ['/faq/', 'FAQ', 'FAQ'], ['/kontak/', 'Kontak', 'Kontak']],
    subnav: [['/layanan/', 'Semua layanan', 'Semua layanan'], ['/layanan/akta-kelahiran/', 'Akta kelahiran', 'Akta kelahiran'], ['/layanan/izin-usaha/', 'Izin usaha', 'Izin usaha'], ['/peraturan/', 'Unduhan', 'Unduhan'], ['/faq/', 'Pertanyaan umum', 'Pertanyaan umum']],
    footerCols: [
      ['servicesInfo', [['/layanan/', 'Daftar layanan'], ['/layanan/akta-kelahiran/', 'Akta kelahiran'], ['/layanan/izin-usaha/', 'Izin usaha mikro']]],
      ['information', [['/pengumuman/', 'Pengumuman'], ['/peraturan/', 'Peraturan'], ['/faq/', 'FAQ']]],
      ['forMachines', [['/.well-known/ai.json', 'Manifest'], ['/.well-known/aifeed-index.json', 'Indeks delta'], ['/llms.txt', 'llms.txt']]]
    ],
    newsletterTitle: 'newsletterAnnouncements',
    newsletterText: 'Pemberitahuan perubahan jadwal dan tarif. Demo statis: formulir tidak mengirim data.',
    pages: [
      {
        path: '/', title: 'Portal Layanan Publik — demo AIFeed',
        summary: 'Portal pemerintah fiktif dengan data terbuka, reproduksi diizinkan, dan kebijakan bertanda tangan.',
        titleId: 'Portal Layanan Publik — demo AIFeed',
        summaryId: 'Portal pemerintah fiktif dengan data terbuka, reproduksi diizinkan, dan kebijakan bertanda tangan.',
        kind: 'home', art: { name: 'gov-hero', kind: 'hero', caption: 'Materi publik boleh dikutip, direproduksi, dan diterjemahkan; atribusi opsional.' },
        stats: [['4', 'layanan daring'], ['3 hari', 'target tercepat'], ['100%', 'dokumen terbuka'], ['0', 'biaya akta & izin']],
        body: `
<section class="hero">
  <p class="eyebrow">gov.aifeed.md · demo</p>
  <h1>Layanan publik, data publik, aturan yang jelas</h1>
  <p class="lede">Dokumen publik di portal ini boleh dikutip, direproduksi, dan diterjemahkan — atribusi bersifat
  opsional. Pelatihan model tetap ditolak untuk materi yang memuat data pribadi.</p>
  <p><a class="btn" href="/layanan/">Lihat layanan</a> <a class="btn ghost" href="/pengumuman/">Pengumuman terbaru</a></p>
</section>
<section class="block">
  <h2>Layanan cepat</h2>
  <div class="grid four">
    <a class="card" href="/layanan/akta-kelahiran/"><div class="body"><h3>Akta kelahiran</h3><p>Daring · 3 hari · Gratis</p></div></a>
    <a class="card" href="/layanan/izin-usaha/"><div class="body"><h3>Izin usaha mikro</h3><p>Daring · 1 hari · Gratis</p></div></a>
    <a class="card" href="/layanan/"><div class="body"><h3>Kartu keluarga</h3><p>Loket · 5 hari · Gratis</p></div></a>
    <a class="card" href="/layanan/"><div class="body"><h3>Legalisasi dokumen</h3><p>Loket · 2 hari · Rp 5.000</p></div></a>
  </div>
</section>
<section class="block">
  <h2>Pengumuman terbaru</h2>
  <table class="table striped">
    <thead><tr><th>Tanggal</th><th>Pengumuman</th><th>Kategori</th></tr></thead>
    <tbody>
      <tr><td>22 Sep</td><td><a href="/pengumuman/pemeliharaan/">Pemeliharaan sistem akhir pekan ini</a></td><td><span class="tag warn">operasional</span></td></tr>
      <tr><td>18 Sep</td><td><a href="/pengumuman/tarif/">Penyesuaian tarif legalisasi dokumen</a></td><td><span class="tag info">tarif</span></td></tr>
      <tr><td>10 Sep</td><td><a href="/pengumuman/pemeliharaan/">Perluasan jam layanan loket</a></td><td><span class="tag ok">layanan</span></td></tr>
    </tbody>
  </table>
</section>
<div class="banner"><strong>Keterbukaan data</strong><small>Seluruh peraturan dan tarif tersedia sebagai berkas yang dapat diunduh, dan terlampir pada indeks AIFeed sebagai <em>assets</em>. <a href="/peraturan/">Lihat unduhan →</a></small></div>`,
        bodyId: `
<section class="hero">
  <p class="eyebrow">gov.aifeed.md · demo</p>
  <h1>Layanan publik, data publik, aturan yang jelas</h1>
  <p class="lede">Dokumen publik di portal ini boleh dikutip, direproduksi, dan diterjemahkan — atribusi bersifat opsional. Pelatihan model tetap ditolak untuk materi yang memuat data pribadi.</p>
  <p><a class="btn" href="/id/layanan/">Lihat layanan</a> <a class="btn ghost" href="/id/pengumuman/">Pengumuman terbaru</a></p>
</section>
<section class="block">
  <h2>Layanan cepat</h2>
  <div class="grid four">
    <a class="card" href="/id/layanan/akta-kelahiran/"><div class="body"><h3>Akta kelahiran</h3><p>Daring · 3 hari · Gratis</p></div></a>
    <a class="card" href="/id/layanan/izin-usaha/"><div class="body"><h3>Izin usaha mikro</h3><p>Daring · 1 hari · Gratis</p></div></a>
    <a class="card" href="/id/layanan/"><div class="body"><h3>Kartu keluarga</h3><p>Loket · 5 hari · Gratis</p></div></a>
    <a class="card" href="/id/layanan/"><div class="body"><h3>Legalisasi dokumen</h3><p>Loket · 2 hari · Rp 5.000</p></div></a>
  </div>
</section>`,
        newsletter: true
      },
      {
        path: '/layanan/', title: 'Daftar layanan',
        summary: 'Layanan administrasi dengan target waktu dan kanal pengajuan.',
        titleId: 'Daftar layanan',
        summaryId: 'Layanan administrasi dengan target waktu dan kanal pengajuan.',
        kind: 'listing', crumbs: ['Layanan'],
        aside: ['<div class="toc"><h4>Populer</h4><a href="/layanan/akta-kelahiran/">Akta kelahiran</a><a href="/layanan/izin-usaha/">Izin usaha mikro</a></div>'],
        body: `
<h1>Daftar layanan</h1>
<p class="lede">Empat layanan contoh dengan target waktu yang dipublikasikan.</p>
<table class="table striped">
  <thead><tr><th>Layanan</th><th>Kanal</th><th>Target</th><th>Biaya</th><th>Detail</th></tr></thead>
  <tbody>
    <tr><td>Akta kelahiran</td><td>Online</td><td>3 hari kerja</td><td>Gratis</td><td><a href="/layanan/akta-kelahiran/">Buka</a></td></tr>
    <tr><td>Izin usaha mikro</td><td>Online</td><td>1 hari kerja</td><td>Gratis</td><td><a href="/layanan/izin-usaha/">Buka</a></td></tr>
    <tr><td>Kartu keluarga (perubahan)</td><td>Loket</td><td>5 hari kerja</td><td>Gratis</td><td>—</td></tr>
    <tr><td>Legalisasi dokumen</td><td>Loket</td><td>2 hari kerja</td><td>Rp 5.000</td><td>—</td></tr>
  </tbody>
</table>
<div class="filters"><a class="active" href="/layanan/">Semua</a><a href="/layanan/">Daring</a><a href="/layanan/">Loket</a></div>`
      },
      {
        path: '/layanan/akta-kelahiran/', title: 'Akta kelahiran — layanan daring',
        summary: 'Syarat, langkah, dan target waktu penerbitan akta kelahiran.',
        titleId: 'Akta kelahiran — layanan daring',
        summaryId: 'Syarat, langkah, dan target waktu penerbitan akta kelahiran.',
        kind: 'service', crumbs: ['Layanan', 'Akta kelahiran'], crumbsHrefs: ['/layanan/'],
        aside: ['<div class="toc"><h4>Isi halaman</h4><a href="#syarat">Syarat</a><a href="#langkah">Langkah</a><a href="#biaya">Biaya</a></div>'],
        body: `
<h1>Akta kelahiran</h1>
<p><a class="startbtn" href="/kontak/">Start now →</a></p>
<p class="meta"><span class="tag ok">Daring</span><span class="tag">Target 3 hari kerja</span><span class="tag">Gratis</span></p>
<h2 id="syarat">Syarat</h2>
<ul class="list">
  <li>Surat keterangan lahir dari fasilitas kesehatan atau bidan.</li>
  <li>Kartu keluarga dan KTP kedua orang tua.</li>
  <li>Buku nikah atau akta perkawinan.</li>
</ul>
<h2 id="langkah">Langkah</h2>
<ol class="flow-v">
  <li>Unggah dokumen melalui kanal daring.</li>
  <li>Verifikasi petugas paling lambat 1 hari kerja.</li>
  <li>Penerbitan akta dan notifikasi pengambilan.</li>
</ol>
<h2 id="biaya">Biaya</h2>
<p>Tidak ada biaya. Pungutan di luar ketentuan dapat dilaporkan melalui kanal pengaduan.</p>
<div class="note">Halaman ini dan berkas pendukungnya bersifat terbuka: reproduksi dan penerjemahan diizinkan, atribusi opsional.</div>`
      },
      {
        path: '/layanan/izin-usaha/', title: 'Izin usaha mikro — layanan daring',
        summary: 'Pendaftaran izin usaha mikro dengan target satu hari kerja.',
        titleId: 'Izin usaha mikro — layanan daring',
        summaryId: 'Pendaftaran izin usaha mikro dengan target satu hari kerja.',
        kind: 'service', crumbs: ['Layanan', 'Izin usaha mikro'], crumbsHrefs: ['/layanan/'],
        aside: ['<div class="toc"><h4>Isi halaman</h4><a href="#syarat">Syarat</a><a href="#langkah">Langkah</a></div>'],
        body: `
<h1>Izin usaha mikro</h1>
<p><a class="startbtn" href="/kontak/">Start now →</a></p>
<p class="meta"><span class="tag ok">Daring</span><span class="tag">Target 1 hari kerja</span><span class="tag">Gratis</span></p>
<h2 id="syarat">Syarat</h2>
<ul class="list"><li>KTP pemilik usaha.</li><li>Alamat usaha (boleh rumah tinggal).</li><li>Deskripsi singkat kegiatan usaha.</li></ul>
<h2 id="langkah">Langkah</h2>
<ol class="flow-v"><li>Isi formulir daring.</li><li>Verifikasi otomatis data kependudukan.</li><li>Izin terbit dan dapat diunduh.</li></ol>`
      },
      {
        path: '/pengumuman/', title: 'Pengumuman',
        summary: 'Jadwal pemeliharaan, perubahan tarif, dan pengumuman resmi lainnya.',
        titleId: 'Pengumuman',
        summaryId: 'Jadwal pemeliharaan, perubahan tarif, dan pengumuman resmi lainnya.',
        kind: 'listing', crumbs: ['Pengumuman'],
        body: `
<h1>Pengumuman</h1>
<table class="table striped">
  <thead><tr><th>Tanggal</th><th>Judul</th><th>Kategori</th></tr></thead>
  <tbody>
    <tr><td>22 Sep 2026</td><td><a href="/pengumuman/pemeliharaan/">Pemeliharaan sistem akhir pekan ini</a></td><td><span class="tag warn">operasional</span></td></tr>
    <tr><td>18 Sep 2026</td><td><a href="/pengumuman/tarif/">Penyesuaian tarif legalisasi dokumen</a></td><td><span class="tag info">tarif</span></td></tr>
    <tr><td>10 Sep 2026</td><td>Perluasan jam layanan loket</td><td><span class="tag ok">layanan</span></td></tr>
  </tbody>
</table>`
      },
      {
        path: '/pengumuman/pemeliharaan/', title: 'Pemeliharaan sistem akhir pekan ini',
        summary: 'Layanan daring berhenti sementara Sabtu 22.00–24.00 WIB.',
        titleId: 'Pemeliharaan sistem akhir pekan ini',
        summaryId: 'Layanan daring berhenti sementara Sabtu 22.00–24.00 WIB.',
        kind: 'service', crumbs: ['Pengumuman', 'Pemeliharaan'], crumbsHrefs: ['/pengumuman/'],
        body: `
<h1>Pemeliharaan sistem akhir pekan ini</h1>
<p class="meta"><span class="tag warn">operasional</span><span>22 Sep 2026</span></p>
<p class="lede">Sabtu, 22.00–24.00 WIB. Layanan loket tetap buka seperti biasa.</p>
<p>Pemeliharaan mencakup basis data kependudukan dan antarmuka pengajuan daring. Pengajuan yang sedang berjalan tidak akan hilang; statusnya tertunda sampai layanan kembali.</p>
<div class="timeline">
  <div class="step"><b>22.00</b><span>Layanan daring dihentikan sementara.</span></div>
  <div class="step"><b>23.00</b><span>Migrasi basis data dan pengujian internal.</span></div>
  <div class="step"><b>24.00</b><span>Layanan dibuka kembali; antrean diproses otomatis.</span></div>
</div>`
      },
      {
        path: '/pengumuman/tarif/', title: 'Penyesuaian tarif legalisasi dokumen',
        summary: 'Tarif legalisasi menjadi Rp 5.000 per dokumen mulai bulan depan.',
        titleId: 'Penyesuaian tarif legalisasi dokumen',
        summaryId: 'Tarif legalisasi menjadi Rp 5.000 per dokumen mulai bulan depan.',
        kind: 'service', crumbs: ['Pengumuman', 'Tarif'], crumbsHrefs: ['/pengumuman/'],
        body: `
<h1>Penyesuaian tarif legalisasi dokumen</h1>
<p class="meta"><span class="tag info">tarif</span><span>18 Sep 2026</span></p>
<p>Sejalan dengan peraturan daerah terbaru, tarif legalisasi dokumen disesuaikan dari Rp 3.000 menjadi Rp 5.000 per dokumen, efektif bulan depan. Layanan lain tidak berubah.</p>
<table class="table"><thead><tr><th>Layanan</th><th>Tarif lama</th><th>Tarif baru</th></tr></thead><tbody>
  <tr><td>Legalisasi dokumen</td><td>Rp 3.000</td><td>Rp 5.000</td></tr>
  <tr><td>Akta kelahiran</td><td>Gratis</td><td>Gratis</td></tr>
</tbody></table>`
      },
      {
        path: '/peraturan/', title: 'Peraturan dan unduhan',
        summary: 'Peraturan daerah dengan lampiran yang dapat diunduh mesin.',
        titleId: 'Peraturan dan unduhan',
        summaryId: 'Peraturan daerah dengan lampiran yang dapat diunduh mesin.',
        kind: 'page', crumbs: ['Peraturan'],
        aside: ['<div class="toc"><h4>Unduhan</h4><a href="/assets/perda-7-2026.txt" download>Perda 7/2026 (txt)</a><a href="/assets/tarif-layanan.csv" download>Tarif layanan (csv)</a></div>'],
        body: `
<h1>Peraturan</h1>
<p class="lede">Materi peraturan bersifat publik. Reproduksi dan penerjemahan diizinkan; atribusi opsional.</p>
<table class="table striped">
  <thead><tr><th>Peraturan</th><th>Ringkas</th><th>Berkas</th></tr></thead>
  <tbody>
    <tr><td>Perda No. 7/2026</td><td>Keterbukaan data publik</td><td><a href="/assets/perda-7-2026.txt" download>txt</a></td></tr>
    <tr><td>Tarif layanan</td><td>Daftar tarif terbaru</td><td><a href="/assets/tarif-layanan.csv" download>csv</a></td></tr>
  </tbody>
</table>
<div class="note">Semua berkas di atas terlampir sebagai <strong>assets</strong> pada indeks AIFeed, sehingga agen tahu apa yang tersedia sebelum mengunduh.</div>`
      },
      {
        path: '/faq/', title: 'Pertanyaan umum',
        summary: 'Jawaban singkat untuk pertanyaan layanan dan kebijakan data.',
        titleId: 'Pertanyaan umum',
        summaryId: 'Jawaban singkat untuk pertanyaan layanan dan kebijakan data.',
        kind: 'page', crumbs: ['FAQ'],
        faq: [
          ['Apakah data saya diproses demo ini?', 'Tidak. Semua formulir statis dan tidak mengirim data ke mana pun.'],
          ['Bolehkah agen AI mengutip pengumuman ini?', 'Boleh, dengan atribusi opsional. Reproduksi dan penerjemahan diizinkan pada manifest bertanda tangan.'],
          ['Bagaimana cara memverifikasi kebijakan portal?', 'Buka manifest di <code>/.well-known/ai.json</code> atau jalankan verifier di verify.aifeed.md.']
        ],
        body: `
<h1>Pertanyaan umum</h1>
<p class="lede">Tiga pertanyaan yang paling sering muncul tentang demo ini.</p>`
      },
      {
        path: '/kontak/', title: 'Kontak',
        summary: 'Jam layanan, kanal pengaduan, dan lokasi kantor (demo).',
        titleId: 'Kontak',
        summaryId: 'Jam layanan, kanal pengaduan, dan lokasi kantor (demo).',
        kind: 'page', crumbs: ['Kontak'],
        body: `
<h1>Kontak</h1>
<table class="table striped"><tbody>
  <tr><th>Loket</th><td>Senin–Jumat, 08.00–15.00 WIB</td></tr>
  <tr><th>Call center</th><td>1500-000 (demo)</td></tr>
  <tr><th>Pengaduan</th><td>aduan@gov.aifeed.md (demo)</td></tr>
</tbody></table>
<div class="note">Formulir pengaduan daring tersedia di kanal resmi. Demo ini tidak menyediakan formulir yang benar-benar berfungsi.</div>`
      }
    ],
    extraArt: [
      { name: 'gov-hero', kind: 'hero' }
    ],
    extraFiles: {
      'assets/perda-7-2026.txt': 'PERATURAN DAERAH No. 7/2026 (DEMO)\nTentang keterbukaan data publik\n\nPasal 1\n(1) Setiap dokumen publik dapat diakses, dikutip, dan direproduksi.\n(2) Atribusi bersifat opsional.\n',
      'assets/tarif-layanan.csv': 'layanan,tarif\nAkta kelahiran,0\nIzin usaha mikro,0\nLegalisasi dokumen,5000\n'
    }
  },

  {
    sub: 'strict',
    domain: 'strict.aifeed.md',
    name: 'Strict Origin',
    type: 'other',
    locale: 'en',
    theme: { accent: '#ff6b6b', accent2: '#ffb454' },
    mode: 'dark',
    fonts: "'Inter',-apple-system,'Segoe UI',Roboto,sans-serif",
    headFonts: "'Space Grotesk','Inter',sans-serif",
    mono: "'JetBrains Mono',ui-monospace,Consolas,monospace",
    fontCss: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap',
    tagline: 'Search indexing only — enforced at the edge',
    topContact: 'policy@strict.aifeed.md',
    search: false,
    ctaLabel: 'Read the policy',
    ctaHref: '/policy/',
    permissions: {
      usage: {
        retrieval: 'deny', input: 'deny', quote: 'deny', summarize: 'deny',
        reproduce: 'deny', translate: 'deny', training: 'deny', modify: 'deny',
        embed: 'deny', commercial_use: 'deny'
      }
    },
    about: 'A restrictive publisher: search allowed, everything else denied, with live 403 and 429 responses.',
    nav: [['/', 'Overview', 'Ringkasan'], ['/policy/', 'Policy', 'Kebijakan'], ['/enforcement/', 'Enforcement', 'Penegakan'], ['/developers/', 'Developers', 'Pengembang'], ['/faq/', 'FAQ', 'FAQ']],
    footerCols: [
      ['policyCol', [['/policy/', 'Permission table'], ['/enforcement/', 'Live enforcement']]],
      ['developersCol', [['/developers/', 'Client recipes'], ['/.well-known/ai.json', 'Manifest']]],
      ['compare', [['https://demo.aifeed.md', 'Permissive demo'], ['https://revoked.aifeed.md', 'Revocation demo']]]
    ],
    pages: [
      {
        path: '/', title: 'Strict Origin — search only, enforced at the edge',
        summary: 'A restrictive publisher: search allowed, everything else denied, with live 403 and 429 responses.',
        titleId: 'Strict Origin — hanya pencarian, ditegakkan di edge',
        summaryId: 'Penerbit restriktif: pencarian diizinkan, sisanya ditolak, dengan respons 403 dan 429 langsung.',
        kind: 'home', art: { name: 'strict-hero', kind: 'hero', caption: 'Declared policy and enforced behaviour are the same thing here.' },
        stats: [['403', 'for training crawlers'], ['429', 'for non-compliant crawlers'], ['200', 'for compliant clients'], ['1', 'allowed use: search']],
        body: `
<section class="hero">
  <p class="eyebrow">strict.aifeed.md</p>
  <h1>Search only. Enforced, not merely declared.</h1>
  <p class="lede">This origin allows search indexing and nothing else. Training crawlers get 403.
  Non-compliant crawlers get 429 with a Retry-After. Compliant clients that negotiate markdown get signed content.</p>
  <p><a class="btn" href="/enforcement/">Reproduce the responses</a> <a class="btn ghost" href="/policy/">Read the policy</a></p>
</section>
<section class="block">
  <h2>What happens when you knock</h2>
  <table class="table striped">
    <thead><tr><th>Client</th><th>Signal</th><th>Response</th></tr></thead>
    <tbody>
      <tr><td>Training crawler</td><td>Known training user agents</td><td><span class="tag no">403</span> with a JSON reason</td></tr>
      <tr><td>Compliant agent</td><td><code>Accept: text/aifeed+markdown</code></td><td><span class="tag ok">200</span> signed content</td></tr>
      <tr><td>Unknown crawler</td><td>No AIFeed negotiation</td><td><span class="tag warn">429</span> + <code>Retry-After: 60</code></td></tr>
      <tr><td>Human reader</td><td><code>Accept: text/html</code></td><td><span class="tag ok">200</span> normal page</td></tr>
    </tbody>
  </table>
</section>
<div class="banner"><strong>This demo behaviour runs in a Cloudflare Pages Function</strong><small>The production reference is the same policy shipped as nginx/Caddy templates in <code>integrations/</code>.</small></div>`,
        bodyId: `
<section class="hero">
  <p class="eyebrow">strict.aifeed.md</p>
  <h1>Hanya pencarian. Ditegakkan, bukan sekadar dideklarasikan.</h1>
  <p class="lede">Origin ini mengizinkan indeks pencarian dan tidak yang lain. Crawler pelatihan mendapat 403. Crawler tidak patuh mendapat 429 dengan Retry-After. Klien patuh yang menegosiasikan markdown mendapat konten bertanda tangan.</p>
  <p><a class="btn" href="/id/enforcement/">Reproduksi responsnya</a> <a class="btn ghost" href="/id/policy/">Baca kebijakan</a></p>
</section>`,
        aside: [
          "<div class=\"buybox\"><div class=\"price\">Rp 110.000</div><p class=\"per\">250 g · Free delivery over Rp 250.000</p><div class=\"rating\">★★★★☆ <span>74 reviews</span></div><div class=\"row\"><span class=\"variant active\">250 g</span><span class=\"variant\">500 g</span></div><div class=\"row\"><span class=\"qty\"><button type=\"button\">-</button><span>1</span><button type=\"button\">+</button></span><button class=\"btn\" type=\"button\">Add to cart</button></div><div class=\"stockbar\" title=\"Stock: 18\"><i style=\"width:23%\"></i></div><div class=\"delivery\"><b>Delivery</b> - Bandung, 2-5 hari - Free returns 7 days</div></div>",
        ],
      },
      {
        path: '/policy/', title: 'Policy — search only',
        summary: 'The full signed permission table for this origin.',
        titleId: 'Kebijakan — hanya pencarian',
        summaryId: 'Tabel izin bertanda tangan lengkap untuk origin ini.',
        kind: 'page', crumbs: ['Policy'],
        toc: [['table', 'Permission table'], ['limits', 'Limits'], ['manifest', 'Manifest excerpt']],
        body: `
<h1>Policy</h1>
<p class="lede">Everything except search is denied. The manifest is the contract; the edge is the referee.</p>
<h2 id="table">Permission table</h2>
<table class="table striped">
  <thead><tr><th>Use</th><th>Decision</th><th>Rationale</th></tr></thead>
  <tbody>
    <tr><td>search</td><td><span class="tag ok">allow</span></td><td>Discovery is welcome.</td></tr>
    <tr><td>retrieval, input</td><td><span class="tag no">deny</span></td><td>Full-text use is not granted.</td></tr>
    <tr><td>quote, summarize, reproduce, translate</td><td><span class="tag no">deny</span></td><td>Derived output is not granted.</td></tr>
    <tr><td>training, modify, embed, commercial_use</td><td><span class="tag no">deny</span></td><td>Model and commercial uses are not.</td></tr>
  </tbody>
</table>
<h2 id="limits">Limits</h2>
<ul class="list"><li>60 requests per minute, 2 concurrent, 1 second crawl delay.</li><li>Rate limiting is enforced, not advisory: exceeding it returns 429 + <code>Retry-After</code>.</li></ul>
<h2 id="manifest">Manifest excerpt</h2>
<pre><code>{
  "permissions": { "default": "deny", "usage": { "search": "allow" } },
  "limits": { "requests_per_minute": 60, "concurrent": 2, "crawl_delay_seconds": 1 }
}</code></pre>`
      },
      {
        path: '/enforcement/', title: 'Enforcement — reproduce the 403 and 429',
        summary: 'Copy-paste commands that trigger each enforcement branch.',
        titleId: 'Penegakan — reproduksi 403 dan 429',
        summaryId: 'Perintah salin-tempel yang memicu setiap cabang penegakan.',
        kind: 'page', crumbs: ['Enforcement'],
        faq: [
          ['Does this block search engines?', 'No. Search crawlers that identify themselves normally and request HTML are served the page. The policy targets training and abusive crawling.'],
          ['What should a compliant agent do on 429?', 'Wait at least the Retry-After interval, then negotiate <code>text/aifeed+markdown</code> and read the signed manifest.']
        ],
        body: `
<h1>Reproduce the enforcement</h1>
<div class="grid">
  <div class="card"><div class="body">
    <h3><span class="tag no">403</span> training crawler</h3>
    <pre><code>curl -i -A 'GPTBot/1.0' https://strict.aifeed.md/
# HTTP/2 403
# {"error":"training_not_permitted","manifest":"https://strict.aifeed.md/.well-known/ai.json"}</code></pre>
  </div></div>
  <div class="card"><div class="body">
    <h3><span class="tag warn">429</span> non-compliant crawler</h3>
    <pre><code>curl -i -A 'Scrapy/2.11' https://strict.aifeed.md/
# HTTP/2 429
# retry-after: 60</code></pre>
  </div></div>
  <div class="card"><div class="body">
    <h3><span class="tag ok">200</span> compliant client</h3>
    <pre><code>curl -i -H 'Accept: text/aifeed+markdown' https://strict.aifeed.md/
# content-type: text/aifeed+markdown
# x-aifeed-signature: aimd1:...</code></pre>
  </div></div>
</div>
<div class="note">Responses include CORS headers for the browser verifier at <a href="https://verify.aifeed.md">verify.aifeed.md</a>.</div>`
      },
      {
        path: '/developers/', title: 'Developers — client recipes',
        summary: 'How compliant clients behave against a restrictive origin.',
        titleId: 'Pengembang — resep klien',
        summaryId: 'Bagaimana klien patuh berperilaku terhadap origin restriktif.',
        kind: 'docs', crumbs: ['Developers'],
        toc: [['curl', 'curl'], ['node', 'Node'], ['python', 'Python']],
        body: `
<h1>Client recipes</h1>
<h2 id="curl">curl</h2>
<pre><code>curl -s -H 'Accept: text/aifeed+markdown' https://strict.aifeed.md/.well-known/ai.json</code></pre>
<h2 id="node">Node</h2>
<pre><code>const sdk = require('@aifeed/verify');
const out = await sdk.fetchAimd('https://strict.aifeed.md/', { publicKeyValue });
// search-only policy: expect retrieval to be denied by decideUsage</code></pre>
<h2 id="python">Python</h2>
<pre><code># clients/python ships the independent verifier
python -m unittest discover -s clients/python/tests -t clients/python</code></pre>
<ol class="flow-v">
  <li>Fetch the manifest before any content request.</li>
  <li>Honour <code>search</code>-only grants; stop when a use is denied.</li>
  <li>Back off on 429; never rotate identifiers to evade.</li>
</ol>`
      },
      {
        path: '/faq/', title: 'FAQ — strict policy',
        summary: 'Why a publisher would allow search and nothing else.',
        titleId: 'FAQ — kebijakan ketat',
        summaryId: 'Mengapa penerbit memilih mengizinkan pencarian saja.',
        kind: 'page', crumbs: ['FAQ'],
        faq: [
          ['Why allow search but deny retrieval?', 'Search sends visitors to the origin; retrieval can substitute for it. This publisher draws the line there, and the line is signed.'],
          ['Is 403 permanent?', 'The status is tied to the declared policy. Changing the manifest changes the enforcement without any client update.'],
          ['Can an agent appeal?', 'Yes. The manifest carries a contact address; enforcement is policy, not punishment.']
        ],
        body: `
<h1>FAQ</h1>
<p class="lede">The questions reviewers ask first about a restrictive origin.</p>`
      }
    ],
    extraArt: [
      { name: 'strict-hero', kind: 'hero' }
    ]
  },

  {
    sub: 'revoked',
    domain: 'revoked.aifeed.md',
    name: 'Revocation Registry Demo',
    type: 'blog',
    locale: 'en',
    theme: { accent: '#8f7bff', accent2: '#ff6b6b' },
    mode: 'dark',
    fonts: "'Inter',-apple-system,'Segoe UI',Roboto,sans-serif",
    headFonts: "'Space Grotesk','Inter',sans-serif",
    mono: "'JetBrains Mono',ui-monospace,Consolas,monospace",
    fontCss: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap',
    tagline: 'Multi-signature status, bounded staleness',
    topContact: 'governance@aifeed.md',
    search: false,
    ctaLabel: 'Open the registry',
    ctaHref: '/registry/',
    about: 'A registry demonstration: two governance keys, two states, and well-behaved clients.',
    nav: [['/', 'Overview', 'Ringkasan'], ['/registry/', 'Registry', 'Registry'], ['/guide/', 'Client guide', 'Panduan klien'], ['/timeline/', 'Timeline', 'Linimasa'], ['/faq/', 'FAQ', 'FAQ']],
    footerCols: [
      ['registryCol', [['/registry/', 'Documents'], ['/revocation/active.json', 'active.json'], ['/revocation/suspended.json', 'suspended.json']]],
      ['clients', [['/guide/', 'What clients do'], ['/developers/', 'Verify code']]],
      ['compare', [['https://strict.aifeed.md', 'Enforcement demo'], ['https://demo.aifeed.md', 'Healthy origin']]]
    ],
    pages: [
      {
        path: '/', title: 'Revocation Registry Demo',
        summary: 'Watch a multi-signature status document suspend an origin, and see what compliant clients do.',
        titleId: 'Demo Registry Revokasi',
        summaryId: 'Saksikan dokumen status multi-tanda tangan menangguhkan origin, dan lihat respons klien patuh.',
        kind: 'home', art: { name: 'revoked-hero', kind: 'hero', caption: 'Two governance keys must agree; one compromised key changes nothing.' },
        stats: [['2 of 2', 'signatures required'], ['168 h', 'staleness bound'], ['2', 'published states'], ['1', 'origin suspended in this demo']],
        body: `
<section class="hero">
  <p class="eyebrow">revoked.aifeed.md</p>
  <h1>Revocation with receipts</h1>
  <p class="lede">This origin demonstrates the registry side of AIFeed: multi-signature status documents,
  bounded staleness, and client behaviour when yesterday's VERIFIED becomes today's SUSPENDED.</p>
  <p><a class="btn" href="/registry/">See both registry states</a> <a class="btn ghost" href="/guide/">What clients do</a></p>
</section>
<section class="block">
  <h2>The document</h2>
  <pre><code>{
  "version": "0.1",
  "domain": "revoked.aifeed.md",
  "status": "suspended",
  "reason": "abuse_investigation",
  "revoked_by": "aifeed-demo-governance",
  "keys": [ { "fingerprint": "sha256:..." }, { "fingerprint": "sha256:..." } ],
  "signatures": [ { "...": "two of two required" } ]
}</code></pre>
</section>
<section class="block">
  <h2>Why two keys</h2>
  <div class="grid two">
    <div class="card"><div class="body"><h3>No single point of failure</h3><p>A compromised key cannot revoke an origin on its own — or restore one that was suspended.</p></div></div>
    <div class="card"><div class="body"><h3>Bounded staleness</h3><p>If the registry is unreachable for more than 168 hours, clients downgrade to UNVERIFIED instead of assuming consent.</p></div></div>
  </div>
</section>`,
        bodyId: `
<section class="hero">
  <p class="eyebrow">revoked.aifeed.md</p>
  <h1>Revokasi dengan bukti</h1>
  <p class="lede">Origin ini mendemonstrasikan sisi registry AIFeed: dokumen status multi-tanda tangan, batas kedaluwarsa, dan perilaku klien ketika VERIFIED kemarin menjadi SUSPENDED hari ini.</p>
  <p><a class="btn" href="/id/registry/">Lihat kedua status</a> <a class="btn ghost" href="/id/guide/">Apa yang dilakukan klien</a></p>
</section>`,
        aside: [
          "<div class=\"buybox\"><div class=\"price\">Rp 42.000</div><p class=\"per\">100 g · Free delivery over Rp 250.000</p><div class=\"rating\">★★★★★ <span>203 reviews</span></div><div class=\"row\"><span class=\"variant active\">100 g</span><span class=\"variant\">250 g</span></div><div class=\"row\"><span class=\"qty\"><button type=\"button\">-</button><span>1</span><button type=\"button\">+</button></span><button class=\"btn\" type=\"button\">Add to cart</button></div><div class=\"stockbar\" title=\"Stock: 77\"><i style=\"width:96%\"></i></div><div class=\"delivery\"><b>Delivery</b> - Bandung, 1-3 hari - Free returns 7 days</div></div>",
        ],
      },
      {
        path: '/registry/', title: 'Registry states',
        summary: 'Active and suspended registry documents with governance fingerprints.',
        titleId: 'Status registry',
        summaryId: 'Dokumen registry aktif dan ditangguhkan beserta fingerprint governance.',
        kind: 'page', crumbs: ['Registry'],
        toc: [['states', 'States'], ['keys', 'Governance keys'], ['documents', 'Raw documents']],
        aside: [
          '<div class="toc"><h4>Documents</h4><a href="/revocation/active.json">active.json</a><a href="/revocation/suspended.json">suspended.json</a></div>'
        ],
        body: `
<h1>Registry</h1>
<h2 id="states">States</h2>
<table class="table striped">
  <thead><tr><th>State</th><th>Document</th><th>Effect on clients</th></tr></thead>
  <tbody>
    <tr><td><span class="tag ok">active</span></td><td><a href="/revocation/active.json">/revocation/active.json</a></td><td>Manifest may be used according to policy.</td></tr>
    <tr><td><span class="tag no">suspended</span></td><td><a href="/revocation/suspended.json">/revocation/suspended.json</a></td><td>Restricted uses are refused until status changes.</td></tr>
  </tbody>
</table>
<h2 id="keys">Governance keys</h2>
<table class="table"><thead><tr><th>Key</th><th>Fingerprint</th><th>Role</th></tr></thead><tbody>
  <tr><td>demo-gov-1</td><td><code>sha256:NQixB-4QBXAgg…</code></td><td>Primary</td></tr>
  <tr><td>demo-gov-2</td><td><code>sha256:…</code></td><td>Secondary</td></tr>
</tbody></table>
<h2 id="documents">Raw documents</h2>
<pre><code>curl https://revoked.aifeed.md/revocation/suspended.json | head -20</code></pre>
<div class="note">Both documents are located through the manifest's <code>revocation.list_url</code> — clients never hard-code paths.</div>`
      },
      {
        path: '/guide/', title: 'Client guide — what to do on SUSPENDED',
        summary: 'The five-step reaction a compliant agent follows when status changes.',
        titleId: 'Panduan klien — tindakan saat SUSPENDED',
        summaryId: 'Lima langkah yang diikuti agen patuh ketika status berubah.',
        kind: 'docs', crumbs: ['Client guide'],
        toc: [['steps', 'The five steps'], ['code', 'In code'], ['bundles', 'Audit bundles']],
        body: `
<h1>What a compliant client does</h1>
<h2 id="steps">The five steps</h2>
<ol class="flow-v">
  <li>Re-check the registry URL from the manifest before using restricted content.</li>
  <li>Verify the document's signatures against the published governance keys.</li>
  <li>If status is <code>suspended</code>, treat restricted uses as denied immediately.</li>
  <li>If the registry is unreachable for more than 168 hours, downgrade to <code>UNVERIFIED</code>.</li>
  <li>Keep the document in the audit bundle; never silently fall back to HTML scraping.</li>
</ol>
<h2 id="code">In code</h2>
<pre><code>node examples/agent/compliant-agent.js https://revoked.aifeed.md --json
# status: SUSPENDED → restricted uses refused</code></pre>
<h2 id="bundles">Audit bundles</h2>
<p>The offline bundle records the manifest, signatures, and the registry document as it was seen, so a later review can reconstruct exactly why a decision was made.</p>`
      },
      {
        path: '/timeline/', title: 'Timeline of a revocation event',
        summary: 'From the first report to the status change, with the evidence each step leaves behind.',
        titleId: 'Linimasa peristiwa revokasi',
        summaryId: 'Dari laporan pertama hingga perubahan status, dengan bukti di tiap langkah.',
        kind: 'page', crumbs: ['Timeline'],
        body: `
<h1>Timeline of a revocation event</h1>
<div class="timeline">
  <div class="step"><b>Day 0 · report</b><span>An abuse report arrives with evidence. Nothing changes yet; the registry still says active.</span></div>
  <div class="step"><b>Day 1 · review</b><span>Status moves to <code>under_review</code>. Clients warn but do not refuse.</span></div>
  <div class="step"><b>Day 3 · suspension</b><span>Two governance keys sign <code>suspended</code>. Restricted uses stop immediately.</span></div>
  <div class="step"><b>Day 30 · resolution</b><span>Either restored with a new key, or revoked permanently; both outcomes are signed.</span></div>
</div>
<p class="note">Every state change is a signed document with a timestamp, so the timeline is reconstructible by anyone.</p>`
      },
      {
        path: '/developers/', title: 'Developers — verify the registry',
        summary: 'Ten lines of Node that verify a registry document.',
        titleId: 'Pengembang — verifikasi registry',
        summaryId: 'Sepuluh baris Node untuk memverifikasi dokumen registry.',
        kind: 'docs', crumbs: ['Developers'],
        body: `
<h1>Verify the registry</h1>
<pre><code>const { verifyRevocationDocument } = require('./lib/revocation');
const document = await fetch('https://revoked.aifeed.md/revocation/suspended.json').then(r => r.text());
const result = verifyRevocationDocument(document, {
  domain: 'revoked.aifeed.md',
  governanceKeys: ['ed25519:...', 'ed25519:...']
});
console.log(result.result, result.status); // valid suspended</code></pre>
<p>The verifier checks the threshold, fingerprints, expiry, and domain binding before reporting a status.</p>`
      },
      {
        path: '/faq/', title: 'FAQ — revocation',
        summary: 'Thresholds, appeals, and what happens during registry outages.',
        titleId: 'FAQ — revokasi',
        summaryId: 'Ambang batas, banding, dan apa yang terjadi saat registry down.',
        kind: 'page', crumbs: ['FAQ'],
        faq: [
          ['What stops a governance key from going rogue?', 'The threshold: a status change needs two independent keys. Governance process and key rotation are documented separately.'],
          ['What if the registry is down?', 'After 168 hours clients treat status as UNVERIFIED; before that, the last signed document stands.'],
          ['Who runs the registry?', 'In this demo, two keys generated in the repository. In production, a multi-stakeholder body — an open governance question.']
        ],
        body: `
<h1>FAQ</h1>
<p class="lede">The three questions that decide whether revocation is credible.</p>`
      }
    ],
    extraArt: [
      { name: 'revoked-hero', kind: 'hero' }
    ]
  },

  {
    sub: 'verify',
    domain: 'verify.aifeed.md',
    name: 'AIFeed Verifier',
    type: 'docs',
    locale: 'en',
    theme: { accent: '#6ea8fe', accent2: '#f55036' },
    mode: 'dark',
    fonts: "'Inter',-apple-system,'Segoe UI',Roboto,sans-serif",
    headFonts: "'Space Grotesk','Inter',sans-serif",
    mono: "'JetBrains Mono',ui-monospace,Consolas,monospace",
    fontCss: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap',
    tagline: 'Client-side verification, no server round-trip',
    topContact: 'No tracking · runs in your tab',
    search: false,
    ctaLabel: 'Run the verifier',
    ctaHref: '/',
    about: 'A browser verifier for AIFeed origins: strict parse, Ed25519, and DNS-over-HTTPS.',
    nav: [['/', 'Verifier', 'Verifier'], ['/how-it-works/', 'How it works', 'Cara kerja'], ['/coverage/', 'Coverage', 'Cakupan'], ['/cli/', 'CLI & SDK', 'CLI & SDK'], ['/demos/', 'Demos', 'Demo']],
    footerCols: [
      ['verifierCol', [['/', 'Run it'], ['/how-it-works/', 'The six checks'], ['/coverage/', 'Coverage matrix']]],
      ['getIt', [['/cli/', 'CLI & SDK'], ['https://www.npmjs.com/package/@aifeed/verify', 'npm package']]],
      ['demosCol', [['/demos/', 'Directory'], ['https://demo.aifeed.md', 'demo.aifeed.md'], ['https://strict.aifeed.md', 'strict.aifeed.md']]]
    ],
    script: '/verifier.js',
    pages: [
      {
        path: '/', title: 'AIFeed Verifier — check any origin in your browser',
        summary: 'Paste an AIFeed origin and watch the full chain verify client-side, including the DNS anchor.',
        titleId: 'Verifier AIFeed — periksa origin mana pun di browser',
        summaryId: 'Tempel URL origin AIFeed dan saksikan rantai verifikasi berjalan client-side, termasuk anchor DNS.',
        kind: 'home',
        stats: [['6', 'checks per origin'], ['0', 'server round-trips for crypto'], ['100%', 'client-side in your tab'], ['8', 'live demo origins']],
        body: `
<section class="hero">
  <p class="eyebrow">verify.aifeed.md</p>
  <h1>Verify any AIFeed origin — in your browser</h1>
  <p class="lede">No server round-trip for the crypto: discovery, signature, domain binding, and the DNS
  anchor are checked in this tab with WebCrypto and DNS-over-HTTPS.</p>
</section>
<section class="verifier block">
  <div class="row">
    <input id="verify-url" type="url" value="https://demo.aifeed.md" spellcheck="false" aria-label="Origin URL">
    <button id="verify-run" class="btn" type="button">Verify</button>
  </div>
  <div class="chips">
    <button data-demo="https://demo.aifeed.md" type="button">demo</button>
    <button data-demo="https://news.aifeed.md" type="button">news</button>
    <button data-demo="https://shop.aifeed.md" type="button">shop</button>
    <button data-demo="https://gov.aifeed.md" type="button">gov</button>
    <button data-demo="https://strict.aifeed.md" type="button">strict</button>
    <button data-demo="https://revoked.aifeed.md" type="button">revoked</button>
  </div>
  <progress id="verify-progress" max="1" value="0" hidden></progress>
  <ol id="verify-steps" class="steps"></ol>
  <div id="verify-report"></div>
</section>
<section class="block">
  <h2>What it checks</h2>
  <div class="grid">
    <div class="card"><div class="body"><h3>Discovery &amp; strict parse</h3><p>Finds the manifest, rejects duplicate keys, floats, and out-of-range integers before any crypto runs.</p></div></div>
    <div class="card"><div class="body"><h3>Signature chain</h3><p>Ed25519 over JCS bytes, with the domain-separated context and the DNS anchor from <code>_aifeed</code>.</p></div></div>
    <div class="card"><div class="body"><h3>Policy &amp; content</h3><p>Renders the signed permission table and verifies a negotiated markdown page end to end.</p></div></div>
  </div>
</section>`,
        bodyId: `
<section class="hero">
  <p class="eyebrow">verify.aifeed.md</p>
  <h1>Verifikasi origin AIFeed mana pun — di browser Anda</h1>
  <p class="lede">Tanpa perjalanan ke server untuk kripto: discovery, tanda tangan, pengikatan domain, dan anchor DNS diperiksa di tab ini dengan WebCrypto dan DNS-over-HTTPS.</p>
</section>
<section class="verifier block">
  <div class="row">
    <input id="verify-url" type="url" value="https://demo.aifeed.md" spellcheck="false" aria-label="Origin URL">
    <button id="verify-run" class="btn" type="button">Verifikasi</button>
  </div>
  <div class="chips">
    <button data-demo="https://demo.aifeed.md" type="button">demo</button>
    <button data-demo="https://news.aifeed.md" type="button">news</button>
    <button data-demo="https://strict.aifeed.md" type="button">strict</button>
    <button data-demo="https://revoked.aifeed.md" type="button">revoked</button>
  </div>
  <progress id="verify-progress" max="1" value="0" hidden></progress>
  <ol id="verify-steps" class="steps"></ol>
  <div id="verify-report"></div>
</section>`,
        aside: [
          "<div class=\"buybox\"><div class=\"price\">Rp 55.000<span class=\"compare\">Rp 65.000</span></div><p class=\"per\">100 g · Free delivery over Rp 250.000</p><div class=\"rating\">★★★★☆ <span>41 reviews</span></div><div class=\"row\"><span class=\"variant active\">100 g</span></div><div class=\"row\"><span class=\"qty\"><button type=\"button\">-</button><span>1</span><button type=\"button\">+</button></span><button class=\"btn\" type=\"button\">Add to cart</button></div><div class=\"stockbar\" title=\"Stock: 12\"><i style=\"width:15%\"></i></div><div class=\"delivery\"><b>Delivery</b> - Bandung, 2-4 hari - Free returns 7 days</div></div>",
        ],
      },
      {
        path: '/how-it-works/', title: 'How the verifier works',
        summary: 'The six checks, in order, and why each one matters.',
        titleId: 'Cara kerja verifier',
        summaryId: 'Enam pemeriksaan berurutan, dan mengapa masing-masing penting.',
        kind: 'docs', crumbs: ['How it works'],
        toc: [['checks', 'The six checks'], ['trace', 'A sample trace'], ['limits', 'Honest limits']],
        body: `
<h1>Six checks, in order</h1>
<ol class="flow-v" id="checks">
  <li><strong>Discovery.</strong> Fetch <code>/.well-known/ai.json</code>, or follow the <code>ai-feed</code> link relation.</li>
  <li><strong>Strict parse.</strong> Duplicate keys, floats, and out-of-range integers are rejected before any crypto runs.</li>
  <li><strong>Domain binding.</strong> The manifest's <code>identity.domain</code> must equal the host you asked for.</li>
  <li><strong>Signature.</strong> Ed25519 over JCS-canonical bytes with the <code>aifeed.v0.2</code> separation.</li>
  <li><strong>DNS anchor.</strong> A DNS-over-HTTPS lookup of <code>_aifeed.&lt;host&gt;</code> must carry the same public key.</li>
  <li><strong>Permissions and revocation.</strong> The usage table is read, and the registry document is checked when present.</li>
</ol>
<h2 id="trace">A sample trace</h2>
<pre><code>PASS discovery   https://demo.aifeed.md/.well-known/ai.json
PASS parse       duplicate keys, floats, bounds clean
PASS domain      demo.aifeed.md
PASS signature   ed25519 over aifeed.v0.2
PASS anchor      v=aifeed1 · fp=sha256:NQixB-4Q…
PASS content     text/aifeed+markdown · signature verified</code></pre>
<h2 id="limits">Honest limits</h2>
<ul class="list">
  <li>The verifier proves provenance, not that the markdown faithfully mirrors the HTML rendering.</li>
  <li>First-contact origin+DNS compromise is undetectable without out-of-band state.</li>
  <li>WebCrypto Ed25519 support is required; older browsers get a clear warning instead of a false pass.</li>
</ul>`
      },
      {
        path: '/coverage/', title: 'Coverage',
        summary: 'What the verifier checks, what it warns about, and what it deliberately does not claim.',
        titleId: 'Cakupan',
        summaryId: 'Apa yang diperiksa, apa yang diperingatkan, dan apa yang tidak diklaim.',
        kind: 'page', crumbs: ['Coverage'],
        body: `
<h1>Coverage</h1>
<table class="table striped">
  <thead><tr><th>Check</th><th>Result</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td>Strict JSON</td><td><span class="tag ok">enforced</span></td><td>duplicate keys, floats, integer bounds, NFC</td></tr>
    <tr><td>Domain binding</td><td><span class="tag ok">enforced</span></td><td>IDNA A-label comparison</td></tr>
    <tr><td>Ed25519 signature</td><td><span class="tag ok">enforced</span></td><td>JCS canonical bytes</td></tr>
    <tr><td>DNS anchor</td><td><span class="tag ok">enforced</span></td><td>DNS-over-HTTPS, key comparison</td></tr>
    <tr><td>Revocation</td><td><span class="tag warn">partial</span></td><td>document fetched; multi-signature verification runs in the CLI/agent, not this page</td></tr>
    <tr><td>Content fidelity to HTML</td><td><span class="tag no">not claimed</span></td><td>signatures attest provenance, not rendering</td></tr>
  </tbody>
</table>`
      },
      {
        path: '/cli/', title: 'CLI & SDK',
        summary: 'The same verification from a terminal or from Node.',
        titleId: 'CLI & SDK',
        summaryId: 'Verifikasi yang sama dari terminal atau dari Node.',
        kind: 'docs', crumbs: ['CLI & SDK'],
        body: `
<h1>CLI &amp; SDK</h1>
<pre><code># repository example
node examples/agent/compliant-agent.js https://demo.aifeed.md --use retrieval --fetch

# SDK
npm install @aifeed/verify</code></pre>
<pre><code>const sdk = require('@aifeed/verify');
const base = 'https://demo.aifeed.md/.well-known/';
const m = await sdk.fetchText(base + 'ai.json');
const s = await sdk.fetchText(base + 'ai-signature.json');
console.log(sdk.verifyAll({ manifestText: m.text, manifestBytes: m.buffer,
  signatureText: s.text, domain: 'demo.aifeed.md' }).result);</code></pre>`
      },
      {
        path: '/demos/', title: 'Demo directory',
        summary: 'All seven live demo origins, what each one shows, and how to verify them.',
        titleId: 'Direktori demo',
        summaryId: 'Tujuh origin demo live, apa yang ditunjukkan masing-masing, dan cara memverifikasinya.',
        kind: 'listing', crumbs: ['Demos'],
        body: `
<h1>Demo directory</h1>
<p class="lede">Each origin is generated from the repository and verified live by <code>npm run verify:live</code>.</p>
<div class="grid">
  <a class="card" href="https://demo.aifeed.md"><div class="body"><h3>demo.aifeed.md</h3><p>Full publisher walkthrough: manifest, dual-stack, index.</p></div></a>
  <a class="card" href="https://news.aifeed.md"><div class="body"><h3>news.aifeed.md</h3><p>Triage metadata and EN/ID alternates.</p></div></a>
  <a class="card" href="https://shop.aifeed.md"><div class="body"><h3>shop.aifeed.md</h3><p>Catalog with commercial-use denial and assets.</p></div></a>
  <a class="card" href="https://gov.aifeed.md"><div class="body"><h3>gov.aifeed.md</h3><p>Open reproduction, optional attribution.</p></div></a>
  <a class="card" href="https://strict.aifeed.md"><div class="body"><h3>strict.aifeed.md</h3><p>Search-only with live 403/429.</p></div></a>
  <a class="card" href="https://revoked.aifeed.md"><div class="body"><h3>revoked.aifeed.md</h3><p>Multi-signature suspension.</p></div></a>
</div>`
      }
    ]
  }
];
