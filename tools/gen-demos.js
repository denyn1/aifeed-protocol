#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const nodeCrypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const { buildSite } = require('../lib/site');
const cryptoLib = require('../lib/crypto');
const { verifyRevocationDocument } = require('../lib/revocation');
const siteDefinitions = require('../demos/sites');
const keys = require('../demos/keys');
const { strings } = require('../demos/i18n');

function parseArgs(argv) {
  const args = { out: path.join(ROOT, 'site', 'demos'), check: false, only: null };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--out') args.out = path.resolve(argv[++index]);
    else if (argv[index] === '--check') args.check = true;
    else if (argv[index] === '--only') args.only = argv[++index];
  }
  return args;
}

const LIGHT_TOKENS = `
  --bg: #ffffff; --panel: #f6f6f4; --panel2: #ececea; --text: #0b0b0b; --muted: #5b5b57;
  --faint: #8a8a84; --border: #d9d9d6; --code-bg: #f3f3f1; --code-text: #24211f;
  --topbar-bg: #0b1b34; --topbar-text: #dbe6f5;
`;
const DARK_TOKENS = `
  --bg: #12100f; --panel: #1c1b19; --panel2: #23211f; --text: #f8f8f7; --muted: #a8a29d;
  --faint: #766f6b; --border: rgba(153,153,153,.18); --code-bg: #141311; --code-text: #e8e4e1;
  --topbar-bg: #0d0c0b; --topbar-text: #a8a29d;
`;

const CSS = `
* { box-sizing: border-box; }
html { scroll-behavior: smooth; color-scheme: light dark; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 var(--font); -webkit-font-smoothing: antialiased; }
a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
a:focus-visible, button:focus-visible, input:focus-visible, summary:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
img { max-width: 100%; display: block; }
.wrap { max-width: 1140px; margin: 0 auto; padding: 0 20px; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.skip { position: absolute; left: -9999px; top: 0; background: var(--accent); color: #fff; padding: 10px 16px; z-index: 100; }
.skip:focus { left: 0; }
h1, h2, h3, h4 { font-family: var(--head); line-height: 1.18; }
h1 { font-size: clamp(1.75rem, 3.8vw, 2.7rem); margin: 0 0 12px; }
h2 { font-size: 1.3rem; margin: 0 0 12px; }
h3 { font-size: 1.03rem; margin: 0 0 8px; }
p { margin: 0 0 12px; }
.topbar { background: var(--topbar-bg); color: var(--topbar-text); font-size: .78rem; }
.topbar .wrap { display: flex; justify-content: space-between; gap: 12px; padding: 7px 20px; flex-wrap: wrap; }
.topbar a { color: inherit; }
header.site { background: var(--bg); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 40; }
header.site .bar { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 0; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 10px; color: var(--text); font-family: var(--head); font-weight: 700; font-size: 1.05rem; }
.brand img { width: 32px; height: 32px; }
.brand small { display: block; font: 400 .66rem/1.2 var(--font); color: var(--faint); letter-spacing: .05em; }
nav.main { display: flex; align-items: center; flex-wrap: wrap; }
nav.main a { margin-left: 16px; padding: 6px 0; font-size: .9rem; color: var(--muted); white-space: nowrap; border-bottom: 2px solid transparent; }
nav.main a[aria-current="page"], nav.main a:hover { color: var(--accent); text-decoration: none; border-bottom-color: var(--accent); }
.actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.search { border: 1px solid var(--border); border-radius: 999px; padding: 7px 14px; color: var(--faint); font-size: .82rem; background: var(--panel); min-width: 160px; }
details.menu { position: relative; }
details.menu > summary { list-style: none; cursor: pointer; border: 1px solid var(--border); border-radius: 999px; padding: 7px 14px; font-size: .82rem; color: var(--muted); background: var(--panel); }
details.menu > summary::-webkit-details-marker { display: none; }
details.menu[open] > summary { border-color: var(--accent); color: var(--text); }
.menu-panel { position: absolute; right: 0; top: calc(100% + 8px); z-index: 60; min-width: 300px; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 18px 40px rgba(0,0,0,.18); padding: 14px; }
.menu-panel a { display: block; padding: 7px 10px; border-radius: 8px; color: var(--text); font-size: .9rem; }
.menu-panel a:hover { background: var(--panel); text-decoration: none; }
.menu-panel a[aria-current="true"] { font-weight: 700; color: var(--accent); }
.menu-panel .group { margin-bottom: 8px; }
.menu-panel .group > h4 { font-size: .72rem; text-transform: uppercase; letter-spacing: .09em; color: var(--faint); margin: 6px 10px; }
.menu-panel .desc { display: block; color: var(--faint); font-size: .78rem; }
nav.sub { border-top: 1px solid var(--border); background: var(--panel); }
nav.sub .wrap { display: flex; gap: 16px; padding: 9px 20px; overflow-x: auto; font-size: .83rem; }
nav.sub a { color: var(--muted); white-space: nowrap; }
nav.sub a:hover { color: var(--accent); text-decoration: none; }
main { padding: 28px 0 64px; }
.crumbs { font-size: .8rem; color: var(--faint); margin-bottom: 14px; }
.crumbs a { color: var(--faint); } .crumbs a:hover { color: var(--accent); }
.hero { padding: 22px 0 8px; }
.hero .eyebrow, .kicker { text-transform: uppercase; letter-spacing: .14em; font-size: .72rem; color: var(--accent); margin: 0 0 10px; font-weight: 700; }
.lede { color: var(--muted); font-size: 1.06rem; max-width: 74ch; }
.meta { color: var(--faint); font-size: .84rem; display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
.layout { display: grid; gap: 36px; grid-template-columns: minmax(0, 1fr); }
.layout.with-aside { grid-template-columns: minmax(0, 1fr) 300px; }
@media (max-width: 920px) { .layout.with-aside { grid-template-columns: 1fr; } }
section.block { margin: 30px 0; }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.grid.two { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.grid.four { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
.card { display: block; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: border-color .15s ease, transform .15s ease; color: inherit; }
.card:hover { border-color: var(--accent); transform: translateY(-2px); text-decoration: none; }
.card .body { padding: 14px 16px 16px; }
.card h3 { color: var(--text); margin: 0 0 6px; }
.card p { color: var(--muted); font-size: .88rem; margin: 0; }
.card img { aspect-ratio: 16/9; object-fit: cover; width: 100%; }
.card .tags { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
.thumb { position: relative; }
.badge { position: absolute; margin: 10px; background: var(--accent); color: #fff; font-size: .7rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
.table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: .9rem; }
.table th, .table td { border-bottom: 1px solid var(--border); padding: 10px; text-align: left; vertical-align: top; }
.table th { color: var(--muted); font-size: .74rem; text-transform: uppercase; letter-spacing: .06em; }
.table.striped tbody tr:nth-child(odd) { background: color-mix(in srgb, var(--panel) 55%, transparent); }
.list { color: var(--muted); padding-left: 20px; } .list li { margin: 6px 0; }
.tag { display: inline-block; font-size: .72rem; font-weight: 600; border-radius: 999px; padding: 2px 10px; border: 1px solid var(--border); color: var(--muted); background: color-mix(in srgb, var(--panel) 60%, transparent); }
.tag.ok { color: #0f7a4d; border-color: rgba(15,122,77,.4); } .tag.no { color: #b02020; border-color: rgba(176,32,32,.4); }
html[data-mode="dark"] .tag.ok { color: #3ddc97; border-color: rgba(61,220,151,.4); }
html[data-mode="dark"] .tag.no { color: #ff6b6b; border-color: rgba(255,107,107,.4); }
.tag.warn { color: #a86400; border-color: rgba(168,100,0,.4); } .tag.info { color: #1e6fd9; border-color: rgba(30,111,217,.35); }
html[data-mode="dark"] .tag.warn { color: #ffb454; } html[data-mode="dark"] .tag.info { color: #6ea8fe; }
.note { background: var(--panel); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 10px; padding: 14px 16px; margin: 20px 0; color: var(--muted); }
.notice { border: 1px dashed var(--border); border-radius: 10px; padding: 12px 16px; margin: 16px 0; color: var(--muted); font-size: .9rem; background: color-mix(in srgb, var(--panel) 60%, transparent); }
.btn { display: inline-block; background: var(--accent); color: #fff; border: 0; border-radius: 10px; padding: 11px 18px; font-size: .9rem; font-weight: 600; cursor: pointer; font-family: var(--font); }
.btn:hover { filter: brightness(1.08); text-decoration: none; }
.btn.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
.btn.sm { padding: 7px 13px; font-size: .82rem; }
.btn.block { display: block; text-align: center; }
pre { background: var(--code-bg); color: var(--code-text); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; overflow-x: auto; font-size: .84rem; line-height: 1.55; position: relative; }
code { font-family: ui-monospace, Consolas, monospace; font-size: .9em; }
.copy { position: absolute; right: 10px; top: 10px; font-size: .7rem; border: 1px solid var(--border); background: var(--bg); color: var(--muted); border-radius: 7px; padding: 3px 8px; cursor: pointer; }
blockquote { margin: 20px 0; padding: 14px 20px; border-left: 3px solid var(--accent); background: var(--panel); border-radius: 0 10px 10px 0; font-size: 1.06rem; }
figure { margin: 18px 0; } figcaption { color: var(--faint); font-size: .8rem; margin-top: 8px; }
.stats { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin: 20px 0; }
.stat { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.stat b { display: block; font: 700 1.7rem/1.1 var(--head); color: var(--accent); }
.stat span { color: var(--muted); font-size: .82rem; }
.faq details { border: 1px solid var(--border); border-radius: 10px; background: var(--panel); padding: 13px 16px; margin: 9px 0; }
.faq summary { cursor: pointer; font-family: var(--head); font-weight: 600; font-size: .95rem; }
.faq p { margin: 10px 0 0; color: var(--muted); }
.timeline { border-left: 2px solid var(--border); margin: 18px 0 18px 8px; padding-left: 20px; }
.timeline .step { position: relative; margin: 0 0 18px; }
.timeline .step::before { content: ""; position: absolute; left: -27px; top: 7px; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
.timeline .step b { display: block; } .timeline .step span { color: var(--muted); font-size: .88rem; }
.toc { position: sticky; top: 78px; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.toc + .toc { position: static; margin-top: 14px; }
.toc h4 { margin: 0 0 10px; font-size: .76rem; text-transform: uppercase; letter-spacing: .09em; color: var(--muted); }
.toc a { display: block; color: var(--muted); font-size: .86rem; padding: 4px 0; }
.toc a:hover { color: var(--accent); text-decoration: none; }
.filters { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0 20px; }
.filters a { border: 1px solid var(--border); border-radius: 999px; padding: 6px 14px; font-size: .82rem; color: var(--muted); }
.filters a.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.newsletter { background: color-mix(in srgb, var(--accent) 14%, var(--panel)); border: 1px solid var(--border); border-radius: var(--radius); padding: 22px; margin: 28px 0; }
.newsletter form { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
.newsletter input { flex: 1 1 260px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 11px 14px; color: var(--text); }
.price { font: 700 1.35rem/1 var(--head); color: var(--text); }
.rating { color: #a86400; font-size: .85rem; letter-spacing: 2px; }
html[data-mode="dark"] .rating { color: #ffb454; }
.rating-bar { display: grid; grid-template-columns: 90px 1fr 40px; gap: 10px; align-items: center; color: var(--muted); font-size: .84rem; margin: 6px 0; }
.rating-bar .bar { height: 10px; border-radius: 999px; background: var(--panel2); overflow: hidden; }
.rating-bar .bar i { display: block; height: 100%; background: var(--accent); }
.gallery { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.gallery img { border-radius: 10px; border: 1px solid var(--border); aspect-ratio: 1/1; object-fit: cover; }
.buybox { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; }
.buybox .price { font-size: 1.7rem; margin-bottom: 8px; }
.buybox .row { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.variant { border: 1px solid var(--border); border-radius: 999px; padding: 6px 14px; font-size: .84rem; color: var(--muted); }
.variant.active { border-color: var(--accent); color: var(--text); font-weight: 600; }
.trust { display: flex; gap: 16px; flex-wrap: wrap; color: var(--faint); font-size: .8rem; margin-top: 12px; }
.author { display: flex; gap: 12px; align-items: center; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; margin: 22px 0; }
.author img { width: 54px; height: 54px; border-radius: 50%; }
.author b { display: block; } .author span { color: var(--muted); font-size: .85rem; }
.related { list-style: none; margin: 0; padding: 0; }
.related li { padding: 10px 0; border-bottom: 1px solid var(--border); }
.related a { color: var(--text); } .related a:hover { color: var(--accent); }
.pager { display: flex; gap: 8px; margin: 22px 0; }
.pager a, .pager span { border: 1px solid var(--border); border-radius: 8px; padding: 7px 13px; font-size: .85rem; color: var(--muted); }
.pager .active { background: var(--accent); border-color: var(--accent); color: #fff; }
.ticker { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 22px; }
.ticker div { padding: 10px 16px; font-size: .86rem; color: var(--muted); border-bottom: 1px solid var(--border); }
.ticker div:last-child { border-bottom: 0; }
.ticker b { color: var(--accent); margin-right: 8px; }
.action-list { list-style: none; margin: 0; padding: 0; }
.action-list li { border-bottom: 1px solid var(--border); }
.action-list a { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 2px; color: var(--text); font-weight: 600; }
.action-list a:hover { color: var(--accent); text-decoration: none; }
.action-list .arrow { color: var(--accent); }
.banner { display: block; background: color-mix(in srgb, var(--accent) 16%, var(--panel)); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; margin: 26px 0; color: var(--text); }
.banner strong { font-family: var(--head); } .banner small { display: block; color: var(--muted); margin-top: 4px; }
.article-body { max-width: 72ch; }
.article-body > p:first-of-type::first-letter { font-family: var(--head); font-size: 3.1rem; line-height: .85; float: left; padding: 6px 10px 0 0; color: var(--accent); }
.steps { list-style: none; margin: 0; padding: 0; counter-reset: s; }
.steps li { position: relative; padding: 10px 0 10px 44px; border-bottom: 1px solid var(--border); color: var(--muted); }
.steps li::before { counter-increment: s; content: counter(s, decimal-leading-zero); position: absolute; left: 0; top: 10px; font: 700 .78rem ui-monospace, monospace; color: var(--accent); border: 1px solid var(--border); border-radius: 8px; padding: 2px 7px; }
.verifier .row { display: flex; gap: 8px; flex-wrap: wrap; }
.verifier input[type=url] { flex: 1 1 320px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; color: var(--text); padding: 11px 13px; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.chips button { background: transparent; border: 1px solid var(--border); color: var(--muted); border-radius: 999px; padding: 6px 13px; cursor: pointer; font-size: .82rem; }
.chips button:hover { color: var(--text); border-color: var(--accent); }
footer.site { border-top: 1px solid var(--border); background: var(--panel); margin-top: 44px; }
footer.site .cols { display: grid; gap: 26px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); padding: 34px 0 24px; }
footer.site h4 { font-size: .76rem; text-transform: uppercase; letter-spacing: .09em; color: var(--muted); margin: 0 0 10px; }
footer.site a { display: block; color: var(--faint); font-size: .86rem; padding: 3px 0; }
footer.site a:hover { color: var(--accent); }
footer.site .legal { border-top: 1px solid var(--border); padding: 14px 0 24px; color: var(--faint); font-size: .8rem; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cookie { background: var(--panel2); border-bottom: 1px solid var(--border); font-size: .84rem; }
.cookie .wrap { display: flex; justify-content: space-between; gap: 14px; padding: 10px 20px; align-items: center; flex-wrap: wrap; }
.cookie button { background: transparent; border: 1px solid var(--border); color: var(--muted); border-radius: 8px; padding: 6px 12px; cursor: pointer; font-size: .8rem; }
.status-pill { display: inline-flex; align-items: center; gap: 7px; border-radius: 999px; padding: 4px 12px; font-size: .8rem; font-weight: 600; border: 1px solid var(--border); }
.status-pill::before { content: ""; width: 9px; height: 9px; border-radius: 50%; background: #0f7a4d; }
.status-pill.warn::before { background: #a86400; } .status-pill.bad::before { background: #b02020; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } html { scroll-behavior: auto; } }
@media (max-width: 640px) { .grid.four { grid-template-columns: 1fr 1fr; } }
`;

