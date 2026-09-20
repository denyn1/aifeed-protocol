#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BENCH_DIR = path.join(ROOT, 'benchmarks');
const DOCS_DIR = path.join(ROOT, 'docs');

const STYLE = `
:root, html[data-theme="dark"] {
  --bg: #12100f;
  --bg-soft: #171614;
  --card: #1f1e1c;
  --card-strong: #262524;
  --border: rgba(153, 153, 153, 0.16);
  --border-strong: rgba(153, 153, 153, 0.28);
  --text: #f8f8f7;
  --muted: #a5a09c;
  --faint: #766f6b;
  --accent: #f55036;
  --accent-2: #ff8f6b;
  --ok: #3ddc97;
  --warn: #ffb454;
  --bad: #ff6b6b;
  --skip: #8f7bff;
  --info: #6ea8fe;
  --radius: 10px;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
html[data-theme="light"] {
  --bg: #fefefe;
  --bg-soft: #f8f8f7;
  --card: #ffffff;
  --card-strong: #f3f3f2;
  --border: #e7e5e4;
  --border-strong: #d6d3d1;
  --text: #0c0a09;
  --muted: #766f6b;
  --faint: #a5a09c;
  --accent: #f55036;
  --accent-2: #e2472f;
  --ok: #0f9d63;
  --warn: #b26a00;
  --bad: #d92d20;
  --skip: #6b52e0;
  --info: #1e6fd9;
}
* { box-sizing: border-box; }
html { color-scheme: dark light; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font: 15.5px/1.6 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
h1, h2, h3, .who, .font-header { font-family: Montserrat, Inter, -apple-system, "Segoe UI", Roboto, sans-serif; }
.wrap { max-width: 1180px; margin: 0 auto; padding: 28px 20px 64px; }
a { color: inherit; }
header.hero { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; }
h1 { margin: 0; font-size: clamp(22px, 3vw, 32px); letter-spacing: -0.02em; font-weight: 600; }
h2 { margin: 0 0 12px; font-size: 18px; letter-spacing: -0.01em; font-weight: 600; }
p.lede { margin: 6px 0 0; color: var(--muted); max-width: 72ch; }
.badges { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
  border: 1px solid var(--border); color: var(--muted); background: transparent;
}
.badge.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 40%, transparent); }
.badge.warn { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 40%, transparent); }
.badge.bad { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 40%, transparent); }
.badge.info { color: var(--info); border-color: color-mix(in srgb, var(--info) 40%, transparent); }
.theme-btn {
  appearance: none; border: 1px solid var(--border); background: var(--card-strong); color: var(--muted);
  padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.theme-btn:hover { color: var(--text); border-color: var(--accent); }
.theme-btn::after { content: "Light"; }
html[data-theme="light"] .theme-btn::after { content: "Dark"; }
.banner {
  margin: 14px 0 22px; padding: 12px 16px; border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--warn) 45%, transparent); background: color-mix(in srgb, var(--warn) 8%, transparent);
  color: var(--warn); font-size: 13.5px;
}
.tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
.tab {
  appearance: none; border: 1px solid var(--border); background: var(--card); color: var(--muted);
  padding: 9px 16px; border-radius: 999px; font-size: 14px; font-weight: 600; cursor: pointer;
  transition: color 160ms ease, background 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.tab:hover { transform: translateY(-1px); color: var(--text); }
.tab[aria-selected="true"] { color: #fff; background: var(--accent); border-color: var(--accent); }
.panel { display: none; }
.panel.active { display: block; animation: fadeUp 320ms ease both; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.grid { display: grid; gap: 16px; }
.grid.cols-2 { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.grid.cols-3 { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.card {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px 18px;
}
.card h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.stage { position: relative; min-height: 430px; padding: 10px; }
.stage .node {
  position: absolute; z-index: 2; min-width: 132px; padding: 10px 12px; border-radius: 10px;
  background: var(--card-strong); border: 1px solid var(--border); font-size: 13px; text-align: center;
  transition: border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease;
}
.stage .node strong { display: block; font-size: 13.5px; }
.stage .node span { color: var(--muted); font-size: 11.5px; }
.stage .node.flash-ok { border-color: var(--ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 20%, transparent); }
.stage .node.flash-bad { border-color: var(--bad); box-shadow: 0 0 0 3px color-mix(in srgb, var(--bad) 22%, transparent); }
.stage .node.flash-warn { border-color: var(--warn); box-shadow: 0 0 0 3px color-mix(in srgb, var(--warn) 22%, transparent); }
.stage .node.flash-skip { border-color: var(--skip); box-shadow: 0 0 0 3px color-mix(in srgb, var(--skip) 22%, transparent); }
.packet {
  position: absolute; z-index: 1; width: 12px; height: 12px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 70%, transparent);
  transition: transform 620ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 620ms ease;
  pointer-events: none;
}
.packet.ok { background: var(--ok); box-shadow: 0 0 12px color-mix(in srgb, var(--ok) 70%, transparent); }
.packet.bad { background: var(--bad); box-shadow: 0 0 12px color-mix(in srgb, var(--bad) 70%, transparent); }
.packet.warn { background: var(--warn); box-shadow: 0 0 12px color-mix(in srgb, var(--warn) 70%, transparent); }
.packet.skip { background: var(--skip); box-shadow: 0 0 12px color-mix(in srgb, var(--skip) 70%, transparent); }
.controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 10px; }
.btn {
  appearance: none; border: 1px solid var(--border-strong); background: var(--card-strong); color: var(--text);
  padding: 8px 14px; border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease;
}
.btn:hover { transform: translateY(-1px); border-color: var(--accent); }
.seg { display: inline-flex; border: 1px solid var(--border-strong); border-radius: 10px; overflow: hidden; }
.seg button { appearance: none; border: 0; background: transparent; color: var(--muted); padding: 8px 13px; cursor: pointer; font-weight: 600; }
.seg button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.steps { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; }
.step {
  display: flex; gap: 10px; align-items: flex-start; padding: 9px 12px; border-radius: 10px;
  border: 1px solid transparent; color: var(--muted); transition: all 220ms ease;
}
.step .dot { width: 9px; height: 9px; margin-top: 6px; border-radius: 50%; background: var(--border); flex: 0 0 auto; }
.step.current { color: var(--text); border-color: var(--border); background: var(--card); }
.step.current .dot { background: var(--accent); box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 70%, transparent); }
.step.done { color: var(--text); }
.step.done .dot { background: var(--ok); }
.step .detail { color: var(--muted); font-size: 12.5px; }
.counter-row { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.counter { background: var(--card-strong); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
.counter .label { color: var(--muted); font-size: 12px; }
.counter .value { font: 700 22px/1.2 var(--mono); margin-top: 4px; }
.counter .value.good { color: var(--ok); }
.counter .value.bad { color: var(--bad); }
.counter .value.warn { color: var(--warn); }
.counter .value.skip { color: var(--skip); }
table.data { width: 100%; border-collapse: collapse; font-size: 13.5px; }
table.data th, table.data td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }
table.data th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
table.data td.num { text-align: right; font-family: var(--mono); }
.bar { height: 12px; border-radius: 999px; background: var(--card-strong); overflow: hidden; }
.bar > i { display: block; height: 100%; width: 0; border-radius: 999px; background: var(--accent); transition: width 900ms cubic-bezier(0.22, 0.61, 0.36, 1); }
.bar.warn > i { background: var(--warn); }
.bar.bad > i { background: var(--bad); }
.bar.ok > i { background: var(--ok); }
.split { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.side-title { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.side-title .who { font-weight: 700; }
.legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; color: var(--muted); font-size: 12.5px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
footer.foot { margin-top: 34px; color: var(--faint); font-size: 12.5px; border-top: 1px solid var(--border); padding-top: 14px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 720px) {
  .stage { min-height: 560px; }
  .stage .node { min-width: 108px; font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .packet, .bar > i, .tab, .btn { transition: none !important; }
  .panel.active { animation: none; }
}
`;

