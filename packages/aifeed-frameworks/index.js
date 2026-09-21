'use strict';

const fs = require('node:fs');
const path = require('node:path');
const siteLib = require('./lib/site');
const validateLib = require('./lib/validate');
const cryptoLib = require('./lib/crypto');

const DEFAULT_KEY_FILE = 'aifeed-private.pem';
const PRUNE_PATTERN = /\.(aifeed|mako)\.md(\.sig)?$/;

function resolveConfig(options = {}, context = {}) {
  const root = path.resolve(context.root || process.cwd());
  const domain = String(options.domain || process.env.AIFEED_DOMAIN || '').trim();
  if (!domain) {
    throw new Error('AIFeed: a domain is required — pass { domain: "example.com" } or set AIFEED_DOMAIN');
  }
  const outDir = path.resolve(root, context.outDir || options.outDir || 'dist');
  if (!fs.existsSync(outDir) || !fs.statSync(outDir).isDirectory()) {
    throw new Error('AIFeed: build output directory not found: ' + outDir);
  }
  const keyPath = path.resolve(root, options.keyPath || process.env.AIFEED_KEY || DEFAULT_KEY_FILE);
  if (!fs.existsSync(keyPath)) {
    throw new Error('AIFeed: private key not found at ' + keyPath +
      ' — generate one with "npx aifeed-build keygen --out ." or point keyPath at an existing key');
  }
  return {
    root,
    outDir,
    keyPath,
    domain,
    baseUrl: options.baseUrl || process.env.AIFEED_BASE_URL || ('https://' + domain),
    name: options.name || domain,
    description: options.description,
    type: options.type || 'blog',
    locale: options.locale || 'en',
    contact: options.contact || 'mailto:ai@' + domain,
    keyId: options.keyId || 'site-key-1',
    profile: options.profile === 'mako' || options.profile === 'both' ? options.profile : 'aimd',
    inject: options.inject !== false,
    llms: options.llms !== false,
    prune: options.prune !== false,
    verifyAfter: options.verifyAfter !== false,
    updated: options.updated,
    permissions: options.permissions,
    limits: options.limits,
    license: options.license,
    sitemap: options.sitemap,
    maxCheckIntervalHours: options.maxCheckIntervalHours,
    log: options.log !== false
  };
}

function pruneGenerated(outDir) {
  let removed = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (PRUNE_PATTERN.test(entry.name) || entry.name === 'llms.txt') {
        fs.unlinkSync(full);
        removed++;
      }
    }
  };
  walk(outDir);
  return removed;
}

function runBuild(options = {}, context = {}) {
  const config = resolveConfig(options, context);
  const write = typeof options.logger === 'function'
    ? (message) => options.logger(message)
    : (message) => { if (config.log) console.log(message); };

  if (config.prune) {
    const removed = pruneGenerated(config.outDir);
    if (removed > 0) write('AIFeed: pruned ' + removed + ' generated file(s)');
  }

  let summary;
  try {
    summary = siteLib.buildSite({
      dir: config.outDir,
      domain: config.domain,
      baseUrl: config.baseUrl,
      name: config.name,
      description: config.description,
      type: config.type,
      locale: config.locale,
      contact: config.contact,
      keyPath: config.keyPath,
      keyId: config.keyId,
      profile: config.profile,
      inject: config.inject,
      llms: config.llms,
      updated: config.updated,
      permissions: config.permissions,
      limits: config.limits,
      license: config.license,
      sitemap: config.sitemap,
      maxCheckIntervalHours: config.maxCheckIntervalHours
    });
  } catch (error) {
    throw new Error('AIFeed: ' + error.message);
  }

  if (config.verifyAfter) {
    const verification = validateLib.verifyDirectory(path.join(config.outDir, '.well-known'), { domain: config.domain });
    if (verification.result !== 'VERIFIED') {
      const codes = (verification.errors || []).map((item) => item.code).filter(Boolean).join(', ');
      throw new Error('AIFeed: self-verification failed' + (codes ? ' (' + codes + ')' : ''));
    }
  }

  write('AIFeed: signed ' + summary.pages.length + ' page(s) · profile ' + summary.profile +
    ' · key ' + summary.fingerprint.slice(0, 24) + '… · ' + summary.dir);
  for (const warning of summary.warnings) {
    write('AIFeed warning: [' + warning.code + '] ' + (warning.file ? warning.file + ': ' : '') + warning.message);
  }
  return summary;
}

function keygen(options = {}) {
  const outDir = path.resolve(options.out || '.');
  const privatePath = path.join(outDir, DEFAULT_KEY_FILE);
  const publicPath = path.join(outDir, 'aifeed-public.txt');
  if (fs.existsSync(privatePath) && !options.force) {
    throw new Error('AIFeed: refusing to overwrite existing key at ' + privatePath + ' (use --force)');
  }
  fs.mkdirSync(outDir, { recursive: true });
  const { privateKey, publicKey } = cryptoLib.generateKeyPair();
  fs.writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const publicKeyValue = cryptoLib.encodePublicKey(publicKey);
  const fingerprint = cryptoLib.fingerprintOf(publicKey);
  fs.writeFileSync(publicPath, publicKeyValue + '\n' + fingerprint + '\n');
  return {
    private_key: privatePath,
    public_key: publicPath,
    public_key_value: publicKeyValue,
    fingerprint
  };
}

module.exports = { resolveConfig, pruneGenerated, runBuild, keygen, DEFAULT_KEY_FILE };
