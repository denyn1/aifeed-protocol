#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const failures = [];
const notes = [];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function match(text, regex, label, expected, file) {
  const found = regex.exec(text);
  if (!found) {
    failures.push(file + ': could not find ' + label);
    return null;
  }
  if (expected !== null && found[1] !== expected) {
    failures.push(file + ': ' + label + ' is "' + found[1] + '", expected "' + expected + '"');
  }
  return found[1];
}

const rootPkg = JSON.parse(read('package.json'));
const sdkPkg = JSON.parse(read('packages/aifeed-verify/package.json'));
const releaseVersion = rootPkg.version;

match(read('wp-plugin/aifeed.php'), /^[\s*]*Version:\s*(\S+)/m, 'plugin header Version', releaseVersion, 'wp-plugin/aifeed.php');
match(read('wp-plugin/aifeed.php'), /define\('AIFEED_VERSION',\s*'([^']+)'\)/, 'AIFEED_VERSION', releaseVersion, 'wp-plugin/aifeed.php');
match(read('wp-plugin/readme.txt'), /Stable tag:\s*(\S+)/, 'readme.txt Stable tag', releaseVersion, 'wp-plugin/readme.txt');
match(read('site/index.html'), /class="chip">v([^<]+)</, 'site version chip', releaseVersion, 'site/index.html');
match(read('CHANGELOG.md'), /^##\s*\[([^\]]+)\]/m, 'CHANGELOG top section', releaseVersion, 'CHANGELOG.md');

const sdkVersion = sdkPkg.version;
if (sdkVersion.split('-')[0] !== releaseVersion.split('-')[0]) {
  failures.push('packages/aifeed-verify/package.json: version core "' + sdkVersion.split('-')[0] + '" differs from release core "' + releaseVersion.split('-')[0] + '"');
} else if (sdkVersion !== releaseVersion) {
  notes.push('SDK version ' + sdkVersion + ' differs from release ' + releaseVersion + ' (allowed: prerelease suffix)');
}

for (const [file, pkg] of [['package.json', rootPkg], ['packages/aifeed-verify/package.json', sdkPkg]]) {
  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  if (deps.length > 0 || devDeps.length > 0) {
    failures.push(file + ': zero-dependency rule violated (deps=' + deps.length + ', devDeps=' + devDeps.length + ')');
  }
}

const sdkEntry = path.join(ROOT, 'packages/aifeed-verify/index.js');
if (!fs.existsSync(sdkEntry)) failures.push('packages/aifeed-verify/index.js is missing');

const specPairs = [['spec/en', 'spec/id']];
for (const [enDir, idDir] of specPairs) {
  const en = fs.readdirSync(path.join(ROOT, enDir)).filter((name) => name.endsWith('.md')).sort();
  const id = fs.readdirSync(path.join(ROOT, idDir)).filter((name) => name.endsWith('.md')).sort();
  for (const name of en) {
    if (!id.includes(name)) failures.push(idDir + ': missing mirror of ' + enDir + '/' + name);
  }
  for (const name of id) {
    if (!en.includes(name)) failures.push(enDir + ': missing mirror of ' + idDir + '/' + name);
  }
}

for (const [file, pkg] of [['package.json', rootPkg], ['packages/aifeed-verify/package.json', sdkPkg]]) {
  for (const [name, command] of Object.entries(pkg.scripts || {})) {
    for (const token of String(command).split(/\s+/)) {
      if (/^(tools|bin)\//.test(token) && !fs.existsSync(path.join(ROOT, token))) {
        failures.push(file + ': script "' + name + '" points at missing file ' + token);
      }
    }
  }
}

const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
if (tracked.status === 0) {
  const secretPattern = /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/;
  const allowedSecretFiles = new Set(['tests/fixtures/tls/cert.pem', 'tests/fixtures/tls/key.pem', 'demos/keys.js']);
  for (const relative of tracked.stdout.split('\0').filter(Boolean)) {
    if (allowedSecretFiles.has(relative)) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    } catch (error) {
      continue;
    }
    if (secretPattern.test(text)) failures.push('possible secret in tracked file: ' + relative);
  }
} else {
  notes.push('git not available; skipped the secret scan');
}

for (const note of notes) process.stdout.write('note: ' + note + '\n');
if (failures.length > 0) {
  for (const failure of failures) process.stderr.write('FAIL ' + failure + '\n');
  process.stdout.write('consistency checked: ' + failures.length + ' failure(s)\n');
  process.exitCode = 1;
} else {
  process.stdout.write('consistency checked: OK (release ' + releaseVersion + ')\n');
}
