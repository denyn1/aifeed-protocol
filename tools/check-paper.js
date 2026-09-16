#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PAPER_DIR = path.join(__dirname, '..', 'paper');
const TEX = path.join(PAPER_DIR, 'main.tex');
const BIB = path.join(PAPER_DIR, 'refs.bib');

function fail(message) {
  process.stderr.write('FAIL ' + message + '\n');
  process.exitCode = 1;
}

function main() {
  const tex = fs.readFileSync(TEX, 'utf8');
  const bib = fs.readFileSync(BIB, 'utf8');

  const bibKeys = new Set();
  for (const match of bib.matchAll(/@\w+\s*\{\s*([^,\s]+)\s*,/g)) {
    bibKeys.add(match[1]);
  }

  const cited = new Set();
  for (const match of tex.matchAll(/\\cite[a-z]*\{([^}]+)\}/g)) {
    for (const key of match[1].split(',')) {
      const trimmed = key.trim();
      if (trimmed) cited.add(trimmed);
    }
  }

  for (const key of cited) {
    if (!bibKeys.has(key)) fail('cite key missing from refs.bib: ' + key);
  }

  const begin = {};
  const end = {};
  for (const match of tex.matchAll(/\\begin\{([^}]+)\}/g)) {
    begin[match[1]] = (begin[match[1]] || 0) + 1;
  }
  for (const match of tex.matchAll(/\\end\{([^}]+)\}/g)) {
    end[match[1]] = (end[match[1]] || 0) + 1;
  }
  for (const env of new Set([...Object.keys(begin), ...Object.keys(end)])) {
    if ((begin[env] || 0) !== (end[env] || 0)) {
      fail('unbalanced environment ' + env + ': begin=' + (begin[env] || 0) + ' end=' + (end[env] || 0));
    }
  }

  const unused = [...bibKeys].filter((key) => !cited.has(key));
  process.stdout.write('paper check: cites=' + cited.size + ', bib entries=' + bibKeys.size +
    ', unused bib entries=' + unused.length + '\n');
  if (unused.length > 0) {
    process.stdout.write('  unused: ' + unused.join(', ') + '\n');
  }
  if (process.exitCode !== 1) {
    process.stdout.write('paper check: OK\n');
  }
}

main();
