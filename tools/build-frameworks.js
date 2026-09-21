#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const FW_DIR = path.join(ROOT, 'packages', 'aifeed-frameworks');
const ENTRIES = [
  ['lib', 'lib'],
  ['schema', 'schema'],
  ['LICENSE', 'LICENSE']
];

function copyRecursive(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = target + '.tmp-' + process.pid;
  fs.copyFileSync(source, temp);
  fs.renameSync(temp, target);
}

function pruneMissing(source, target) {
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (!fs.existsSync(sourcePath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) pruneMissing(sourcePath, targetPath);
  }
}

function listFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      for (const nested of listFiles(full)) {
        files.push(path.join(entry.name, nested));
      }
    } else {
      files.push(entry.name);
    }
  }
  return files;
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function buildFrameworks() {
  for (const [source, target] of ENTRIES) {
    const sourcePath = path.join(ROOT, source);
    const targetPath = path.join(FW_DIR, target);
    copyRecursive(sourcePath, targetPath);
    if (fs.statSync(sourcePath).isDirectory()) pruneMissing(sourcePath, targetPath);
  }
  return FW_DIR;
}

function checkFrameworks() {
  for (const [source, target] of ENTRIES) {
    const sourcePath = path.join(ROOT, source);
    const targetPath = path.join(FW_DIR, target);
    if (fs.statSync(sourcePath).isDirectory()) {
      for (const relative of listFiles(sourcePath)) {
        const from = path.join(sourcePath, relative);
        const to = path.join(targetPath, relative);
        if (!fs.existsSync(to) || hashFile(from) !== hashFile(to)) return false;
      }
    } else if (!fs.existsSync(targetPath) || hashFile(sourcePath) !== hashFile(targetPath)) {
      return false;
    }
  }
  return true;
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const ok = checkFrameworks();
    process.stdout.write('frameworks check: ' + (ok ? 'in sync' : 'OUT OF SYNC') + '\n');
    process.exitCode = ok ? 0 : 1;
  } else {
    const dir = buildFrameworks();
    process.stdout.write('frameworks built: ' + path.relative(ROOT, dir) + '\n');
  }
}

module.exports = { buildFrameworks, checkFrameworks, FW_DIR };