const CSS_V2 = `

/* v2 editorial system: appended overrides for the base stylesheet above */
.masthead { border-bottom: 1px solid var(--border); background: var(--panel); }
.masthead .wrap { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; padding: 12px 20px; flex-wrap: wrap; }
.masthead .dateline { font-size: .8rem; color: var(--muted); }
.masthead .dateline b { color: var(--text); font-weight: 700; }
.masthead .edition { font-size: .8rem; color: var(--faint); }
.masthead .weather { font-size: .8rem; color: var(--muted); }
.serp-title, .display { font-family: var(--display); }
.lede { font-size: 1.1rem; }
.kicker-bar { border-left: 4px solid var(--accent); padding-left: 14px; margin: 22px 0; }
.kicker-bar .kicker { margin-bottom: 4px; }
.story-grid { display: grid; gap: 0; border-top: 2px solid var(--text); }
.story-grid a.item { display: grid; grid-template-columns: 220px 1fr; gap: 18px; padding: 20px 0; border-bottom: 1px solid var(--border); color: inherit; }
.story-grid a.item:hover { text-decoration: none; }
.story-grid a.item:hover h3 { color: var(--accent); }
.story-grid img { border-radius: 10px; aspect-ratio: 16/10; object-fit: cover; border: 1px solid var(--border); }
.story-grid h3 { font-size: 1.25rem; margin: 0 0 6px; }
.story-grid .dek { color: var(--muted); font-size: .92rem; margin: 0 0 8px; }
.story-grid .byline { color: var(--faint); font-size: .78rem; }
@media (max-width: 700px) { .story-grid a.item { grid-template-columns: 120px 1fr; } }
.byline-row { display: flex; gap: 12px; align-items: center; color: var(--faint); font-size: .84rem; margin: 6px 0 18px; flex-wrap: wrap; }
.share { display: flex; gap: 8px; align-items: center; margin: 22px 0; color: var(--faint); font-size: .82rem; }
.share a { border: 1px solid var(--border); border-radius: 8px; color: var(--muted); padding: 6px 12px; font-size: .8rem; display: inline-flex; gap: 6px; align-items: center; }
.share a:hover { color: var(--text); border-color: var(--accent); text-decoration: none; }
.share svg { width: 14px; height: 14px; }
.dropcap::first-letter { font-family: var(--display); font-size: 3.4rem; line-height: .82; float: left; padding: 8px 12px 0 0; color: var(--accent); font-weight: 800; }
.pull { margin: 24px 0; padding: 4px 0 4px 22px; border-left: 4px solid var(--accent); font-family: var(--display); font-size: 1.3rem; line-height: 1.4; }
.factbox { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; margin: 20px 0; }
.factbox h4 { margin: 0 0 8px; font-size: .76rem; text-transform: uppercase; letter-spacing: .09em; color: var(--muted); }
.factbox ul { margin: 0; padding-left: 18px; color: var(--muted); font-size: .9rem; }
.buybox { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 20px; position: sticky; top: 150px; box-shadow: var(--shadow); }
.buybox .price { font-size: 1.8rem; margin: 4px 0 2px; }
.buybox .per { color: var(--faint); font-size: .8rem; }
.buybox .row { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0; }
.variant { border: 1.5px solid var(--border); border-radius: 10px; padding: 8px 14px; font-size: .84rem; color: var(--muted); cursor: pointer; background: transparent; font-family: var(--font); }
.variant.active { border-color: var(--accent); color: var(--text); font-weight: 700; }
.qty { display: inline-flex; align-items: center; border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden; }
.qty button { background: transparent; border: 0; color: var(--text); font-size: 1.1rem; padding: 8px 14px; cursor: pointer; }
.qty span { min-width: 34px; text-align: center; font-weight: 700; }
.delivery { border-top: 1px solid var(--border); margin-top: 14px; padding-top: 12px; font-size: .85rem; color: var(--muted); }
.delivery b { color: var(--text); }
.review-bars { margin: 14px 0; }
.review-bars .rb { display: grid; grid-template-columns: 64px 1fr 40px; gap: 10px; align-items: center; color: var(--muted); font-size: .84rem; margin: 7px 0; }
.review-bars .bar { height: 10px; border-radius: 999px; background: var(--panel2); overflow: hidden; }
.review-bars .bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); }
.govuk-panel { background: var(--accent); color: #fff; border-radius: 0; padding: 30px 26px; margin: 0 0 26px; }
.govuk-panel h1 { color: #fff; margin-bottom: 8px; }
.govuk-panel p { color: rgba(255,255,255,.92); margin: 0; }
.tasklist { list-style: none; margin: 18px 0; padding: 0; }
.tasklist li { border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin: 10px 0; display: flex; gap: 14px; align-items: flex-start; background: var(--panel); }
.tasklist .num { flex: none; width: 30px; height: 30px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: .85rem; }
.tasklist b { display: block; } .tasklist span { color: var(--muted); font-size: .88rem; }
.startbtn { display: inline-flex; align-items: center; gap: 10px; background: #00703c; color: #fff !important; font-weight: 800; font-size: 1.05rem; padding: 12px 22px; border-radius: 0; }
.startbtn:hover { background: #005a30; text-decoration: none; }
.docshell { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 30px; }
.docsnav { position: sticky; top: 88px; align-self: start; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; font-size: .88rem; }
.docsnav h4 { font-size: .74rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 10px 0 6px; }
.docsnav a { display: block; color: var(--muted); padding: 4px 0; }
.docsnav a:hover, .docsnav a[aria-current="page"] { color: var(--accent); text-decoration: none; }
@media (max-width: 900px) { .docshell { grid-template-columns: 1fr; } .docsnav { position: static; } }
.callout { border: 1px solid var(--border); border-left: 4px solid var(--info, var(--accent)); border-radius: 10px; padding: 14px 16px; margin: 20px 0; background: var(--panel); }
.callout.warn { border-left-color: var(--warn, #ffb454); } .callout.danger { border-left-color: var(--bad, #b02020); }
.callout h4 { margin: 0 0 6px; font-size: .8rem; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); }
.codetabs { margin: 16px 0; }
.codetabs details { border: 1px solid var(--border); border-radius: 10px; margin: 8px 0; background: var(--panel); }
.codetabs summary { cursor: pointer; padding: 10px 14px; font-family: var(--mono); font-size: .82rem; color: var(--muted); }
.statusline { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); margin: 16px 0; font-size: .9rem; }
.progress { position: fixed; top: 0; left: 0; height: 3px; background: var(--accent); width: 0; z-index: 200; }
.totop { position: fixed; right: 18px; bottom: 18px; z-index: 90; border: 1px solid var(--border); background: var(--panel); color: var(--text); width: 42px; height: 42px; border-radius: 12px; cursor: pointer; font-size: 1.1rem; display: none; box-shadow: var(--shadow); }
.totop.show { display: block; }
.footbrand { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.footbrand img { width: 34px; height: 34px; }
.social { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.social a { border: 1px solid var(--border); border-radius: 8px; padding: 5px 10px; font-size: .76rem; }
.two-col { display: grid; gap: 26px; grid-template-columns: 1fr 1fr; }
@media (max-width: 720px) { .two-col { grid-template-columns: 1fr; } }
.kv { display: grid; grid-template-columns: 150px 1fr; gap: 6px 14px; font-size: .9rem; margin: 12px 0; }
.kv dt { color: var(--faint); } .kv dd { margin: 0; }
.checkrow { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; border-bottom: 1px solid var(--border); font-size: .9rem; }
.checkrow:last-child { border-bottom: 0; }
.checkrow .ok { color: var(--ok, #0f7a4d); font-weight: 800; }
html[data-mode="dark"] .checkrow .ok { color: #3ddc97; }
`;

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) >>> 0);
    return (state % 10000) / 10000;
  };
}