const THEME_BOOT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (error) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

const ENGINE = `
(function () {
  'use strict';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function qs(root, selector) { return root.querySelector(selector); }
  function qsa(root, selector) { return Array.prototype.slice.call(root.querySelectorAll(selector)); }

  function setupTheme() {
    var button = document.getElementById('theme-toggle');
    if (!button) return;
    button.addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (error) {}
    });
  }

  function setupTabs() {
    var tabs = qsa(document, '.tab');
    var panels = qsa(document, '.panel');
    if (tabs.length === 0 || panels.length === 0) return;
    function activate(name) {
      tabs.forEach(function (tab) {
        var selected = tab.getAttribute('data-panel') === name;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
      panels.forEach(function (panel) {
        panel.classList.toggle('active', panel.id === 'panel-' + name);
      });
      document.dispatchEvent(new CustomEvent('aifeed:panel', { detail: name }));
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { activate(tab.getAttribute('data-panel')); });
      tab.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        var next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
        tabs[next].focus();
        activate(tabs[next].getAttribute('data-panel'));
      });
    });
    activate(tabs[0].getAttribute('data-panel'));
  }

  function animateNumber(element, target, duration) {
    if (!element) return;
    if (reduceMotion || !duration) { element.textContent = String(target); return; }
    var start = null;
    function tick(now) {
      if (start === null) start = now;
      var progress = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function animateBars(root) {
    qsa(root, '.bar > i').forEach(function (fill) {
      var value = Number(fill.getAttribute('data-value') || 0);
      requestAnimationFrame(function () { fill.style.width = Math.max(0, Math.min(100, value)) + '%'; });
    });
  }

  function flyPacket(stage, fromEl, toEl, kind, speed) {
    if (!fromEl || !toEl) return;
    var stageRect = stage.getBoundingClientRect();
    var fromRect = fromEl.getBoundingClientRect();
    var toRect = toEl.getBoundingClientRect();
    var packet = document.createElement('div');
    packet.className = 'packet ' + (kind || '');
    var startX = fromRect.left - stageRect.left + fromRect.width / 2 - 6;
    var startY = fromRect.top - stageRect.top + fromRect.height / 2 - 6;
    var endX = toRect.left - stageRect.left + toRect.width / 2 - 6;
    var endY = toRect.top - stageRect.top + toRect.height / 2 - 6;
    packet.style.transform = 'translate(' + startX + 'px,' + startY + 'px)';
    packet.style.transitionDuration = (620 / (speed || 1)) + 'ms';
    if (reduceMotion) { packet.style.transitionDuration = '0ms'; }
    stage.appendChild(packet);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        packet.style.transform = 'translate(' + endX + 'px,' + endY + 'px)';
        if (kind === 'bad' || kind === 'warn' || kind === 'skip') packet.style.opacity = '0.15';
      });
    });
    setTimeout(function () { packet.remove(); }, 900 / (speed || 1));
  }

  function flash(el, kind) {
    if (!el) return;
    var klass = 'flash-' + (kind || 'ok');
    el.classList.add(klass);
    setTimeout(function () { el.classList.remove(klass); }, 900);
  }

  window.AIFeedAnim = {
    reduceMotion: reduceMotion,
    qs: qs,
    qsa: qsa,
    setupTheme: setupTheme,
    setupTabs: setupTabs,
    animateNumber: animateNumber,
    animateBars: animateBars,
    flyPacket: flyPacket,
    flash: flash
  };
})();
`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function embedJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function pageShell({ title, description, body, script, canonical = '', extraStyle = '' }) {
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonical || undefined,
    isPartOf: { '@type': 'WebSite', name: 'AIFeed', url: 'https://aifeed.md' }
  });
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + escapeHtml(title) + '</title>',
    '<meta name="description" content="' + escapeHtml(description) + '">',
    '<meta name="robots" content="index,follow,max-image-preview:large">',
    canonical ? '<link rel="canonical" href="' + escapeHtml(canonical) + '">' : '',
    '<meta property="og:type" content="website">',
    canonical ? '<meta property="og:url" content="' + escapeHtml(canonical) + '">' : '',
    '<meta property="og:site_name" content="AIFeed">',
    '<meta property="og:title" content="' + escapeHtml(title) + '">',
    '<meta property="og:description" content="' + escapeHtml(description) + '">',
    '<meta property="og:image" content="https://aifeed.md/og-image.png">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">',
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">',
    '<meta name="twitter:image" content="https://aifeed.md/og-image.png">',
    '<script type="application/ld+json">' + structuredData + '</script>',
    '<script>' + THEME_BOOT + '</script>',
    '<style>' + STYLE + extraStyle + '</style>',
    '</head>',
    '<body>',
    body,
    '<script>' + ENGINE + '</script>',
    '<script>' + script + '</script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function enforcementStage() {
  return [
    '<div class="card">',
    '<h3>Process flow (animation)</h3>',
    '<div class="stage" id="stage" role="img" aria-label="Diagram of AI requests flowing through the AIFeed edge policy">',
    '<div class="node" id="node-publisher" style="left:2%;top:6%"><strong>Publisher</strong><span>signed manifest + MAKO</span></div>',
    '<div class="node" id="node-training" style="left:2%;top:44%"><strong>Training crawler</strong><span>ignores the declaration</span></div>',
    '<div class="node" id="node-plain" style="left:2%;top:70%"><strong>Non-AIFeed crawler</strong><span>plain HTML</span></div>',
    '<div class="node" id="node-compliant" style="left:2%;top:88%"><strong>AIFeed-compliant client</strong><span>MAKO + delta + verification</span></div>',
    '<div class="node" id="node-edge" style="left:34%;top:38%"><strong>Edge / PDP</strong><span>403 · 429 · pass</span></div>',
    '<div class="node" id="node-origin" style="left:62%;top:30%"><strong>Origin</strong><span>HTML / MAKO</span></div>',
    '<div class="node" id="node-index" style="left:62%;top:62%"><strong>Delta index</strong><span>per-page digests</span></div>',
    '<div class="node" id="node-verify" style="left:84%;top:80%"><strong>Verification</strong><span>signature + digest</span></div>',
    '</div>',
    '<div class="controls">',
    '<button class="btn" id="play" aria-pressed="true">Pause</button>',
    '<button class="btn" id="replay">Replay</button>',
    '<div class="seg" role="group" aria-label="Animation speed">',
    '<button data-speed="0.5" aria-pressed="false">0.5x</button>',
    '<button data-speed="1" aria-pressed="true">1x</button>',
    '<button data-speed="2" aria-pressed="false">2x</button>',
    '</div>',
    '<div class="badges" id="scenarios" role="group" aria-label="Scenarios">',
    '<button class="tab" data-scenario="S0" aria-selected="false" style="padding:6px 12px">S0</button>',
    '<button class="tab" data-scenario="S1" aria-selected="false" style="padding:6px 12px">S1</button>',
    '<button class="tab" data-scenario="S2" aria-selected="false" style="padding:6px 12px">S2</button>',
    '<button class="tab" data-scenario="S3" aria-selected="true" style="padding:6px 12px">S3</button>',
    '</div>',
    '</div>',
    '<ol class="steps" id="steps"></ol>',
    '</div>',
    '</div>'
  ].join('\n');
}

