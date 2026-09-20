'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const makoHtmlLib = require('../../lib/mako-html');
const makoLib = require('../../lib/mako');
const cryptoLib = require('../../lib/crypto');
const siteLib = require('../../lib/site');
const validateLib = require('../../lib/validate');
const policyLib = require('./policy');
const { outputBaseFor } = require('./crawl');
const { sha256Base64, rawDigestOf } = require('../../lib/digest');

const SUFFIX = { aimd: '.aifeed.md', mako: '.mako.md' };

function isoSeconds(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function writtenProfiles(profile) {
  if (profile === 'both') return ['aimd', 'mako'];
  if (profile === 'mako') return ['mako'];
  return ['aimd'];
}

function loadKey(keyPath) {
  const privateKey = nodeCrypto.createPrivateKey(fs.readFileSync(keyPath));
  const publicKey = nodeCrypto.createPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    publicKeyValue: cryptoLib.encodePublicKey(publicKey),
    fingerprint: cryptoLib.fingerprintOf(publicKey)
  };
}

function writePageFiles(outDir, relative, profileList, text, privateKey, pageUrl, signedAt) {
  const mdBytes = Buffer.from(text, 'utf8');
  const files = [];
  let primary = null;
  for (const writtenProfile of profileList) {
    const mdRelative = siteLib.mdPathFor(relative, writtenProfile);
    const mdPath = path.join(outDir, mdRelative);
    fs.mkdirSync(path.dirname(mdPath), { recursive: true });
    fs.writeFileSync(mdPath, mdBytes);
    const container = makoLib.signMakoContainer(privateKey, pageUrl, mdBytes, {
      context: writtenProfile,
      signedAt
    });
    fs.writeFileSync(mdPath + '.sig', JSON.stringify(container, null, 2) + '\n');
    files.push(mdRelative.split(path.sep).join('/') + '.sig', mdRelative.split(path.sep).join('/'));
    if (primary === null) primary = mdRelative.split(path.sep).join('/');
  }
  return { mdBytes, files, primary };
}

function writeIndexFiles(outDir, profile, index, privateKey, baseUrl, signedAt) {
  const indexText = JSON.stringify(index, null, 2) + '\n';
  const indexBytes = Buffer.from(indexText, 'utf8');
  const results = [];
  const targets = profile === 'mako'
    ? [['mako-index.json', 'mako-index']]
    : profile === 'both'
      ? [['aifeed-index.json', 'aimd-index'], ['mako-index.json', 'mako-index']]
      : [['aifeed-index.json', 'aimd-index']];
  for (const [fileName, context] of targets) {
    const indexUrl = baseUrl + '/.well-known/' + fileName;
    const container = makoLib.signMakoContainer(privateKey, indexUrl, indexBytes, { context, signedAt });
    fs.writeFileSync(path.join(outDir, '.well-known', fileName), indexText);
    fs.writeFileSync(path.join(outDir, '.well-known', fileName + '.sig'), JSON.stringify(container, null, 2) + '\n');
    results.push(fileName);
  }
  return results;
}

function writeLlms(outDir, options) {
  const lines = ['# ' + options.name, ''];
  lines.push('> ' + (options.description || 'AI-ready content published with AIFeed.'), '');
  lines.push('## Pages', '');
  for (const entry of options.entries) {
    const summary = entry.summary ? ': ' + entry.summary : '';
    lines.push('- [' + (entry.title || entry.url) + '](' + options.baseUrl + entry.url + ')' + summary);
  }
  lines.push('', '## Metadata', '', '- AIFeed manifest: ' + options.baseUrl + '/.well-known/ai.json', '');
  fs.writeFileSync(path.join(outDir, 'llms.txt'), lines.join('\n'));
}