function artSvg(theme, kind, seedText, sub) {
  const random = makeRandom(hashSeed((sub || '') + '|' + kind + '|' + seedText));
  const wide = kind === 'hero' || kind === 'wide';
  const width = wide ? 1200 : 400;
  const height = wide ? 420 : 400;
  const scene = pickScene(sub, kind, seedText, random);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escapeHtml(seedText) + '">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="' + theme.accent + '"/><stop offset="1" stop-color="' + theme.accent2 + '"/></linearGradient></defs>' +
    scene +
    '</svg>\n';
}

function pickScene(sub, kind, seedText, random) {
  if (kind === 'avatar') return scenePortrait(sub, seedText, random);
  if (kind === 'product') return sceneStillLife(sub, seedText, random);
  if (/thumb-|avatar/.test(seedText) && kind !== 'hero' && kind !== 'wide') return sceneKicker(sub, seedText, random);
  if (sub === 'news') return sceneHarbor(random);
  if (sub === 'shop') return sceneMarket(random);
  if (sub === 'gov') return sceneFacade(random);
  if (sub === 'demo') return sceneNetwork(random);
  if (sub === 'strict') return sceneShield(random);
  if (sub === 'revoked') return sceneSeal(random);
  if (sub === 'verify') return sceneChecklist(random);
  return sceneGrid(random);
}

function halftone(random, width, height, color) {
  let dots = '';
  for (let y = 24; y < height; y += 34) {
    for (let x = 24; x < width; x += 34) {
      if (random() > 0.72) dots += '<circle cx="' + x + '" cy="' + y + '" r="2.4" fill="' + color + '" opacity="0.5"/>';
    }
  }
  return dots;
}

function sceneHarbor(random) {
  const s = [];
  s.push('<rect width="1200" height="420" fill="#0e2a4a"/>');
  s.push('<rect y="240" width="1200" height="180" fill="#0a1f38"/>');
  s.push('<circle cx="960" cy="120" r="64" fill="#f4c95d"/>');
  for (let i = 0; i < 5; i++) s.push('<ellipse cx="' + Math.round(120 + random() * 960) + '" cy="' + Math.round(60 + random() * 130) + '" rx="' + Math.round(60 + random() * 80) + '" ry="14" fill="rgba(255,255,255,.08)"/>');
  s.push('<path d="M300 250 L880 250 L830 302 L350 302 Z" fill="#10253f"/>');
  const paint = ['#c0392b', '#2e7d6f', '#b98a2f', '#3a6ea5'];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      s.push('<rect x="' + (330 + col * 42) + '" y="' + (192 + row * 20) + '" width="38" height="17" fill="' + paint[Math.floor(random() * 4)] + '"/>');
    }
  }
  s.push('<g stroke="#dfe9f2" stroke-width="8" stroke-linecap="round"><line x1="150" y1="420" x2="150" y2="120"/><line x1="150" y1="120" x2="330" y2="150"/></g>');
  s.push('<g stroke="rgba(255,255,255,.5)" stroke-width="3" fill="none"><path d="M180 110 q14 -12 28 0"/><path d="M230 90 q14 -12 28 0"/></g>');
  s.push(halftone(random, 1200, 420, 'rgba(255,255,255,.5)'));
  return s.join('');
}