function enforcementCounters() {
  return [
    '<div class="grid cols-2" style="margin-top:16px">',
    '<div class="card">',
    '<div class="side-title"><span class="who">Web owner / host</span><span class="badge info">measured-simulation</span></div>',
    '<div class="counter-row">',
    '<div class="counter"><div class="label">Egress bytes saved</div><div class="value good" id="counter-host-bytes">0%</div></div>',
    '<div class="counter"><div class="label">Origin CPU saved</div><div class="value good" id="counter-host-cpu">0%</div></div>',
    '<div class="counter"><div class="label">Peak connections reduced</div><div class="value good" id="counter-host-peak">0%</div></div>',
    '<div class="counter"><div class="label">403 blocks / 429 throttles</div><div class="value bad" id="counter-host-blocks">0 / 0</div></div>',
    '</div>',
    '</div>',
    '<div class="card">',
    '<div class="side-title"><span class="who">AI side</span><span class="badge info">measured-simulation</span></div>',
    '<div class="counter-row">',
    '<div class="counter"><div class="label">Received bytes saved</div><div class="value good" id="counter-ai-bytes">0%</div></div>',
    '<div class="counter"><div class="label">Unchanged pages skipped</div><div class="value skip" id="counter-ai-skipped">0</div></div>',
    '<div class="counter"><div class="label">Signatures verified</div><div class="value good" id="counter-ai-verified">0</div></div>',
    '<div class="counter"><div class="label">Verification</div><div class="value" id="counter-ai-verify">0 ms/page</div></div>',
    '</div>',
    '</div>',
    '</div>',
    '<div class="card" style="margin-top:16px">',
    '<div class="side-title"><span class="who">Hosting scale (' + '100 tenants' + ')</span><span class="badge warn">model per 1,000 tenants</span></div>',
    '<div class="counter-row">',
    '<div class="counter"><div class="label">Origin bytes saved (100 tenants)</div><div class="value good" id="counter-multi-bytes">0</div></div>',
    '<div class="counter"><div class="label">Origin CPU saved (100 tenants)</div><div class="value good" id="counter-multi-cpu">0 ms</div></div>',
    '<div class="counter"><div class="label">Projected bytes / 1,000 tenants</div><div class="value" id="counter-multi-1000">0</div></div>',
    '</div>',
    '</div>'
  ].join('\n');
}

function enforcementResults() {
  return [
    '<div class="card">',
    '<h3>Measured numbers per scenario</h3>',
    '<div id="results-table"></div>',
    '</div>',
    '<div class="card" style="margin-top:16px">',
    '<h3>Bytes and CPU (relative bars)</h3>',
    '<div class="grid" id="results-bars"></div>',
    '</div>'
  ].join('\n');
}

function enforcementSavings() {
  return [
    '<div class="card">',
    '<h3>Web owner / host</h3>',
    '<div class="grid" id="savings-host"></div>',
    '</div>',
    '<div class="card" style="margin-top:16px">',
    '<h3>AI side</h3>',
    '<div class="grid" id="savings-ai"></div>',
    '</div>',
    '<div class="card" style="margin-top:16px">',
    '<h3>Enforcement evidence</h3>',
    '<div class="grid cols-3" id="savings-enforcement"></div>',
    '<div class="legend">',
    '<span><i style="background:var(--ok)"></i>measured-simulation</span>',
    '<span><i style="background:var(--warn)"></i>model (extrapolated per 1,000 tenants)</span>',
    '<span><i style="background:var(--accent)"></i>token estimate</span>',
    '</div>',
    '</div>',
    '<div class="card" style="margin-top:16px">',
    '<h3>Without enforcement (S0) — the honest baseline</h3>',
    '<p id="s0-note" class="lede"></p>',
    '</div>'
  ].join('\n');
}

