#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'dist', 'coverage']);
const SKIP_FILES = new Set([
  'tools/replace-domain.js',
  'docs/namespace-setup.md'
]);
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.php', '.py', '.go', '.tex', '.bib', '.yml', '.yaml', '.html', '.css', '.pot', '.conf', '.htaccess', '.gitignore', '.template']);
const OLD_DOMAIN = 'aifeed.org';
const ESCAPED_OLD_DOMAIN = 'aifeed\\.org';
const DOMAIN_PATTERN = /aifeed(\\*)\.org/g;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const equals = item.indexOf('=');
    if (equals !== -1) {
      args[item.slice(2, equals)] = item.slice(equals + 1);
    } else {
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[item.slice(2)] = next;
        index++;
      } else {
        args[item.slice(2)] = true;
      }
    }
  }
  return args;
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), files);
    } else {
      files.push(path.join(dir, entry.name));
    }
  }
}

function containsDomain(buffer) {
  return /aifeed(\\*)\.org/.test(buffer.toString('utf8'));
}

function replaceInText(text, domain) {
  const suffix = domain.slice('aifeed.'.length);
  return text.replace(/aifeed(\\*)\.org/g, (match, slashes) => 'aifeed' + slashes + '.' + suffix);
}

function countOccurrences(text) {
  return (text.match(/aifeed(\\*)\.org/g) || []).length;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const domain = String(args.domain || '').trim().toLowerCase();
  const apply = args.apply === true;

  if (!/^aifeed\.[a-z]{2,}$/.test(domain)) {
    process.stderr.write('usage: node tools/replace-domain.js --domain <aifeed.tld> [--apply]\n');
    process.exitCode = 2;
    return;
  }
  if (domain === OLD_DOMAIN) {
    process.stderr.write('new domain must differ from ' + OLD_DOMAIN + '\n');
    process.exitCode = 2;
    return;
  }

  const files = [];
  walk(ROOT, files);

  let totalFiles = 0;
  let totalHits = 0;
  for (const file of files) {
    const extension = path.extname(file) || path.basename(file);
    if (!TEXT_EXTENSIONS.has(extension)) continue;
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    if (SKIP_FILES.has(relative)) continue;
    let buffer;
    try {
      buffer = fs.readFileSync(file);
    } catch (error) {
      continue;
    }
    if (!containsDomain(buffer)) continue;
    const text = buffer.toString('utf8');
    const hits = countOccurrences(text);
    totalFiles++;
    totalHits += hits;
    if (apply) {
      fs.writeFileSync(file, replaceInText(text, domain), 'utf8');
      process.stdout.write('updated ' + relative + ' (' + hits + ')\n');
    } else {
      process.stdout.write(relative + ' (' + hits + ')\n');
    }
  }

  process.stdout.write((apply ? 'applied' : 'dry-run') + ': ' + totalHits + ' occurrences of ' +
    OLD_DOMAIN + ' in ' + totalFiles + ' files -> ' + domain + '\n');
  if (!apply && totalFiles > 0) {
    process.stdout.write('re-run with --apply to write the changes\n');
  }
  if (apply && totalHits > 0) {
    process.stdout.write('next: npm test && npm run test:py && npm run paper:check\n');
  }
}

main();