function sceneMarket(random) {
  const s = [];
  s.push('<rect width="1200" height="420" fill="#171310"/>');
  s.push('<rect y="0" width="1200" height="120" fill="url(#g)" opacity="0.25"/>');
  const paint = ['#b26a00', '#7a4a12', '#d9a441', '#5b3a16'];
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 150 + shelf * 90;
    s.push('<rect x="60" y="' + y + '" width="1080" height="8" rx="4" fill="rgba(255,255,255,.18)"/>');
    for (let i = 0; i < 8; i++) {
      const x = 90 + i * 130;
      const h = 44 + Math.floor(random() * 30);
      s.push('<rect x="' + x + '" y="' + (y - h) + '" width="52" height="' + h + '" rx="6" fill="' + paint[Math.floor(random() * 4)] + '"/>');
      s.push('<rect x="' + x + '" y="' + (y - h + 8) + '" width="52" height="10" fill="rgba(255,255,255,.35)"/>');
    }
  }
  s.push(halftone(random, 1200, 420, 'rgba(255,255,255,.4)'));
  return s.join('');
}

function sceneFacade(random) {
  const s = [];
  s.push('<rect width="1200" height="420" fill="#0f2a20"/>');
  s.push('<rect width="1200" height="420" fill="url(#g)" opacity="0.12"/>');
  s.push('<polygon points="200,120 600,30 1000,120" fill="rgba(255,255,255,.14)"/>');
  for (let i = 0; i < 6; i++) {
    const x = 250 + i * 110;
    s.push('<rect x="' + x + '" y="120" width="34" height="200" fill="rgba(255,255,255,.16)"/>');
    s.push('<rect x="' + (x - 8) + '" y="112" width="50" height="10" fill="rgba(255,255,255,.22)"/>');
    s.push('<rect x="' + (x - 8) + '" y="320" width="50" height="10" fill="rgba(255,255,255,.22)"/>');
  }
  for (let i = 0; i < 3; i++) s.push('<rect x="180" y="' + (330 + i * 24) + '" width="840" height="14" fill="rgba(255,255,255,.1)"/>');
  s.push(halftone(random, 1200, 420, 'rgba(255,255,255,.4)'));
  return s.join('');
}

function sceneNetwork(random) {
  const s = [];
  s.push('<rect width="1200" height="420" fill="#100f0e"/>');
  const nodes = [];
  for (let i = 0; i < 14; i++) nodes.push([90 + random() * 1020, 60 + random() * 300]);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i][0] - nodes[j][0];
      const dy = nodes[i][1] - nodes[j][1];
      if (Math.hypot(dx, dy) < 260) s.push('<line x1="' + Math.round(nodes[i][0]) + '" y1="' + Math.round(nodes[i][1]) + '" x2="' + Math.round(nodes[j][0]) + '" y2="' + Math.round(nodes[j][1]) + '" stroke="rgba(245,80,54,.35)" stroke-width="2"/>');
    }
  }
  nodes.forEach((node, index) => {
    s.push('<circle cx="' + Math.round(node[0]) + '" cy="' + Math.round(node[1]) + '" r="' + (index % 4 === 0 ? 11 : 6) + '" fill="' + (index % 3 === 0 ? '#ff8f6b' : '#f55036') + '"/>');
  });
  s.push('<g font-family="monospace" font-size="15" fill="#8fd6b3"><rect x="830" y="250" width="300" height="120" rx="10" fill="#171614" stroke="rgba(143,214,179,.5)"/><text x="852" y="286">$ aifeed verify</text><text x="852" y="312" fill="#f55036">VERIFIED</text><text x="852" y="338">bytes -68.83%</text></g>');
  return s.join('');
}

function sceneShield(random) {
  const s = [];
  s.push('<rect width="1200" height="420" fill="#16090a"/>');
  s.push('<rect width="1200" height="420" fill="url(#g)" opacity="0.2"/>');
  s.push('<path d="M600 60 L760 120 V240 C760 320 690 370 600 396 C510 370 440 320 440 240 V120 Z" fill="none" stroke="#ff6b6b" stroke-width="14"/>');
  s.push('<path d="M540 230 l45 45 l95 -110" fill="none" stroke="#ffffff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>');
  for (let i = 0; i < 5; i++) {
    s.push('<rect x="' + (180 + i * 8) + '" y="150" width="620" height="10" rx="5" fill="rgba(255,255,255,.10)"/>');
  }
  s.push(halftone(random, 1200, 420, 'rgba(255,255,255,.35)'));
  return s.join('');
}

function sceneSeal(random) {
  const s = [];
  s.push('<rect width="1200" height="420" fill="#141019"/>');
  s.push('<circle cx="600" cy="210" r="130" fill="none" stroke="#8f7bff" stroke-width="16"/>');
  s.push('<line x1="480" y1="110" x2="720" y2="310" stroke="#ff6b6b" stroke-width="16" stroke-linecap="round"/>');
  s.push('<rect x="470" y="330" width="90" height="26" rx="6" fill="rgba(143,123,255,.5)"/>');
  s.push('<rect x="640" y="64" width="90" height="26" rx="6" fill="rgba(255,107,107,.5)"/>');
  s.push('<g font-family="monospace" font-size="22" fill="rgba(255,255,255,.65)"><text x="150" y="120">key: demo-gov-1 ok</text><text x="150" y="160">key: demo-gov-2 ok</text><text x="860" y="380">2 of 2 required</text></g>');
  s.push(halftone(random, 1200, 420, 'rgba(255,255,255,.35)'));
  return s.join('');
}

function sceneChecklist(random) {
  const s = [];
  s.push('<rect width="1200" height="420" fill="#0b1420"/>');
  const rows = ['discovery', 'strict parse', 'domain', 'signature', 'anchor', 'permissions'];
  rows.forEach((label, index) => {
    const y = 66 + index * 52;
    s.push('<rect x="120" y="' + y + '" width="960" height="40" rx="10" fill="rgba(255,255,255,.07)"/>');
    s.push('<rect x="140" y="' + (y + 12) + '" width="16" height="16" rx="4" fill="none" stroke="#3ddc97" stroke-width="3"/>');
    s.push('<path d="M142 ' + (y + 20) + ' l5 5 l8 -9" stroke="#3ddc97" stroke-width="3" fill="none"/>');
    s.push('<text x="170" y="' + (y + 26) + '" font-family="monospace" font-size="20" fill="#dbe6f5">' + label + '</text>');
  });
  return s.join('');
}

function sceneGrid(random) {
  const s = [];
  s.push('<rect width="1200" height="420" fill="#100f0e"/>');
  for (let x = 0; x <= 1200; x += 60) s.push('<line x1="' + x + '" y1="0" x2="' + x + '" y2="420" stroke="rgba(255,255,255,.05)" stroke-width="1"/>');
  for (let y = 0; y <= 420; y += 60) s.push('<line x1="0" y1="' + y + '" x2="1200" y2="' + y + '" stroke="rgba(255,255,255,.05)" stroke-width="1"/>');
  s.push('<circle cx="600" cy="210" r="72" fill="none" stroke="#f55036" stroke-width="10"/>');
  s.push('<path d="M566 210 l24 24 l48 -56" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>');
  return s.join('');
}

function sceneStillLife(sub, seedText, random) {
  const width = 400;
  const height = 400;
  const s = [];
  s.push('<rect width="' + width + '" height="' + height + '" fill="url(#g)"/>');
  s.push('<rect width="' + width + '" height="' + height + '" fill="rgba(15,14,13,.35)"/>');
  s.push('<ellipse cx="' + (width / 2) + '" cy="' + Math.round(height * 0.82) + '" rx="' + Math.round(width * 0.3) + '" ry="24" fill="rgba(0,0,0,.3)"/>');
  const variant = Math.floor(random() * 4);
  const cx = width / 2;
  if (variant === 0) {
    s.push('<rect x="' + (cx - 70) + '" y="120" width="140" height="190" rx="14" fill="rgba(20,14,8,.85)" stroke="rgba(255,255,255,.35)" stroke-width="3"/>');
    s.push('<rect x="' + (cx - 70) + '" y="170" width="140" height="70" fill="#f3ead9"/>');
    s.push('<rect x="' + (cx - 46) + '" y="186" width="92" height="10" fill="#7a4a12"/>');
    s.push('<rect x="' + (cx - 46) + '" y="204" width="64" height="10" fill="#7a4a12"/>');
    s.push('<rect x="' + (cx - 34) + '" y="92" width="68" height="30" rx="8" fill="rgba(20,14,8,.9)" stroke="rgba(255,255,255,.35)" stroke-width="3"/>');
  } else if (variant === 1) {
    s.push('<path d="M' + (cx - 70) + ' 180 h140 v110 a70 70 0 0 1 -140 0 Z" fill="rgba(243,234,217,.92)"/>');
    s.push('<path d="M' + (cx + 70) + ' 205 q46 8 20 52 q-16 26 -48 10" fill="none" stroke="rgba(20,14,8,.8)" stroke-width="12"/>');
    s.push('<path d="M' + (cx - 20) + ' 120 q-14 -26 4 -52 M' + cx + ' 118 q-6 -30 16 -52" stroke="rgba(255,255,255,.6)" stroke-width="7" fill="none" stroke-linecap="round"/>');
  } else if (variant === 2) {
    s.push('<rect x="' + (cx - 80) + '" y="150" width="160" height="160" rx="12" fill="rgba(20,14,8,.85)" stroke="rgba(255,255,255,.35)" stroke-width="3"/>');
    s.push('<rect x="' + (cx - 80) + '" y="196" width="160" height="50" fill="#f3ead9"/>');
    s.push('<rect x="' + (cx - 52) + '" y="212" width="104" height="10" fill="#7a4a12"/>');
    s.push('<rect x="' + (cx - 52) + '" y="228" width="70" height="10" fill="#7a4a12"/>');
  } else {
    s.push('<ellipse cx="' + cx + '" cy="250" rx="84" ry="92" fill="rgba(20,14,8,.85)" stroke="rgba(255,255,255,.35)" stroke-width="3"/>');
    s.push('<ellipse cx="' + cx + '" cy="150" rx="30" ry="14" fill="rgba(20,14,8,.9)" stroke="rgba(255,255,255,.35)" stroke-width="3"/>');
    s.push('<rect x="' + (cx - 44) + '" y="216" width="88" height="52" fill="#f3ead9"/>');
  }
  s.push(halftone(random, width, height, 'rgba(255,255,255,.35)'));
  return s.join('');
}

