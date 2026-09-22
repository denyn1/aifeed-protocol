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
const mcpPkg = JSON.parse(read('packages/aifeed-mcp-server/package.json'));
const fwPkg = JSON.parse(read('packages/aifeed-frameworks/package.json'));
const cliPkg = JSON.parse(read('packages/aifeed-cli/package.json'));
const harnessPkg = JSON.parse(read('integrations/deepseek-harness/package.json'));
const releaseVersion = rootPkg.version;

match(read('wp-plugin/aifeed.php'), /^[\s*]*Version:\s*(\S+)/m, 'plugin header Version', releaseVersion, 'wp-plugin/aifeed.php');
match(read('wp-plugin/aifeed.php'), /define\('AIFEED_VERSION',\s*'([^']+)'\)/, 'AIFEED_VERSION', releaseVersion, 'wp-plugin/aifeed.php');
match(read('wp-plugin/readme.txt'), /Stable tag:\s*(\S+)/, 'readme.txt Stable tag', releaseVersion, 'wp-plugin/readme.txt');
match(read('site/index.html'), /class="chip">v([^<]+)</, 'site version chip', releaseVersion, 'site/index.html');
const changelogHeadings = [...read('CHANGELOG.md').matchAll(/^##\s*\[([^\]]+)\]/gm)].map((found) => found[1]);
const changelogTop = changelogHeadings.find((heading) => heading !== 'Unreleased') || null;
if (changelogTop === null) {
  failures.push('CHANGELOG.md: could not find top version section');
} else if (changelogTop !== releaseVersion) {
  failures.push('CHANGELOG.md: CHANGELOG top section is "' + changelogTop + '", expected "' + releaseVersion + '"');
}

const sdkVersion = sdkPkg.version;
if (sdkVersion.split('-')[0] !== releaseVersion.split('-')[0]) {
  failures.push('packages/aifeed-verify/package.json: version core "' + sdkVersion.split('-')[0] + '" differs from release core "' + releaseVersion.split('-')[0] + '"');
} else if (sdkVersion !== releaseVersion) {
  notes.push('SDK version ' + sdkVersion + ' differs from release ' + releaseVersion + ' (allowed: prerelease suffix)');
}

const coreVersion = releaseVersion.split('-')[0];
const pyprojectVersion = /^version\s*=\s*"([^"]+)"/m.exec(read('clients/python/pyproject.toml'));
const pyInitVersion = /^__version__\s*=\s*'([^']+)'/m.exec(read('clients/python/aifeed/__init__.py'));
if (!pyprojectVersion) {
  failures.push('clients/python/pyproject.toml: could not find project version');
} else if (pyprojectVersion[1].replace(/(a|b|rc|\.dev)\d+$/, '') !== coreVersion) {
  failures.push('clients/python/pyproject.toml: version "' + pyprojectVersion[1] + '" does not mirror core "' + coreVersion + '"');
}
if (!pyInitVersion) {
  failures.push('clients/python/aifeed/__init__.py: could not find __version__');
} else if (pyprojectVersion && pyInitVersion[1] !== pyprojectVersion[1]) {
  failures.push('clients/python/aifeed/__init__.py: __version__ "' + pyInitVersion[1] + '" differs from pyproject "' + pyprojectVersion[1] + '"');
}

for (const [file, pkg] of [
  ['package.json', rootPkg],
  ['packages/aifeed-verify/package.json', sdkPkg],
  ['packages/aifeed-mcp-server/package.json', mcpPkg],
  ['packages/aifeed-frameworks/package.json', fwPkg],
  ['packages/aifeed-cli/package.json', cliPkg],
  ['integrations/deepseek-harness/package.json', harnessPkg]
]) {
  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  if (deps.length > 0 || devDeps.length > 0) {
    failures.push(file + ': zero-dependency rule violated (deps=' + deps.length + ', devDeps=' + devDeps.length + ')');
  }
}

for (const [file, pkg] of [
  ['packages/aifeed-mcp-server/package.json', mcpPkg],
  ['packages/aifeed-frameworks/package.json', fwPkg],
  ['packages/aifeed-cli/package.json', cliPkg],
  ['integrations/deepseek-harness/package.json', harnessPkg]
]) {
  if (pkg.version.split('-')[0] !== releaseVersion.split('-')[0]) {
    failures.push(file + ': version core "' + pkg.version.split('-')[0] + '" differs from release core "' + releaseVersion.split('-')[0] + '"');
  }
}

const sdkEntry = path.join(ROOT, 'packages/aifeed-verify/index.js');
if (!fs.existsSync(sdkEntry)) failures.push('packages/aifeed-verify/index.js is missing');

const specBase = 'spec/en';
const specMirrors = ['spec/id', 'spec/zh'];
const specFiles = fs.readdirSync(path.join(ROOT, specBase)).filter((name) => name.endsWith('.md')).sort();
for (const mirror of specMirrors) {
  const files = fs.readdirSync(path.join(ROOT, mirror)).filter((name) => name.endsWith('.md')).sort();
  for (const name of specFiles) {
    if (!files.includes(name)) failures.push(mirror + ': missing mirror of ' + specBase + '/' + name);
  }
  for (const name of files) {
    if (!specFiles.includes(name)) failures.push(specBase + ': missing mirror of ' + mirror + '/' + name);
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
  const staleOrgPattern = new RegExp('github\\.com/' + 'aifeed' + '/');
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
    if (staleOrgPattern.test(text)) failures.push('stale GitHub org URL in tracked file (use github.com/denyn1/aifeed-protocol): ' + relative);
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