function renderEnforcementHtml(results) {
  const body = [
    '<div class="wrap">',
    '<header class="hero">',
    '<div>',
    '<h1>AIFeed Enforcement Benchmark — Two-Sided Savings</h1>',
    '<p class="lede">A local HTTP harness with the same edge policy (PDP) as the shipped nginx/Caddy templates. The animation uses the numbers actually measured in this run.</p>',
    '</div>',
    '<div class="badges">',
    '<span class="badge info">self-contained · offline</span>',
    '<span class="badge">generated ' + escapeHtml(results.generated_at) + '</span>',
    '<button class="theme-btn" id="theme-toggle" type="button" aria-label="Toggle color theme"></button>',
    '</div>',
    '</header>',
    '<div class="banner">Simulation + production config — <strong>not a real CDN</strong>. Production claims await the 30-day pilot (see pilot/). Labels: measured-simulation, model, estimate.</div>',
    '<div class="tabs" role="tablist" aria-label="Report sections">',
    '<button class="tab" data-panel="process" role="tab" aria-selected="true">Process flow</button>',
    '<button class="tab" data-panel="results" role="tab" aria-selected="false">Results</button>',
    '<button class="tab" data-panel="savings" role="tab" aria-selected="false">Two-sided savings</button>',
    '</div>',
    '<section class="panel active" id="panel-process" role="tabpanel">',
    enforcementStage(),
    enforcementCounters(),
    '</section>',
    '<section class="panel" id="panel-results" role="tabpanel">',
    enforcementResults(),
    '</section>',
    '<section class="panel" id="panel-savings" role="tabpanel">',
    enforcementSavings(),
    '</section>',
    '<footer class="foot">Source: benchmarks/enforcement-report.json · Regenerate: <code>npm run bench:enforcement &amp;&amp; npm run render:html</code></footer>',
    '</div>',
    '<script type="application/json" id="aifeed-data">' + embedJson(results) + '</script>'
  ].join('\n');

  const script = `
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('aifeed-data').textContent);
  var anim = window.AIFeedAnim;
  var scenario = 'S3';
  var playing = !anim.reduceMotion;
  var speed = 1;
  var stepIndex = 0;
  var stepTimer = null;

  function fmt(number) { return Number(number).toLocaleString('en-US'); }
  function data() { return DATA.single_origin.scenarios[scenario]; }

  function stepsFor() {
    var d = data();
    var list = [];
    list.push({ label: 'Traffic arrives from four client profiles', detail: (d.origin.requests + ' requests forwarded'), kind: 'ok', from: 'node-plain', to: 'node-edge' });
    if (scenario === 'S0') {
      list.push({ label: 'No enforcement: everything is forwarded', detail: 'training crawler, plain crawler, compliant client, humans → HTML', kind: 'ok', from: 'node-edge', to: 'node-origin' });
      list.push({ label: 'Savings ≈ 0', detail: 'origin served ' + fmt(d.origin.bytes) + ' bytes', kind: 'bad', from: 'node-origin', to: 'node-edge' });
    } else {
      list.push({ label: 'Training crawler blocked', detail: fmt(d.edge.blocked) + ' × 403 (manifest: training deny)', kind: 'bad', from: 'node-training', to: 'node-edge' });
      list.push({ label: 'Compliant client fetches signed content', detail: fmt(d.clients.compliant.pages_fetched) + ' signed pages', kind: 'ok', from: 'node-compliant', to: 'node-origin' });
    }
    if (scenario === 'S2' || scenario === 'S3') {
      list.push({ label: 'Non-AIFeed crawler throttled', detail: fmt(d.edge.limited) + ' × 429 + Retry-After', kind: 'warn', from: 'node-plain', to: 'node-edge' });
    }
    if (scenario === 'S3') {
      list.push({ label: 'Delta index read', detail: 'per-page digests', kind: 'ok', from: 'node-edge', to: 'node-index' });
      list.push({ label: 'Unchanged pages skipped', detail: fmt(d.clients.compliant.skipped_unchanged) + ' pages ≈ 0 bytes', kind: 'skip', from: 'node-compliant', to: 'node-index' });
      list.push({ label: 'Signature + digest verified', detail: fmt(d.clients.compliant.verified) + ' documents, ' + d.clients.compliant.verify_failed + ' failed', kind: 'ok', from: 'node-origin', to: 'node-verify' });
    }
    list.push({ label: 'Human visitors unaffected', detail: 'p95 ' + d.human_p95_ms + ' ms', kind: 'ok', from: 'node-edge', to: 'node-plain' });
    return list;
  }

  function renderSteps() {
    var list = stepsFor();
    var root = document.getElementById('steps');
    root.innerHTML = '';
    list.forEach(function (step, index) {
      var item = document.createElement('li');
      item.className = 'step' + (index < stepIndex ? ' done' : '') + (index === stepIndex ? ' current' : '');
      item.innerHTML = '<span class="dot"></span><span><strong>' + step.label + '</strong>' + (step.detail ? '<br><span class="detail">' + step.detail + '</span>' : '') + '</span>';
      root.appendChild(item);
    });
    return list;
  }

  function updateCounters() {
    var d = data();
    var saving = DATA.single_origin.savings[scenario] || { publisher: {}, ai: {} };
    anim.animateNumber(document.getElementById('counter-host-bytes'), saving.publisher.bytes_pct || 0, 700);
    document.getElementById('counter-host-bytes').textContent = (saving.publisher.bytes_pct || 0) + '%';
    document.getElementById('counter-host-cpu').textContent = (saving.publisher.cpu_pct || 0) + '%';
    document.getElementById('counter-host-peak').textContent = (saving.publisher.peak_concurrent_pct || 0) + '%';
    document.getElementById('counter-host-blocks').textContent = fmt(d.edge.blocked) + ' / ' + fmt(d.edge.limited);
    document.getElementById('counter-ai-bytes').textContent = (saving.ai.bytes_pct || 0) + '%';
    document.getElementById('counter-ai-skipped').textContent = fmt(d.clients.compliant.skipped_unchanged);
    document.getElementById('counter-ai-verified').textContent = fmt(d.clients.compliant.verified);
    document.getElementById('counter-ai-verify').textContent = d.clients.compliant.verify_cpu_ms_per_page + ' ms/page';
    var multi = DATA.multi_origin;
    document.getElementById('counter-multi-bytes').textContent = fmt(multi.baseline.origin.bytes - multi.enforced.origin.bytes);
    document.getElementById('counter-multi-cpu').textContent = (multi.baseline.origin.cpu_ms - multi.enforced.origin.cpu_ms).toFixed(1) + ' ms';
    document.getElementById('counter-multi-1000').textContent = fmt(multi.per_1000_tenants.origin_bytes_saved);
  }

  function runStep(list) {
    if (!playing) return;
    if (stepIndex >= list.length) {
      playing = false;
      var playButton = document.getElementById('play');
      playButton.textContent = 'Play';
      playButton.setAttribute('aria-pressed', 'false');
      return;
    }
    var step = list[stepIndex];
    var from = document.getElementById(step.from);
    var to = document.getElementById(step.to);
    if (step.kind === 'skip') {
      anim.flyPacket(document.getElementById('stage'), from, to, 'skip', speed);
    } else {
      var packets = Math.min(6, Math.max(1, Math.round((step.detail ? parseInt(step.detail, 10) : 3) / 3) || 3));
      for (var index = 0; index < packets; index++) {
        (function (packetIndex) {
          setTimeout(function () {
            anim.flyPacket(document.getElementById('stage'), from, to, step.kind, speed);
          }, packetIndex * 90 / speed);
        })(index);
      }
    }
    anim.flash(to, step.kind);
    if (step.kind === 'bad') anim.flash(from, 'bad');
    renderSteps();
    stepIndex++;
    stepTimer = setTimeout(function () { runStep(list); }, 900 / speed);
  }

  function restart() {
    clearTimeout(stepTimer);
    stepIndex = 0;
    var list = renderSteps();
    if (playing) runStep(list);
  }

  document.getElementById('play').addEventListener('click', function () {
    playing = !playing;
    this.textContent = playing ? 'Pause' : 'Play';
    this.setAttribute('aria-pressed', playing ? 'true' : 'false');
    if (playing) { var list = renderSteps(); runStep(list); }
    else clearTimeout(stepTimer);
  });
  document.getElementById('replay').addEventListener('click', function () { playing = true; document.getElementById('play').textContent = 'Pause'; restart(); });
  anim.qsa(document, '.seg button').forEach(function (button) {
    button.addEventListener('click', function () {
      speed = Number(button.getAttribute('data-speed'));
      anim.qsa(document, '.seg button').forEach(function (other) { other.setAttribute('aria-pressed', other === button ? 'true' : 'false'); });
    });
  });
  anim.qsa(document, '#scenarios button').forEach(function (button) {
    button.addEventListener('click', function () {
      scenario = button.getAttribute('data-scenario');
      anim.qsa(document, '#scenarios button').forEach(function (other) { other.setAttribute('aria-selected', other === button ? 'true' : 'false'); });
      restart();
      updateCounters();
    });
  });

  function renderTable() {
    var scenarios = ['S0', 'S1', 'S2', 'S3'];
    var rows = [
      ['Origin requests', function (d) { return fmt(d.origin.requests); }],
      ['Origin bytes', function (d) { return fmt(d.origin.bytes); }],
      ['Origin CPU (ms)', function (d) { return d.origin.cpu_ms; }],
      ['Peak connections', function (d) { return d.origin.peak_concurrent; }],
      ['403 blocks', function (d) { return fmt(d.edge.blocked); }],
      ['429 throttles', function (d) { return fmt(d.edge.limited); }],
      ['Client received bytes', function (d) { return fmt(Object.keys(d.clients).reduce(function (sum, key) { return sum + d.clients[key].received_bytes; }, 0)); }],
      ['Human p95 (ms)', function (d) { return d.human_p95_ms; }]
    ];
    var html = '<table class="data"><thead><tr><th>Metric</th>' + scenarios.map(function (key) { return '<th>' + key + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (row) {
      html += '<tr><td>' + row[0] + '</td>' + scenarios.map(function (key) { return '<td class="num">' + row[1](DATA.single_origin.scenarios[key]) + '</td>'; }).join('') + '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('results-table').innerHTML = html;
  }

  function renderBars() {
    var scenarios = ['S0', 'S1', 'S2', 'S3'];
    var maxBytes = Math.max.apply(null, scenarios.map(function (key) { return DATA.single_origin.scenarios[key].origin.bytes; }));
    var maxCpu = Math.max.apply(null, scenarios.map(function (key) { return DATA.single_origin.scenarios[key].origin.cpu_ms; }));
    var html = '';
    scenarios.forEach(function (key) {
      var d = DATA.single_origin.scenarios[key];
      html += '<div class="card"><h3>' + key + '</h3>' +
        '<div style="margin-bottom:10px"><div class="label" style="color:var(--muted);font-size:12px">Origin bytes: ' + fmt(d.origin.bytes) + '</div><div class="bar"><i data-value="' + (100 * d.origin.bytes / maxBytes) + '"></i></div></div>' +
        '<div><div class="label" style="color:var(--muted);font-size:12px">Origin CPU: ' + d.origin.cpu_ms + ' ms</div><div class="bar warn"><i data-value="' + (100 * d.origin.cpu_ms / maxCpu) + '"></i></div></div>' +
        '</div>';
    });
    document.getElementById('results-bars').innerHTML = html;
  }

  function renderSavings() {
    var saving = DATA.single_origin.savings.S3;
    var hostItems = [
      ['Egress bytes', saving.publisher.bytes_pct, '%', 'ok'],
      ['Origin CPU', saving.publisher.cpu_pct, '%', 'ok'],
      ['Peak connections reduced', saving.publisher.peak_concurrent_pct, '%', 'ok']
    ];
    var aiItems = [
      ['Received bytes', saving.ai.bytes_pct, '%', 'ok'],
      ['Compliant-client bytes', saving.ai.compliant_bytes_pct, '%', 'ok'],
      ['Verification', saving.ai.verify_cpu_ms_per_page, ' ms/page', 'info']
    ];
    function bars(items) {
      return items.map(function (item) {
        var value = Math.max(0, Math.min(100, Number(item[1]) || 0));
        return '<div><div class="label" style="color:var(--muted);font-size:12.5px">' + item[0] + ': <strong style="color:var(--text)">' + item[1] + item[2] + '</strong></div><div class="bar ' + (item[3] === 'ok' ? 'ok' : '') + '"><i data-value="' + value + '"></i></div></div>';
      }).join('');
    }
    document.getElementById('savings-host').innerHTML = bars(hostItems);
    document.getElementById('savings-ai').innerHTML = bars(aiItems);
    document.getElementById('savings-enforcement').innerHTML =
      '<div class="counter"><div class="label">403 blocks (S3)</div><div class="value bad">' + fmt(DATA.single_origin.scenarios.S3.edge.blocked) + '</div></div>' +
      '<div class="counter"><div class="label">429 throttles (S3)</div><div class="value warn">' + fmt(DATA.single_origin.scenarios.S3.edge.limited) + '</div></div>' +
      '<div class="counter"><div class="label">Pages skipped (S3)</div><div class="value skip">' + fmt(saving.ai.skipped_unchanged) + '</div></div>';
    document.getElementById('s0-note').textContent = 'In S0 (no enforcement) there is no blocking or throttling: the origin serves ' + fmt(DATA.single_origin.scenarios.S0.origin.bytes) + ' bytes and all clients receive ' + fmt(Object.keys(DATA.single_origin.scenarios.S0.clients).reduce(function (sum, key) { return sum + DATA.single_origin.scenarios.S0.clients[key].received_bytes; }, 0)) + ' bytes. This is the baseline that makes the S1–S3 savings meaningful.';
  }

  document.addEventListener('aifeed:panel', function (event) {
    if (event.detail === 'results') anim.animateBars(document.getElementById('panel-results'));
    if (event.detail === 'savings') anim.animateBars(document.getElementById('panel-savings'));
  });

  anim.setupTheme();
  anim.setupTabs();
  renderTable();
  renderBars();
  renderSavings();
  updateCounters();
  if (anim.reduceMotion) {
    document.getElementById('play').textContent = 'Play animation';
    playing = false;
  } else {
    restart();
  }
})();
`;

  return pageShell({
    title: 'AIFeed — Enforcement Benchmark & Two-Sided Savings',
    description: 'Animation of the AIFeed enforcement flow with measured savings figures for web owners and the AI side.',
    canonical: 'https://aifeed.md/enforcement-report.html',
    body,
    script
  });
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function renderProcessHtml(options = {}) {
  const makoBench = options.makoBench || readJsonIfExists(path.join(BENCH_DIR, 'mako-benchmark.json'));
  const enforcement = options.enforcement || readJsonIfExists(path.join(BENCH_DIR, 'enforcement-report.json'));
  const savings = {
    mako_vs_html: makoBench ? makoBench.savings.mako_vs_html_percent : null,
    delta_vs_html: makoBench ? makoBench.savings.delta_vs_html_percent : null,
    enforcement_publisher_bytes: enforcement ? enforcement.single_origin.savings.S3.publisher.bytes_pct : null,
    enforcement_ai_bytes: enforcement ? enforcement.single_origin.savings.S3.ai.bytes_pct : null,
    verify_ms: enforcement ? enforcement.single_origin.savings.S3.ai.verify_cpu_ms_per_page : null
  };

  const steps = [
    { id: 'keygen', title: 'Ed25519 key pair generated', detail: 'The publisher creates a key pair; the private key never leaves the server.', kind: 'ok' },
    { id: 'manifest', title: 'Manifest assembled', detail: 'Identity + permissions (training, retrieval, quote), crawl limits, license.', kind: 'ok' },
    { id: 'sign', title: 'Manifest signed', detail: 'Ed25519 + JCS; verification can run fully offline.', kind: 'ok' },
    { id: 'publish', title: 'Published at /.well-known/', detail: 'ai.json + ai-signature.json + mako-index.json (+ .sig).', kind: 'ok' },
    { id: 'dns', title: 'DNS anchor _aifeed', detail: 'The public key is pinned to the domain; manifest forgery is prevented.', kind: 'ok' },
    { id: 'revoke', title: 'Revocation & transparency', detail: 'Multi-signature registry; status can be revoked with evidence.', kind: 'ok' },
    { id: 'discover', title: 'AI discovers the declaration', detail: 'Via link: rel="ai-feed" or /.well-known/ai.json.', kind: 'ok' },
    { id: 'verify-chain', title: 'Verification chain', detail: 'TLS → domain → signature → DNS anchor. All must pass.', kind: 'ok' },
    { id: 'permission', title: 'Permission decision', detail: 'training denied; retrieval/quote allowed with attribution.', kind: 'ok' },
    { id: 'content', title: 'Fetch native content (AIFeed Markdown) or MAKO', detail: 'Accept: text/aifeed+markdown (or text/mako+markdown); ~68% fewer bytes than HTML.', kind: 'ok' },
    { id: 'delta', title: 'Delta consumption', detail: 'Index + digests: only changed pages are fetched; the rest costs 0 bytes.', kind: 'skip' },
    { id: 'verify-doc', title: 'Document verification', detail: 'Signature + digest; cross-URL replay and tampering are rejected.', kind: 'verify' },
    { id: 'use', title: 'Usage + attribution', detail: 'Within the declared permissions, with limits and an audit trail (offline bundle).', kind: 'ok' }
  ];

  const body = [
    '<div class="wrap">',
    '<header class="hero">',
    '<div>',
    '<h1>How AIFeed Works — Full Flow</h1>',
    '<p class="lede">From publishing a signed declaration to AI content consumption: savings for web owners, clarity for AI, auditable for both.</p>',
    '</div>',
    '<div class="badges">',
    '<span class="badge info">open standard</span>',
    '<span class="badge ok">offline · self-contained</span>',
    '<button class="theme-btn" id="theme-toggle" type="button" aria-label="Toggle color theme"></button>',
    '</div>',
    '</header>',
    '<div class="banner">This page summarizes the protocol flow. Savings figures come from reproducible benchmarks (<code>npm run bench:mako</code>, <code>npm run bench:enforcement</code>).</div>',
    '<div class="grid cols-2">',
    '<div class="card">',
    '<h3>Protocol flow</h3>',
    '<div class="stage" id="stage" style="min-height:380px">',
    '<div class="node" id="node-publisher" style="left:4%;top:8%"><strong>Publisher</strong><span>keys · manifest · signature</span></div>',
    '<div class="node" id="node-wellknown" style="left:4%;top:40%"><strong>/.well-known</strong><span>ai.json · signature · index</span></div>',
    '<div class="node" id="node-dns" style="left:4%;top:72%"><strong>DNS _aifeed</strong><span>key anchor</span></div>',
    '<div class="node" id="node-ai" style="left:44%;top:24%"><strong>AI client</strong><span>discovery · verification</span></div>',
    '<div class="node" id="node-edge" style="left:44%;top:60%"><strong>Edge / PDP</strong><span>permissions · limits</span></div>',
    '<div class="node" id="node-origin" style="left:80%;top:16%"><strong>Origin</strong><span>HTML / MAKO</span></div>',
    '<div class="node" id="node-verify" style="left:80%;top:52%"><strong>Verification</strong><span>signature + digest</span></div>',
    '<div class="node" id="node-audit" style="left:80%;top:82%"><strong>Evidence</strong><span>bundle · audit</span></div>',
    '</div>',
    '<div class="controls">',
    '<button class="btn" id="play" aria-pressed="true">Pause</button>',
    '<button class="btn" id="replay">Replay</button>',
    '<div class="seg" role="group" aria-label="Mode">',
    '<button data-mode="with" aria-pressed="true">With AIFeed</button>',
    '<button data-mode="without" aria-pressed="false">Without AIFeed</button>',
    '</div>',
    '</div>',
    '<ol class="steps" id="steps"></ol>',
    '</div>',
    '<div class="card">',
    '<h3>What each side gets</h3>',
    '<div id="mode-note" class="lede" style="margin-bottom:12px"></div>',
    '<div class="split">',
    '<div><div class="side-title"><span class="who">Web owner / host</span><span class="badge info">measured-simulation</span></div><div id="savings-host"></div></div>',
    '<div><div class="side-title"><span class="who">AI side</span><span class="badge info">measured-simulation</span></div><div id="savings-ai"></div></div>',
    '</div>',
    '<div class="legend">',
    '<span><i style="background:var(--ok)"></i>measured (benchmark)</span>',
    '<span><i style="background:var(--warn)"></i>model</span>',
    '<span><i style="background:var(--accent)"></i>estimate</span>',
    '</div>',
    '</div>',
    '</div>',
    '<footer class="foot">Regenerate: <code>npm run bench:mako &amp;&amp; npm run bench:enforcement &amp;&amp; npm run render:html</code> · Docs: spec/en/aifeed-v0.2.md</footer>',
    '</div>',
    '<script type="application/json" id="aifeed-data">' + embedJson({ steps, savings }) + '</script>'
  ].join('\n');

  const script = `
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('aifeed-data').textContent);
  var anim = window.AIFeedAnim;
  var mode = 'with';
  var playing = !anim.reduceMotion;
  var stepIndex = 0;
  var timer = null;

  function pct(value) { return value === null || value === undefined ? '—' : value + '%'; }

  function modeSteps() {
    if (mode === 'with') return DATA.steps;
    return [
      { title: 'No signed declaration', detail: 'AI only has HTML and robots.txt.', kind: 'bad' },
      { title: 'Blind crawl of every page', detail: 'including irrelevant and unchanged pages.', kind: 'bad' },
      { title: 'No proof of permission', detail: 'the publisher cannot tell who took what.', kind: 'bad' },
      { title: 'No savings', detail: 'full bytes and CPU; the AI side re-downloads everything.', kind: 'bad' }
    ];
  }

  function renderSteps() {
    var list = modeSteps();
    var root = document.getElementById('steps');
    root.innerHTML = '';
    list.forEach(function (step, index) {
      var item = document.createElement('li');
      item.className = 'step' + (index < stepIndex ? ' done' : '') + (index === stepIndex ? ' current' : '');
      item.innerHTML = '<span class="dot"></span><span><strong>' + step.title + '</strong>' + (step.detail ? '<br><span class="detail">' + step.detail + '</span>' : '') + '</span>';
      root.appendChild(item);
    });
    return list;
  }

  function pair(index) {
    var pairs = [
      ['node-publisher', 'node-wellknown'],
      ['node-wellknown', 'node-ai'],
      ['node-dns', 'node-wellknown'],
      ['node-ai', 'node-edge'],
      ['node-edge', 'node-origin'],
      ['node-origin', 'node-verify'],
      ['node-verify', 'node-audit']
    ];
    return pairs[index % pairs.length];
  }

  function runStep() {
    if (!playing) return;
    var list = modeSteps();
    if (stepIndex >= list.length) {
      playing = false;
      document.getElementById('play').textContent = 'Play';
      return;
    }
    var step = list[stepIndex];
    var ids = pair(stepIndex);
    var stage = document.getElementById('stage');
    var kind = step.kind === 'ok' ? 'ok' : step.kind;
    anim.flyPacket(stage, document.getElementById(ids[0]), document.getElementById(ids[1]), kind, 1);
    anim.flash(document.getElementById(ids[1]), kind);
    renderSteps();
    stepIndex++;
    timer = setTimeout(runStep, 1050);
  }

  function restart() {
    clearTimeout(timer);
    stepIndex = 0;
    renderSteps();
    if (playing) runStep();
  }

  function renderSavings() {
    var value = DATA.savings;
    var hostRows = [
      ['MAKO vs HTML (bytes)', pct(value.mako_vs_html)],
      ['Delta vs HTML (bytes)', pct(value.delta_vs_html)],
      ['With enforcement (bytes)', pct(value.enforcement_publisher_bytes)]
    ];
    var aiRows = [
      ['Bytes per page down', pct(value.mako_vs_html)],
      ['Delta re-crawl down', pct(value.delta_vs_html)],
      ['Verification', value.verify_ms === null ? '—' : value.verify_ms + ' ms/page']
    ];
    function rows(items) {
      return '<table class="data"><tbody>' + items.map(function (item) {
        return '<tr><td>' + item[0] + '</td><td class="num">' + item[1] + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    document.getElementById('savings-host').innerHTML = rows(hostRows);
    document.getElementById('savings-ai').innerHTML = rows(aiRows);
    document.getElementById('mode-note').textContent = mode === 'with'
      ? 'With AIFeed: explicit permissions, lean signed content, delta fetching that only pulls what changed, and evidence for both sides.'
      : 'Without AIFeed: full blind crawling, no permissions, no savings — the expensive status quo for hosts and AI alike.';
  }

  document.getElementById('play').addEventListener('click', function () {
    playing = !playing;
    this.textContent = playing ? 'Pause' : 'Play';
    if (playing) { renderSteps(); runStep(); } else clearTimeout(timer);
  });
  document.getElementById('replay').addEventListener('click', function () {
    playing = true;
    document.getElementById('play').textContent = 'Pause';
    restart();
  });
  anim.qsa(document, '.seg button').forEach(function (button) {
    button.addEventListener('click', function () {
      mode = button.getAttribute('data-mode');
      anim.qsa(document, '.seg button').forEach(function (other) { other.setAttribute('aria-pressed', other === button ? 'true' : 'false'); });
      restart();
      renderSavings();
    });
  });

  anim.setupTheme();
  anim.setupTabs();
  renderSteps();
  renderSavings();
  if (anim.reduceMotion) {
    document.getElementById('play').textContent = 'Play animation';
    playing = false;
  } else {
    restart();
  }
})();
`;

  return pageShell({
    title: 'AIFeed — How It Works (full flow)',
    description: 'Animated AIFeed protocol flow: signed declarations, verification, MAKO, delta fetching, and two-sided savings.',
    canonical: 'https://aifeed.md/process.html',
    body,
    script
  });
}

const CHANGELOG_STYLE = `
.changelog { max-width: 92ch; }
.changelog h2 { margin: 26px 0 10px; font-size: 20px; }
.changelog h3 { margin: 22px 0 8px; font-size: 16px; }
.changelog h4 { margin: 18px 0 6px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.changelog ul { margin: 6px 0 14px; padding-left: 22px; }
.changelog li { margin: 4px 0; color: var(--muted); }
.changelog li strong { color: var(--text); }
.changelog p { margin: 10px 0; color: var(--muted); }
.changelog code { font-family: var(--mono); font-size: 12.5px; background: var(--card-strong); border: 1px solid var(--border); border-radius: 6px; padding: 1px 5px; color: var(--text); }
.changelog pre { background: var(--card-strong); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; overflow-x: auto; }
.changelog pre code { border: 0; background: transparent; padding: 0; }
.changelog hr { border: 0; border-top: 1px solid var(--border); margin: 22px 0; }
.changelog a { color: var(--accent-2); text-decoration: none; }
.changelog a:hover { text-decoration: underline; }
`;

const STUDIO_STYLE = `
pre.code { background: var(--card-strong); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; overflow-x: auto; font: 13px/1.55 var(--mono); color: var(--text); }
`;

function renderMarkdown(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let listOpen = false;
  let fence = false;

  function inline(text) {
    let output = escapeHtml(text);
    output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
    output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    output = output.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    return output;
  }

  function closeList() {
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
  }

  for (const line of lines) {
    if (/^```/.test(line)) {
      if (!fence) closeList();
      fence = !fence;
      html.push(fence ? '<pre><code>' : '</code></pre>');
      continue;
    }
    if (fence) {
      html.push(escapeHtml(line));
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(4, heading[1].length + 1);
      html.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push('<li>' + inline(bullet[1]) + '</li>');
      continue;
    }
    if (listOpen && /^\s+\S/.test(line) && html[html.length - 1].endsWith('</li>')) {
      html[html.length - 1] = html[html.length - 1].replace(/<\/li>$/, ' ' + inline(line.trim()) + '</li>');
      continue;
    }
    if (/^\s*$/.test(line)) {
      closeList();
      continue;
    }
    if (/^---+$/.test(line)) {
      closeList();
      html.push('<hr>');
      continue;
    }
    closeList();
    html.push('<p>' + inline(line) + '</p>');
  }
  closeList();
  return html.join('\n');
}

function renderStudioHtml() {
  const repo = 'https://github.com/denyn1/aifeed-protocol';
  const features = [
    ['Create', 'Point Studio at a local HTML folder or crawl the live site: robots-aware sitemap or link discovery, rate limits, and an ETag/Last-Modified cache.'],
    ['Declare', 'Restrict-only policy editor: usage permissions, attribution, crawl limits, license, llms.txt, per-path rules, news/ecommerce presets, and opt-in freshness metadata.'],
    ['Build', 'Incremental builds emit the signed v0.2 manifest, AIFeed Markdown and MAKO pages, delta indexes, and llms.txt.'],
    ['Verify', 'Local verification of manifest, pages, and indexes, plus one-click live verification against the origin and DNS anchor.'],
    ['Export', 'Folder or .tar.gz overlay, the _aifeed DNS TXT record, and adapter hints for nginx, Caddy, Apache, Node, Next.js, PHP, Python, Go, Traefik, and Cloudflare.'],
    ['Rotate & audit', 'Guarded key rotation (prepare, overlap, cutover, re-sign), a journal.ndjson audit trail, and inline fix hints for common failures.']
  ];
  const cards = features.map(([title, text]) =>
    '<div class="card"><h3>' + escapeHtml(title) + '</h3><p class="lede" style="margin:0">' + escapeHtml(text) + '</p></div>'
  ).join('\n');
  const guide = [
    ['English', repo + '/blob/main/docs/publisher-ai-guide.md'],
    ['Bahasa Indonesia', repo + '/blob/main/docs/publisher-ai-guide.id.md'],
    ['中文', repo + '/blob/main/docs/publisher-ai-guide.zh.md']
  ].map(([label, href]) => '<a href="' + href + '">' + escapeHtml(label) + '</a>').join(' · ');

  const body = [
    '<div class="wrap">',
    '<header class="hero">',
    '<div>',
    '<h1>Publish with AIFeed Studio</h1>',
    '<p class="lede">A zero-dependency local app for publishers: declare, sign, verify, and export AIFeed content permissions without touching the command line.</p>',
    '</div>',
    '<div class="badges">',
    '<span class="badge ok">zero dependencies</span>',
    '<span class="badge info">runs on 127.0.0.1:7777</span>',
    '</div>',
    '</header>',
    '<div class="banner">Private keys stay in your local workspace (0600) and are never served or uploaded. Verify every export with the open SDK before publishing.</div>',
    '<div class="split">',
    '<div class="card">',
    '<h3>Quick start</h3>',
    '<pre class="code">git clone ' + repo + '.git\ncd aifeed-protocol\nnpm run studio\n# open http://127.0.0.1:7777</pre>',
    '<p class="lede" style="margin:10px 0 0">UI in English, Bahasa Indonesia, and Chinese. Workspace defaults to <code>~/.aifeed-studio</code>; override with <code>AIFEED_STUDIO_HOME</code>.</p>',
    '</div>',
    '<div class="card">',
    '<h3>Or hand it to an AI agent</h3>',
    '<p class="lede" style="margin:0 0 10px">The publisher guide walks an agent through Classes S/M/L/XL, from a hand-written site to a full CMS integration, with a verified tool capability matrix.</p>',
    '<p>' + guide + '</p>',
    '<p class="lede" style="margin:10px 0 0"><a href="' + repo + '/blob/main/docs/agent-quickstart.md">Agent quickstart</a> · <a href="' + repo + '/blob/main/docs/rotation.md">Key rotation runbook</a> · <a href="' + repo + '/tree/main/studio">Studio source</a></p>',
    '</div>',
    '</div>',
    '<section class="section" style="margin-top:24px">',
    '<h2>What it does</h2>',
    '<div class="grid cols-3">',
    cards,
    '</div>',
    '</section>',
    '<footer class="foot">Docs: studio/README.md · Run: <code>npm run studio</code> · Regenerate: <code>npm run render:html &amp;&amp; npm run build:site</code></footer>',
    '</div>'
  ].join('\n');

  return pageShell({
    title: 'AIFeed Studio — publish signed content permissions',
    description: 'Run a zero-dependency local publisher app: create, crawl, declare, build, verify, export, and rotate AIFeed declarations.',
    canonical: 'https://aifeed.md/studio.html',
    body,
    script: '',
    extraStyle: STUDIO_STYLE
  });
}

function renderUpdatesHtml(options = {}) {
  const repo = 'https://github.com/denyn1/aifeed-protocol';
  const langs = [
    ['en', 'English', 'CHANGELOG.md'],
    ['id', 'Bahasa Indonesia', 'CHANGELOG.id.md'],
    ['zh', '中文', 'CHANGELOG.zh.md']
  ];
  const contents = langs.map(([code, , file]) =>
    (options.changelogs && options.changelogs[code]) || fs.readFileSync(path.join(ROOT, file), 'utf8')
  );
  const tabs = langs.map(([code, label], index) =>
    '<button class="tab" data-panel="' + code + '" role="tab" aria-selected="' + (index === 0 ? 'true' : 'false') + '">' + label + '</button>'
  ).join('\n');
  const panels = langs.map(([code], index) =>
    '<section class="panel' + (index === 0 ? ' active' : '') + '" id="panel-' + code + '" role="tabpanel" lang="' + code + '">\n<div class="changelog">\n' + renderMarkdown(contents[index]) + '\n</div>\n</section>'
  ).join('\n');
  const sources = langs.map(([code, label, file]) =>
    '<a href="' + repo + '/blob/main/' + file + '">' + label + '</a>'
  ).join(' · ');

  const body = [
    '<div class="wrap">',
    '<header class="hero">',
    '<div>',
    '<h1>What\'s new in AIFeed</h1>',
    '<p class="lede">Release notes rendered from the repository changelog at build time — the same file that ships with the code.</p>',
    '</div>',
    '<div class="badges">',
    '<span class="badge info">generated from CHANGELOG.md</span>',
    '</div>',
    '</header>',
    '<div class="banner">Source of truth: ' + sources + '. Anything not in the changelog is not a release note.</div>',
    '<div class="tabs" role="tablist" aria-label="Changelog languages">',
    tabs,
    '</div>',
    panels,
    '<footer class="foot">Regenerate: <code>npm run render:html &amp;&amp; npm run build:site</code></footer>',
    '</div>'
  ].join('\n');

  return pageShell({
    title: 'AIFeed — Updates',
    description: 'AIFeed release notes in English, Bahasa Indonesia, and Chinese, rendered from the repository changelog.',
    canonical: 'https://aifeed.md/updates.html',
    body,
    script: '',
    extraStyle: CHANGELOG_STYLE
  });
}

function main() {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  const enforcement = readJsonIfExists(path.join(BENCH_DIR, 'enforcement-report.json'));
  if (enforcement) {
    fs.writeFileSync(path.join(BENCH_DIR, 'enforcement-report.html'), renderEnforcementHtml(enforcement), 'utf8');
    process.stdout.write('html written: benchmarks/enforcement-report.html\n');
  } else {
    process.stdout.write('skipped benchmarks/enforcement-report.html (run npm run bench:enforcement first)\n');
  }
  fs.writeFileSync(path.join(DOCS_DIR, 'process.html'), renderProcessHtml({}), 'utf8');
  process.stdout.write('html written: docs/process.html\n');
  fs.writeFileSync(path.join(DOCS_DIR, 'studio.html'), renderStudioHtml(), 'utf8');
  process.stdout.write('html written: docs/studio.html\n');
  fs.writeFileSync(path.join(DOCS_DIR, 'updates.html'), renderUpdatesHtml({}), 'utf8');
  process.stdout.write('html written: docs/updates.html\n');
}

module.exports = { renderEnforcementHtml, renderProcessHtml, renderStudioHtml, renderUpdatesHtml, renderMarkdown, STYLE, ENGINE };

if (require.main === module) {
  main();
}