function scenePortrait(sub, seedText, random) {
  const width = 400;
  const height = 400;
  const skin = ['#e8b98d', '#c98d5f', '#8a5a34', '#f2d3ac'][Math.floor(random() * 4)];
  const s = [];
  s.push('<rect width="' + width + '" height="' + height + '" fill="url(#g)"/>');
  s.push('<circle cx="' + Math.round(width * (0.2 + random() * 0.6)) + '" cy="' + Math.round(height * 0.3) + '" r="120" fill="rgba(255,255,255,.12)"/>');
  s.push('<ellipse cx="' + (width / 2) + '" cy="350" rx="120" ry="110" fill="' + skin + '"/>');
  s.push('<rect x="60" y="300" width="280" height="100" rx="40" fill="#20242c"/>');
  s.push('<circle cx="' + (width / 2) + '" cy="168" r="62" fill="' + skin + '"/>');
  const hair = Math.floor(random() * 3);
  if (hair === 0) s.push('<path d="M' + (width / 2 - 66) + ' 160 a66 62 0 0 1 132 0 l0 -24 a66 62 0 0 0 -132 0 Z" fill="#241d16"/>');
  else if (hair === 1) s.push('<path d="M' + (width / 2 - 66) + ' 150 a66 60 0 0 1 132 0 l6 110 q-40 -34 -72 0 q-32 -34 -66 0 Z" fill="#3a2a1a"/>');
  else s.push('<rect x="' + (width / 2 - 66) + '" y="100" width="132" height="44" rx="22" fill="#151312"/>');
  if (random() > 0.55) {
    s.push('<g stroke="#151312" stroke-width="5" fill="none"><circle cx="' + (width / 2 - 30) + '" cy="180" r="18"/><circle cx="' + (width / 2 + 30) + '" cy="180" r="18"/><line x1="' + (width / 2 - 12) + '" y1="180" x2="' + (width / 2 + 12) + '" y2="180"/></g>');
  }
  s.push('<circle cx="' + (width / 2 - 24) + '" cy="182" r="5" fill="#151312"/><circle cx="' + (width / 2 + 24) + '" cy="182" r="5" fill="#151312"/>');
  s.push('<path d="M' + (width / 2 - 18) + ' 218 q18 12 36 0" stroke="#151312" stroke-width="5" fill="none" stroke-linecap="round"/>');
  return s.join('');
}

function sceneKicker(sub, seedText, random) {
  const width = 400;
  const height = 400;
  const initial = String(seedText).trim().split(/[-_]/).map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase() || 'AI';
  const s = [];
  s.push('<rect width="' + width + '" height="' + height + '" fill="url(#g)"/>');
  s.push('<rect width="' + width + '" height="' + height + '" fill="rgba(15,14,13,.3)"/>');
  s.push(halftone(random, width, height, 'rgba(255,255,255,.5)'));
  s.push('<rect x="28" y="28" width="' + (width - 56) + '" height="' + (height - 56) + '" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3"/>');
  s.push('<text x="' + (width / 2) + '" y="' + (height / 2 + 40) + '" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="140" fill="#ffffff" opacity="0.92">' + initial + '</text>');
  return s.join('');
}

function writeArt(dir, theme, name, kind, seedText, sub) {
  const file = path.join(dir, 'assets', name + '.svg');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, artSvg(theme, kind, seedText, sub), 'utf8');
  return '/assets/' + name + '.svg';
}

