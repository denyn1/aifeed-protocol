#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'site', 'coverage', '.venv']);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.js')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const files = walk(ROOT, []);
let failed = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const isEsm = /^\s*(import|export)\s/m.test(text);
  const result = isEsm
    ? spawnSync(process.execPath, ['--input-type=module', '--check'], { input: text, encoding: 'utf8' })
    : spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed++;
    process.stderr.write('syntax error: ' + path.relative(ROOT, file).split(path.sep).join('/') + '\n' + (result.stderr || ''));
  }
}

process.stdout.write('syntax checked: ' + files.length + ' file(s), failures: ' + failed + '\n');
process.exitCode = failed > 0 ? 1 : 0;