function publishProject(options) {
  const {
    project,
    policy,
    sourceDir,
    outDir,
    keyPath,
    statePath,
    incremental = true,
    now = new Date(),
    onProgress = () => {}
  } = options;

  let pageInputs;
  if (Array.isArray(options.pages) && options.pages.length > 0) {
    pageInputs = options.pages.map((page) => ({
      relative: outputBaseFor(page.urlPath) + '.html',
      urlPath: page.urlPath,
      htmlPath: page.htmlPath || null,
      htmlText: page.htmlText !== undefined ? page.htmlText : null
    }));
  } else {
    if (!sourceDir || !fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      throw new Error('source directory not found: ' + sourceDir);
    }
    pageInputs = siteLib.collectHtmlFiles(path.resolve(sourceDir)).map((htmlPath) => {
      const relative = path.relative(path.resolve(sourceDir), htmlPath);
      return { relative, urlPath: siteLib.pagePathFor(relative), htmlPath, htmlText: null };
    });
    if (pageInputs.length === 0) throw new Error('no HTML files found in ' + sourceDir);
  }

  const baseUrl = 'https://' + project.domain;
  const profile = project.profile;
  const profileList = writtenProfiles(profile);
  const key = loadKey(keyPath);
  const signedAt = isoSeconds(now);
  const policyHash = sha256Base64(Buffer.from(JSON.stringify({ policy, profile })));
  const previousState = incremental ? (options.previousState || null) : null;
  const reuse = previousState && previousState.policy_hash === policyHash ? previousState : null;

  const htmlFiles = pageInputs;
  if (htmlFiles.length === 0) throw new Error('no pages to build');

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, '.well-known'), { recursive: true });

  const pages = {};
  const indexEntries = [];
  const warnings = [];
  let processed = 0;
  let skipped = 0;

  htmlFiles.forEach((input, position) => {
    const relative = input.relative;
    const urlPath = input.urlPath;
    const pageUrl = baseUrl + urlPath;
    const htmlText = input.htmlText !== null ? input.htmlText : fs.readFileSync(input.htmlPath, 'utf8');
    const htmlHash = sha256Base64(Buffer.from(htmlText, 'utf8'));
    const previous = reuse && reuse.pages ? reuse.pages[urlPath] : null;

    let entry;
    if (previous && previous.html_sha256 === htmlHash && previous.entry) {
      entry = previous.entry;
      pages[urlPath] = {
        html_sha256: htmlHash,
        md_sha256: previous.md_sha256,
        entry,
        files: previous.files || [],
        primary: previous.primary || null,
        built_at: previous.built_at || signedAt
      };
      skipped++;
    } else {
      const override = policyLib.resolveOverride(policy, urlPath);
      const converted = makoHtmlLib.htmlToMako(htmlText, {
        profile,
        canonical: pageUrl,
        updated: options.updated,
        alternates: siteLib.extractAlternates(htmlText, baseUrl),
        aifeed: override || undefined
      });
      for (const warning of converted.warnings) {
        warnings.push({ file: relative.split(path.sep).join('/'), ...warning });
      }
      const written = writePageFiles(outDir, relative, profileList, converted.text, key.privateKey, pageUrl, signedAt);
      entry = siteLib.buildSiteIndexEntry(urlPath, written.mdBytes, converted.frontmatter);
      pages[urlPath] = {
        html_sha256: htmlHash,
        md_sha256: sha256Base64(written.mdBytes),
        entry,
        files: written.files,
        primary: written.primary,
        built_at: signedAt
      };
      processed++;
    }
    indexEntries.push(entry);
    if (position % 25 === 0 || position === htmlFiles.length - 1) {
      onProgress({ type: 'progress', phase: 'build', done: position + 1, total: htmlFiles.length, current: urlPath });
    }
  });

  for (const [urlPath, previousPage] of Object.entries(reuse && reuse.pages ? reuse.pages : {})) {
    if (pages[urlPath]) continue;
    for (const file of previousPage.files || []) {
      try {
        fs.unlinkSync(path.join(outDir, file));
      } catch (error) {
        // already gone
      }
    }
  }

  indexEntries.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const index = {
    version: '0.2',
    domain: project.domain,
    site: {
      name: project.name,
      description: project.description || undefined,
      type: project.type,
      languages: [String(project.locale).split('-')[0].toLowerCase()],
      license: policy.license ? policy.license.name : undefined,
      updated_at: signedAt
    },
    generated_at: signedAt,
    page: 1,
    page_count: 1,
    entries: indexEntries
  };
  const indexFiles = writeIndexFiles(outDir, profile, index, key.privateKey, baseUrl, signedAt);

  const manifest = siteLib.buildManifest({
    dir: outDir,
    domain: project.domain,
    name: project.name,
    type: project.type,
    locale: project.locale,
    contact: project.contact,
    publicKey: key.publicKeyValue,
    keyId: project.key_id,
    profile,
    languages: [String(project.locale).split('-')[0].toLowerCase()],
    llms: policy.llms,
    sitemap: options.sitemap,
    permissions: {
      usage: policy.usage,
      attribution: policy.attribution,
      attribution_url: policy.attribution_url || undefined,
      attribution_text: policy.attribution_text || undefined
    },
    limits: policy.limits,
    license: policy.license || undefined,
    maxCheckIntervalHours: policy.max_check_interval_hours
  });
  const manifestCheck = validateLib.checkManifest(manifest, { domain: project.domain, now });
  if (manifestCheck.errors.length > 0) {
    throw new Error('manifest invalid: ' + manifestCheck.errors.map((error) => error.code).join(', '));
  }
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  const manifestBytes = Buffer.from(manifestText, 'utf8');
  const manifestSignature = {
    algorithm: 'ed25519',
    canonicalization: 'jcs-rfc8785',
    signature: cryptoLib.encodeSignature(cryptoLib.signManifest(key.privateKey, manifest)),
    raw_digest: rawDigestOf(manifestBytes)
  };
  fs.writeFileSync(path.join(outDir, '.well-known', 'ai.json'), manifestText);
  fs.writeFileSync(path.join(outDir, '.well-known', 'ai-signature.json'), JSON.stringify(manifestSignature, null, 2) + '\n');

  if (policy.llms) {
    writeLlms(outDir, {
      name: project.name,
      description: project.description,
      baseUrl,
      entries: indexEntries
    });
  }

  const state = {
    version: 1,
    policy_hash: policyHash,
    profile,
    fingerprint: key.fingerprint,
    built_at: signedAt,
    pages
  };
  if (statePath) fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

  return {
    result: 'BUILT',
    total: htmlFiles.length,
    processed,
    skipped,
    warnings,
    outDir,
    domain: project.domain,
    fingerprint: key.fingerprint,
    indexFiles,
    manifest: path.join(outDir, '.well-known', 'ai.json')
  };
}

module.exports = { publishProject, loadKey, writtenProfiles, SUFFIX };
