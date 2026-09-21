#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');

const COPIES = [
  ['aifeed-logo.svg', 'logo.svg'],
  ['docs/process.html', 'process.html'],
  ['benchmarks/enforcement-report.html', 'enforcement-report.html'],
  ['penjelasan-aifeed.html', 'penjelasan.html'],
  ['docs/studio.html', 'studio.html'],
  ['docs/updates.html', 'updates.html'],
  ['docs/feed.xml', 'feed.xml'],
  ['badge-aifeed.svg', 'badge.svg'],
  ['paper/aifeed-preprint.pdf', 'aifeed-preprint.pdf']
];

fs.mkdirSync(SITE, { recursive: true });

let copied = 0;
const missing = [];
for (const [from, to] of COPIES) {
  const src = path.join(ROOT, from);
  if (!fs.existsSync(src)) {
    missing.push(from);
    continue;
  }
  fs.copyFileSync(src, path.join(SITE, to));
  copied++;
  process.stdout.write('site: ' + to + '\n');
}

if (missing.length > 0) {
  process.stderr.write('site: missing sources (run "npm run render:html" first): ' + missing.join(', ') + '\n');
  process.exitCode = 1;
}

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  process.stderr.write('site: index.html is missing\n');
  process.exitCode = 1;
}
process.stdout.write('site built: ' + copied + ' artifact(s) -> site/\n');