function pagePathMaps(site) {
  const map = {};
  for (const page of site.pages) {
    map[page.path] = page.path === '/' ? '/id/' : '/id/' + (page.slugId || page.path.replace(/^\//, ''));
  }
  return map;
}

function localizeHref(href, lang, maps) {
  if (lang !== 'id') return href;
  if (maps[href]) return maps[href];
  for (const [en, id] of Object.entries(maps)) {
    if (en !== '/' && href.startsWith(en)) return id + href.slice(en.length);
  }
  return href === '/' ? '/id/' : href;
}

function t(site, lang, key, fallback) {
  const value = strings(lang, site.sub, key);
  if (value === key && fallback) return fallback;
  return value;
}

function tokenize(body, site, lang) {
  return String(body).replace(/\{\{(\w+)\}\}/g, (match, key) => escapeHtml(t(site, lang, key, key)));
}

function skipLink(site, lang) {
  return '<a class="skip" href="#main">' + escapeHtml(t(site, lang, 'skip')) + '</a>';
}

function languageMenu(site, lang, maps) {
  const enHref = maps.__current || '/';
  const idHref = maps.__currentId || '/id/';
  return [
    '<details class="menu"><summary>' + escapeHtml(t(site, lang, 'language')) + ' · ' + (lang === 'id' ? 'ID' : 'EN') + '</summary>',
    '<div class="menu-panel">',
    '<a href="' + enHref + '"' + (lang === 'en' ? ' aria-current="true"' : '') + '>' + escapeHtml(t(site, lang, 'english')) + ' <span class="desc">English (default)</span></a>',
    '<a href="' + idHref + '"' + (lang === 'id' ? ' aria-current="true"' : '') + '>' + escapeHtml(t(site, lang, 'indonesian')) + ' <span class="desc">Terjemahan resmi demo</span></a>',
    '</div></details>'
  ].join('');
}

function megaMenu(site, lang, maps) {
  if (!site.menuGroups) return '';
  const groups = site.menuGroups.map(([titleKey, items]) => {
    const list = items.map((item) => {
      const href = localizeHref(item.href, lang, maps);
      const label = lang === 'id' && item.id ? item.id : item.en;
      const desc = item.desc ? '<span class="desc">' + escapeHtml(item.desc) + '</span>' : '';
      return '<a href="' + href + '">' + escapeHtml(label) + desc + '</a>';
    }).join('');
    return '<div class="group"><h4>' + escapeHtml(t(site, lang, titleKey)) + '</h4>' + list + '</div>';
  }).join('');
  const wide = (site.menuGroups || []).reduce((count, group) => count + group[1].length, 0) > 4;
  const label = t(site, lang, 'menu');
  return '<details class="menu"><summary aria-haspopup="true">' + escapeHtml(label) + '</summary><div class="menu-panel' + (wide ? ' wide' : '') + '">' + groups + '</div></details>';
}

function fontLinks(site) {
  if (!site.fontCss) return '';
  return '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="' + site.fontCss + '">';
}

function mastheadDate(lang) {
  try {
    return new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch (error) {
    return new Date().toISOString().slice(0, 10);
  }
}

function fontLinks(site) {
  if (!site.fontCss) return '';
  return '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="' + site.fontCss + '">';
}

function mastheadDate(lang) {
  try {
    return new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch (error) {
    return new Date().toISOString().slice(0, 10);
  }
}

function mastheadRow(site, lang) {
  if (!site.masthead) return '';
  return '<div class="masthead"><div class="wrap"><span class="dateline"><b>' + escapeHtml(mastheadDate(lang)) + '</b> · ' + escapeHtml(site.masthead.edition) + '</span><span class="weather">' + escapeHtml(site.masthead.weather) + '</span></div></div>';
}

function promoRow(site) {
  if (!site.promo) return '';
  const text = typeof site.promo === 'object' ? site.promo : { en: site.promo, id: site.promo };
  return '<div class="promo"><div class="wrap">' + escapeHtml(text.en) + ' <a href="' + escapeHtml(site.promoHref || '/') + '">' + escapeHtml(site.promoCta || 'Shop now') + '</a></div></div>';
}

function phaseRow(site) {
  if (!site.phase) return '';
  return '<div class="phase"><div class="wrap"><span class="phase-tag">' + escapeHtml(site.phase.tag) + '</span><span>' + escapeHtml(site.phase.text) + ' <a href="' + escapeHtml(site.phase.href || '#') + '">' + escapeHtml(site.phase.cta || 'Give feedback') + '</a></span></div></div>';
}

function header(site, page, lang, maps) {
  const navItems = (page.__nav || site.nav).map(([href, labelKey, labelId]) => {
    const localized = localizeHref(href, lang, maps);
    const current = page.path === href || (href !== '/' && page.path.startsWith(href));
    const label = lang === 'id' && labelId ? labelId : labelKey;
    return '<a href="' + localized + '"' + (current ? ' aria-current="page"' : '') + '>' + escapeHtml(label) + '</a>';
  }).join('');
  const subnav = site.subnav
    ? '<nav class="sub" aria-label="Section"><div class="wrap">' + site.subnav.map(([href, enLabel, idLabel]) =>
      '<a href="' + localizeHref(href, lang, maps) + '">' + escapeHtml(lang === 'id' && idLabel ? idLabel : enLabel) + '</a>').join('') + '</div></nav>'
    : '';
  const cta = site.ctaLabel ? '<a class="btn sm" href="' + localizeHref(site.ctaHref || '/', lang, maps) + '">' + escapeHtml(t(site, lang, 'cta', site.ctaLabel)) + '</a>' : '';
  return [
    promoRow(site),
    '<div class="topbar"><div class="wrap"><span>' + escapeHtml(site.tagline || '') + '</span><span>' + escapeHtml(site.topContact || '') + '</span></div></div>',
    mastheadRow(site, lang),
    '<header class="site"><div class="wrap bar">',
    '<a class="brand" href="' + localizeHref('/', lang, maps) + '"><img src="/assets/logo.svg" alt=""><span>' + escapeHtml(site.name) + '<small>' + escapeHtml(site.domain) + '</small></span></a>',
    '<nav class="main" aria-label="Main">' + navItems + '</nav>',
    '<div class="actions">',
    site.search ? '<a class="searchlink" href="' + localizeHref('/search/', lang, maps) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg><span>' + escapeHtml(t(site, lang, 'search')) + '</span></a>' : '',
    megaMenu(site, lang, maps),
    languageMenu(site, lang, maps),
    cta,
    '</div>',
    '</div>' + subnav + phaseRow(site) + '</header>'
  ].join('\n');
}

function footer(site, lang, maps) {
  const columns = (site.footerCols || []).map(([titleKey, links]) => [
    '<div><h4>' + escapeHtml(t(site, lang, titleKey)) + '</h4>' + links.map(([href, labelKey]) => {
      const label = t(site, lang, labelKey, labelKey);
      return '<a href="' + localizeHref(href, lang, maps) + '">' + escapeHtml(label) + '</a>';
    }).join('') + '</div>'
  ].join('')).join('');
  const year = new Date().getFullYear();
  return [
    '<footer class="site"><div class="wrap">',
    '<div class="cols">',
    '<div><h4>' + escapeHtml(site.name) + '</h4><p style="color:var(--faint);font-size:.86rem">' + escapeHtml(site.about || '') + '</p><div class="social"><a href="/sitemap.xml">Sitemap</a><a href="https://github.com/denyn1/aifeed-protocol">GitHub</a><a href="mailto:contact@aifeed.md">Contact</a></div></div>',
    columns,
    '</div>',
    '<div class="legal"><span>© ' + year + ' ' + escapeHtml(site.name) + ' · ' + escapeHtml(t(site, lang, 'demoOrigin')) + '</span>',
    '<span><a href="/.well-known/ai.json">ai.json</a> · <a href="/.well-known/aifeed-index.json">index</a> · <a href="/llms.txt">llms.txt</a> · <a href="https://verify.aifeed.md">' + escapeHtml(t(site, lang, 'verifySite')) + '</a></span></div>',
    '</div></footer>'
  ].join('\n');
}

function breadcrumbs(site, page, lang, maps) {
  if (!page.crumbs) return '';
  const enLabels = page.crumbs;
  const idLabels = page.crumbsId || page.crumbs;
  const items = [['/', t(site, lang, 'home')]].concat(enLabels.slice(0, -1).map((label, index) => [page.crumbsHrefs ? page.crumbsHrefs[index] : '#', (lang === 'id' ? idLabels : enLabels)[index]]));
  const last = (lang === 'id' ? idLabels : enLabels)[enLabels.length - 1];
  return '<p class="crumbs">' + items.map(([href, label]) => '<a href="' + localizeHref(href, lang, maps) + '">' + escapeHtml(label) + '</a> / ').join('') + escapeHtml(last) + '</p>';
}

function renderAside(page, site, lang, maps) {
  if (!page.aside) return '';
  const parts = [];
  if (page.toc) {
    parts.push('<div class="toc"><h4>' + escapeHtml(t(site, lang, 'onThisPage')) + '</h4>' + page.toc.map(([id, label]) => '<a href="#' + id + '">' + escapeHtml(label) + '</a>').join('') + '</div>');
  }
  for (const block of page.aside) parts.push(block);
  return '<aside>' + parts.join('\n') + '</aside>';
}

function figure(art, caption) {
  return '<figure><img src="' + art + '" alt=""><figcaption>' + escapeHtml(caption) + '</figcaption></figure>';
}

function faqBlock(items, site, lang) {
  return '<h2>' + escapeHtml(t(site, lang, 'qa')) + '</h2><div class="faq">' + items.map(([question, answer]) =>
    '<details><summary>' + escapeHtml(question) + '</summary><p>' + answer + '</p></details>').join('') + '</div>';
}

function statsBlock(items) {
  return '<div class="stats">' + items.map(([value, label]) =>
    '<div class="stat"><b>' + escapeHtml(value) + '</b><span>' + escapeHtml(label) + '</span></div>').join('') + '</div>';
}

function newsletterBlock(site, lang) {
  return '<div class="newsletter"><h3>' + escapeHtml(site.newsletterTitle ? t(site, lang, site.newsletterTitle) : t(site, lang, 'subscribe')) + '</h3>' +
    '<p style="color:var(--muted);margin:0">' + escapeHtml(t(site, lang, 'subscribeNote')) + '</p>' +
    '<form onsubmit="return false"><input type="email" placeholder="' + escapeHtml(t(site, lang, 'emailPlaceholder')) + '" aria-label="Email"><button class="btn" type="submit">' + escapeHtml(t(site, lang, 'subscribe')) + '</button></form></div>';
}

function artFor(site, dir, page, name, kind) {
  if (!page.art || page.art.name !== name) return null;
  return writeArt(dir, site.theme, name, kind || page.art.kind || 'thumb', site.sub + '-' + name, site.sub);
}

function renderPage(site, page, dir, lang, maps) {
  const enPath = page.path;
  const idPath = maps[enPath];
  const currentPath = lang === 'id' ? idPath : enPath;
  const canonical = 'https://' + site.domain + currentPath;
  const locale = lang === 'id' ? 'id' : 'en';
  const title = lang === 'id' && page.titleId ? page.titleId : (typeof page.title === 'object' ? page.title[lang] || page.title.en : page.title);
  const summary = lang === 'id' && page.summaryId ? page.summaryId : (typeof page.summary === 'object' ? page.summary[lang] || page.summary.en : page.summary);
  const bodySource = lang === 'id' && page.bodyId ? page.bodyId : (typeof page.body === 'object' ? page.body[lang] || page.body.en : page.body);
  const translationMissing = lang === 'id' && !page.bodyId && typeof page.body !== 'object';
  const alternates = [
    '<link rel="alternate" hreflang="en" href="https://' + site.domain + enPath + '">',
    '<link rel="alternate" hreflang="id" href="https://' + site.domain + idPath + '">'
  ].join('\n');
  const script = site.script ? '<script src="' + site.script + '" defer></script>' : '';
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': page.kind === 'article' ? 'NewsArticle' : page.kind === 'product' ? 'Product' : 'WebPage',
    name: title,
    description: summary,
    url: canonical,
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', name: site.name, url: 'https://' + site.domain }
  });
  const pageNav = maps.__navFor ? maps.__navFor(page, lang) : site.nav;
  const pageLike = Object.assign({}, page, { __nav: pageNav });
  let main = '<div class="article-body">' + tokenize(bodySource, site, lang) + '</div>';
  if (page.kind === 'article' || page.kind === 'product') {
    main += '<div class="share"><span>' + escapeHtml(t(site, lang, 'share')) + '</span>' +
      '<a href="mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(canonical) + '">' + escapeHtml(t(site, lang, 'emailShare')) + '</a>' +
      '<button type="button" data-copy="' + escapeHtml(canonical) + '">' + escapeHtml(t(site, lang, 'copyLink')) + '</button></div>';
  }
  if (page.art && dir) {
    const art = artFor(site, dir, page, page.art.name, page.art.kind);
    if (art) main = figure(art, page.art.caption || title) + main;
  }
  if (page.faq) main += faqBlock(page.faq, site, lang);
  if (page.stats) main = statsBlock(page.stats) + main;
  if (page.newsletter) main += newsletterBlock(site, lang);
  const notice = translationMissing ? '<div class="notice">' + escapeHtml(t(site, lang, 'translationMissing')) + '</div>' : '';
  return [
    '<!doctype html><html lang="' + locale + '" data-mode="' + (site.mode || 'light') + '"><head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + escapeHtml(title) + '</title>',
    '<meta name="description" content="' + escapeHtml(summary) + '">',
    '<link rel="canonical" href="' + canonical + '">',
    '<link rel="ai-feed" href="/.well-known/ai.json">',
    '<meta name="robots" content="index,follow,max-image-preview:large">',
    '<meta property="og:type" content="' + (page.kind === 'article' ? 'article' : 'website') + '">',
    '<meta property="og:url" content="' + canonical + '">',
    '<meta property="og:site_name" content="' + escapeHtml(site.name) + '">',
    '<meta property="og:title" content="' + escapeHtml(title) + '">',
    '<meta property="og:description" content="' + escapeHtml(summary) + '">',
    '<meta property="og:image" content="https://aifeed.md/og-image.png">',
    '<meta property="og:locale" content="' + (lang === 'id' ? 'id_ID' : 'en_US') + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">',
    '<meta name="twitter:description" content="' + escapeHtml(summary) + '">',
    '<meta name="twitter:image" content="https://aifeed.md/og-image.png">',
    '<meta name="theme-color" content="' + site.theme.accent + '">',
    fontLinks(site),
    fontLinks(site),
    '<script type="application/ld+json">' + structuredData + '</script>',
    alternates,
    '<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">',
    '<style>:root{' + (site.mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS) + '--accent:' + site.theme.accent + ';--accent2:' + site.theme.accent2 + ';--font:' + (site.fonts || "'Inter',-apple-system,'Segoe UI',Roboto,sans-serif") + ';--head:' + (site.headFonts || "'Montserrat','Inter',-apple-system,sans-serif") + ';--radius:12px}' + CSS + CSS_V2 + '</style>',
    script,
    '</head><body>',
    skipLink(site, lang),
    header(site, pageLike, lang, maps),
    '<main id="main"><div class="wrap">',
    breadcrumbs(site, page, lang, maps),
    '<div class="layout' + (page.aside ? ' with-aside' : '') + '">',
    '<div>' + notice + main + '</div>',
    renderAside(page, site, lang, maps),
    '</div></div></main>',
    footer(site, lang, maps),
    '<script>(function(){var p=document.createElement("div");p.className="progress";document.body.appendChild(p);var t=document.createElement("button");t.className="totop";t.type="button";t.setAttribute("aria-label","Back to top");t.textContent="\\u2191";document.body.appendChild(t);function onScroll(){var h=document.documentElement;var max=h.scrollHeight-h.clientHeight;p.style.width=(max>0?(h.scrollTop/max)*100:0)+"%";if(h.scrollTop>600){t.classList.add("show");}else{t.classList.remove("show");}}window.addEventListener("scroll",onScroll,{passive:true});onScroll();t.addEventListener("click",function(){window.scrollTo({top:0,behavior:"smooth"});});document.querySelectorAll("pre").forEach(function(pre){var b=document.createElement("button");b.className="copy";b.type="button";b.textContent="Copy";b.addEventListener("click",function(){navigator.clipboard.writeText(pre.innerText.replace(/^Copy\\n?/,"")).then(function(){b.textContent="Copied";setTimeout(function(){b.textContent="Copy";},1500);});});pre.appendChild(b);});document.querySelectorAll("[data-copy]").forEach(function(btn){btn.addEventListener("click",function(){var v=btn.getAttribute("data-copy")||"";navigator.clipboard.writeText(v).then(function(){var o=btn.textContent;btn.textContent="Copied";setTimeout(function(){btn.textContent=o;},1500);});});});})();</script>',
    '</body></html>',
    ''
  ].join('\n');
}

function logoSvg(site) {
  const initial = site.name.trim().charAt(0).toUpperCase();
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="' + escapeHtml(site.name) + '">' +
    '<rect width="64" height="64" rx="14" fill="' + site.theme.accent + '"/>' +
    '<text x="32" y="43" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="30" font-weight="700" fill="#fff">' + initial + '</text></svg>\n';
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function revocationsFor(domain, statusOverride) {
  const status = statusOverride || (domain === 'revoked.aifeed.md' ? 'suspended' : 'active');
  const base = {
    version: '0.1',
    domain,
    status,
    reason: status === 'suspended' ? 'abuse_investigation' : 'no_open_issues',
    reason_detail: status === 'suspended' ? 'Demo: multi-signature suspension after an abuse report.' : 'Demo registry entry; nothing to see here.',
    effective_at: '2026-09-01T00:00:00Z',
    expires_at: '2027-09-01T00:00:00Z',
    revoked_by: 'aifeed-demo-governance',
    appeal_url: 'https://aifeed.md/penjelasan.html#revocation',
    keys: keys.governance.map((item) => ({ fingerprint: item.fingerprint }))
  };
  const signatures = [];
  for (const item of keys.governance) {
    const signature = cryptoLib.signRevocation(nodeCrypto.createPrivateKey(item.privatePem), base);
    signatures.push({
      algorithm: 'ed25519',
      key_id: item.keyId,
      canonicalization: 'jcs-rfc8785',
      signature: cryptoLib.encodeSignature(signature)
    });
  }
  return { ...base, signatures };
}

function searchDefinition() {
  return {
    path: '/search/',
    kind: 'page',
    title: { en: 'Search', id: 'Pencarian' },
    summary: { en: 'Search every page of this site.', id: 'Cari semua halaman situs ini.' },
    crumbs: ['Search'],
    crumbsId: ['Pencarian'],
    body: [
      '<h1>{{searchTitle}}</h1>',
      '<p class="lede">{{searchHint}}</p>',
      '<div class="filters"><input id="q" type="search" placeholder="{{searchHint}}" aria-label="Search" style="flex:1 1 280px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text)"><span id="count" class="meta" data-many="{{resultsSuffix}}"></span></div>',
      '<div id="results" class="grid" data-empty="{{noResults}}"></div>',
      '<script>(function(){var box=document.getElementById("q"),res=document.getElementById("results"),count=document.getElementById("count"),data=[];var params=new URLSearchParams(location.search);if(params.get("q"))box.value=params.get("q");function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");}function render(){var q=box.value.trim().toLowerCase();var hits=data.filter(function(e){return !q||(e.t+" "+e.s).toLowerCase().indexOf(q)>-1;});count.textContent=hits.length+" "+count.getAttribute("data-many");res.innerHTML=hits.slice(0,30).map(function(e){return \'<a class="card" href="\'+e.u+\'"><div class="body"><h3>\'+esc(e.t)+\'</h3><p>\'+esc(e.s)+\'</p></div></a>\';}).join("")||"<p class=\"meta\">"+res.getAttribute("data-empty")+"</p>";}box.addEventListener("input",render);fetch("/search.json").then(function(r){return r.json();}).then(function(j){data=j;render();}).catch(function(){res.innerHTML="<p class=\"meta\">"+res.getAttribute("data-empty")+"</p>";});render();})();</' + 'script>'
    ].join('\n')
  };
}

function buildSearchIndex(site, pages, maps) {
  const entries = [];
  for (const page of pages) {
    for (const lang of ['en', 'id']) {
      const title = lang === 'id' && page.titleId ? page.titleId : (typeof page.title === 'object' ? page.title[lang] || page.title.en : page.title);
      const summary = lang === 'id' && page.summaryId ? page.summaryId : (typeof page.summary === 'object' ? page.summary[lang] || page.summary.en : page.summary);
      entries.push({ t: title, s: summary, u: (lang === 'id' ? maps[page.path] : page.path), lang });
    }
  }
  return entries;
}

function generateSite(site, outRoot) {
  const dir = path.join(outRoot, site.sub);
  fs.rmSync(dir, { recursive: true, force: true });
  const allPages = site.pages.concat([searchDefinition()]);
  const siteWithSearch = Object.assign({}, site, { pages: allPages });
  const maps = pagePathMaps(siteWithSearch);
  const languages = ['en', 'id'];
  for (const lang of languages) {
    for (const page of allPages) {
      const currentPath = lang === 'id' ? maps[page.path] : page.path;
      const localMaps = Object.assign({}, maps, { __current: page.path, __currentId: maps[page.path] });
      const file = lang === 'id'
        ? path.join(dir, currentPath.replace(/^\//, ''), 'index.html')
        : (page.path === '/' ? path.join(dir, 'index.html') : path.join(dir, page.path.replace(/^\//, ''), 'index.html'));
      writeFile(file, renderPage(site, page, dir, lang, localMaps));
    }
  }
  writeFile(path.join(dir, 'assets', 'logo.svg'), logoSvg(site));
  writeArt(dir, site.theme, 'hero', 'hero', site.sub + '-hero', site.sub);
  for (const page of site.pages) {
    if (page.art && page.art.name !== 'hero') writeArt(dir, site.theme, page.art.name, page.art.kind || 'thumb', site.sub + '-' + page.art.name, site.sub);
  }
  for (const extra of site.extraArt || []) {
    writeArt(dir, site.theme, extra.name, extra.kind || 'thumb', site.sub + '-' + extra.name, site.sub);
  }
  if (site.sub === 'revoked') {
    writeFile(path.join(dir, 'revocation', 'active.json'), JSON.stringify(revocationsFor(site.domain, 'active'), null, 2) + '\n');
    writeFile(path.join(dir, 'revocation', 'suspended.json'), JSON.stringify(revocationsFor(site.domain, 'suspended'), null, 2) + '\n');
  }
  writeFile(path.join(dir, '404.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>404</title><style>body{font:16px/1.6 system-ui;background:#12100f;color:#f8f8f7;display:grid;place-items:center;height:100vh;margin:0}a{color:#f55036}</style></head><body><div><h1>404</h1><p>Nothing lives at this path on ' + escapeHtml(site.domain) + '.</p><p><a href="/">' + escapeHtml(t(site, 'en', 'backHome')) + '</a> · <a href="/id/">Bahasa Indonesia</a></p></div></body></html>');
  writeFile(path.join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\n# AIFeed: https://' + site.domain + '/.well-known/ai.json\nSitemap: https://' + site.domain + '/sitemap.xml\n');
  const urls = [];
  for (const page of allPages) {
    urls.push('<url><loc>https://' + site.domain + page.path + '</loc></url>');
    urls.push('<url><loc>https://' + site.domain + maps[page.path] + '</loc></url>');
  }
  writeFile(path.join(dir, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n');
  writeFile(path.join(dir, 'search.json'), JSON.stringify(buildSearchIndex(site, allPages, maps), null, 1) + '\n');
  if (site.extraFiles) {
    for (const [relative, content] of Object.entries(site.extraFiles)) {
      if (content === null) continue;
      writeFile(path.join(dir, relative), content);
    }
  }
  if (site.sub === 'verify') {
    const verifier = path.join(ROOT, 'demos', 'verifier', 'verifier.js');
    if (fs.existsSync(verifier)) fs.copyFileSync(verifier, path.join(dir, 'verifier.js'));
  }
  const keyFile = path.join(os.tmpdir(), 'aifeed-demo-' + site.sub + '.pem');
  fs.writeFileSync(keyFile, keys.origins[site.domain].privatePem, 'utf8');
  try {
    buildSite({
      dir,
      domain: site.domain,
      baseUrl: 'https://' + site.domain,
      name: site.name,
      locale: site.locale || 'en',
      contact: 'mailto:demo@' + site.domain,
      keyPath: keyFile,
      keyId: keys.origins[site.domain].keyId,
      profile: 'both',
      llms: true,
      inject: true,
      type: site.type,
      permissions: site.permissions
    });
  } finally {
    fs.rmSync(keyFile, { force: true });
  }
  const registryFile = path.join(ROOT, 'site', 'revoke', 'v1', site.domain + '.json');
  writeFile(registryFile, JSON.stringify(revocationsFor(site.domain), null, 2) + '\n');
  return dir;
}

module.exports = { main: null, generateSite, revocationsFor, pagePathMaps };

// --- generation driver -------------------------------------------------------

function generateApex(siteRoot) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-apex-'));
  const sources = ['index.html', 'process.html', 'enforcement-report.html', 'penjelasan.html', 'studio.html', 'updates.html'];
  for (const name of sources) {
    const source = path.join(siteRoot, name);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(staging, name));
  }
  const keyFile = path.join(os.tmpdir(), 'aifeed-demo-apex.pem');
  fs.writeFileSync(keyFile, keys.origins['aifeed.md'].privatePem, 'utf8');
  try {
    buildSite({
      dir: staging,
      domain: 'aifeed.md',
      baseUrl: 'https://aifeed.md',
      name: 'AIFeed',
      locale: 'en',
      contact: 'mailto:contact@aifeed.md',
      keyPath: keyFile,
      keyId: keys.origins['aifeed.md'].keyId,
      profile: 'both',
      llms: true,
      inject: false,
      type: 'docs'
    });
  } finally {
    fs.rmSync(keyFile, { force: true });
  }
  const isGenerated = (name) => name === 'llms.txt' || /\.(aifeed|mako)\.md(\.sig)?$/.test(name) || name === '.well-known';
  for (const name of fs.readdirSync(staging)) {
    if (!isGenerated(name)) continue;
    const source = path.join(staging, name);
    const target = path.join(siteRoot, name);
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(source, target, { recursive: true });
  }
  fs.rmSync(staging, { recursive: true, force: true });
  const registryFile = path.join(siteRoot, 'revoke', 'v1', 'aifeed.md.json');
  writeFile(registryFile, JSON.stringify(revocationsFor('aifeed.md'), null, 2) + '\n');
  writeApexSeo(siteRoot);
}

function writeApexSeo(siteRoot) {
  const today = new Date().toISOString().slice(0, 10);
  const apexPages = ['/', '/process.html', '/enforcement-report.html', '/penjelasan.html', '/studio.html', '/updates.html', '/feed.xml', '/aifeed-preprint.pdf'];
  const urls = [];
  for (const pagePath of apexPages) urls.push({ loc: 'https://aifeed.md' + pagePath, priority: pagePath === '/' ? '1.0' : '0.8' });
  for (const site of siteDefinitions) {
    const maps = pagePathMaps(site);
    for (const page of site.pages) {
      urls.push({ loc: 'https://' + site.domain + page.path, priority: page.path === '/' ? '0.9' : '0.6' });
      urls.push({ loc: 'https://' + site.domain + maps[page.path], priority: '0.6' });
    }
  }
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((entry) => [
      '  <url>',
      '    <loc>' + entry.loc.replace(/&/g, '&amp;') + '</loc>',
      '    <lastmod>' + today + '</lastmod>',
      '    <changefreq>weekly</changefreq>',
      '    <priority>' + entry.priority + '</priority>',
      '  </url>'
    ].join('\n')),
    '</urlset>',
    ''
  ].join('\n');
  writeFile(path.join(siteRoot, 'sitemap.xml'), sitemap);
  writeFile(
    path.join(siteRoot, 'robots.txt'),
    'User-agent: *\nAllow: /\n\n# Sitemap\nSitemap: https://aifeed.md/sitemap.xml\n\n# AIFeed declaration\n# AIFeed: https://aifeed.md/.well-known/ai.json\n'
  );
  require('./gen-og-image').main();
}

function checkAll(outRoot, targets) {
  const sdk = require('../packages/aifeed-verify');
  const failures = [];
  let verified = 0;
  const origins = (targets || siteDefinitions).map((site) => ({ domain: site.domain, dir: path.join(outRoot, site.sub) }));
  if (!targets) origins.push({ domain: 'aifeed.md', dir: path.join(ROOT, 'site') });
  for (const origin of origins) {
    try {
      const manifest = fs.readFileSync(path.join(origin.dir, '.well-known', 'ai.json'));
      const signature = fs.readFileSync(path.join(origin.dir, '.well-known', 'ai-signature.json'), 'utf8');
      const result = sdk.verifyAll({
        manifestText: manifest.toString('utf8'),
        manifestBytes: manifest,
        signatureText: signature,
        domain: origin.domain
      });
      if (result.result !== 'VERIFIED') {
        failures.push(origin.domain + ': ' + result.result + ' ' + JSON.stringify(result.errors.slice(0, 2)));
        continue;
      }
      const index = path.join(origin.dir, '.well-known', 'aifeed-index.json');
      if (!fs.existsSync(index)) failures.push(origin.domain + ': delta index missing');
      const registry = path.join(ROOT, 'site', 'revoke', 'v1', origin.domain + '.json');
      if (fs.existsSync(registry)) {
        const revocation = verifyRevocationDocument(fs.readFileSync(registry, 'utf8'), {
          domain: origin.domain,
          governanceKeys: keys.governance.map((item) => item.publicKey)
        });
        if (revocation.result !== 'valid') failures.push(origin.domain + ': revocation ' + revocation.result);
      }
      verified++;
    } catch (error) {
      failures.push(origin.domain + ': ' + error.message);
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write('FAIL ' + failure + '\n');
    process.exitCode = 1;
  }
  return verified;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const siteRoot = path.join(ROOT, 'site');
  fs.mkdirSync(args.out, { recursive: true });
  const targets = siteDefinitions.filter((site) => !args.only || site.sub === args.only);
  for (const site of targets) {
    generateSite(site, args.out);
    process.stdout.write('demo: ' + site.domain + ' (' + site.pages.length + ' pages × 2 languages) -> ' + path.relative(ROOT, path.join(args.out, site.sub)).split(path.sep).join('/') + '\n');
  }
  if (!args.only) {
    generateApex(siteRoot);
    process.stdout.write('demo: apex aifeed.md artifacts -> site/\n');
  }
  if (args.check) {
    const verified = checkAll(args.out, args.only ? siteDefinitions.filter((site) => site.sub === args.only) : null);
    process.stdout.write('demos checked: ' + verified + ' origin(s) verified\n');
  }
}

module.exports = { main, generateSite, revocationsFor, pagePathMaps };

if (require.main === module) main();
