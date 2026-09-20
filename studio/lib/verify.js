'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const makoLib = require('../../lib/mako');
const siteLib = require('../../lib/site');
const validateLib = require('../../lib/validate');

function walkFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, results);
    else results.push(full);
  }
  return results;
}

function verifyBuild(options) {
  const outDir = path.resolve(options.outDir);
  const domain = options.domain;
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());

  const manifestResult = validateLib.verifyDirectory(path.join(outDir, '.well-known'), { domain, now });
  const privateKey = nodeCrypto.createPrivateKey(fs.readFileSync(options.keyPath));
  const publicKey = nodeCrypto.createPublicKey(privateKey);

  const pageFiles = walkFiles(outDir).filter((file) => /\.(aifeed|mako)\.md$/.test(file));
  const failed = [];
  let ok = 0;
  for (const file of pageFiles) {
    const relative = path.relative(outDir, file).split(path.sep).join('/');
    const context = relative.endsWith('.aifeed.md') ? 'aimd' : 'mako';
    const urlPath = siteLib.pagePathFor(relative.replace(/\.(aifeed|mako)\.md$/, '.html'));
    let result;
    try {
      result = makoLib.verifyMakoContainer({
        containerText: fs.readFileSync(file + '.sig', 'utf8'),
        pageUrl: 'https://' + domain + urlPath,
        bodyBytes: fs.readFileSync(file),
        publicKey,
        context
      });
    } catch (error) {
      result = { ok: false, errors: [{ code: 'verify_error', message: error.message }] };
    }
    if (result.ok) ok++;
    else failed.push({ file: relative, errors: result.errors });
  }

  const indexes = [];
  for (const [fileName, context] of [['aifeed-index.json', 'aimd-index'], ['mako-index.json', 'mako-index']]) {
    const indexFile = path.join(outDir, '.well-known', fileName);
    if (!fs.existsSync(indexFile) || !fs.existsSync(indexFile + '.sig')) continue;
    const result = makoLib.verifyMakoContainer({
      containerText: fs.readFileSync(indexFile + '.sig', 'utf8'),
      pageUrl: 'https://' + domain + '/.well-known/' + fileName,
      bodyBytes: fs.readFileSync(indexFile),
      publicKey,
      context
    });
    indexes.push({ file: fileName, ok: result.ok, errors: result.errors });
  }

  const okAll = manifestResult.result === 'VERIFIED' && failed.length === 0 && indexes.every((entry) => entry.ok);
  return {
    result: okAll ? 'VERIFIED' : 'UNVERIFIED',
    manifest: { result: manifestResult.result, errors: manifestResult.errors, warnings: manifestResult.warnings },
    pages: { total: pageFiles.length, ok, failed },
    indexes
  };
}

module.exports = { verifyBuild, walkFiles };
