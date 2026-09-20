'use strict';

const parse = require('./lib/parse');
const jcs = require('./lib/jcs');
const cryptoLib = require('./lib/crypto');
const schemaLib = require('./lib/schema');
const validateLib = require('./lib/validate');
const digestLib = require('./lib/digest');
const revocationLib = require('./lib/revocation');
const rotationLib = require('./lib/rotation');
const bundleLib = require('./lib/bundle');
const remoteLib = require('./lib/remote');
const makoLib = require('./lib/mako');
const manifestSchema = require('./schema/ai-json.v0.1.json');
const signatureSchema = require('./schema/ai-signature.v0.1.json');
const manifestSchemaV02 = require('./schema/ai-json.v0.2.json');

function decodeInlineSignature(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = /^(?:mako1|aimd1):/.exec(headerValue);
  if (!match) return null;
  try {
    const text = Buffer.from(headerValue.slice(match[0].length), 'base64url').toString('utf8');
    parse.parseStrict(text, { integersOnly: true, maxDepth: 10, requireNFC: true });
    return text;
  } catch (error) {
    return null;
  }
}

async function resolveMakoSignature(url, response, options) {
  const inline = decodeInlineSignature(response.headers['x-aifeed-signature']);
  if (inline) return inline;
  if (typeof response.headers['x-aifeed-signature-url'] === 'string') {
    try {
      const target = new URL(response.headers['x-aifeed-signature-url'], url).toString();
      const signature = await remoteLib.fetchText(target, {
        accept: 'application/json',
        allowedContentTypes: ['application/json'],
        maxBytes: 2 * 1024,
        allowPrivate: options.allowPrivate,
        ca: options.ca
      });
      return signature.text;
    } catch (error) {
      return null;
    }
  }
  if (options.fetchDefaultSignature === false) return null;
  try {
    const signature = await remoteLib.fetchText(url + '.sig', {
      accept: 'application/json',
      allowedContentTypes: ['application/json'],
      maxBytes: 2 * 1024,
      allowPrivate: options.allowPrivate,
      ca: options.ca
    });
    return signature.text;
  } catch (error) {
    return null;
  }
}

async function fetchMako(url, options = {}) {
  const mediaType = options.mediaType === 'text/aifeed+markdown' ? 'text/aifeed+markdown' : 'text/mako+markdown';
  const profile = mediaType === 'text/aifeed+markdown' ? 'aimd' : 'mako';
  const response = await remoteLib.fetchText(url, {
    accept: mediaType,
    allowedContentTypes: [mediaType, 'text/html'],
    maxBytes: options.maxBytes ?? 256 * 1024,
    timeout: options.timeout ?? 15000,
    allowPrivate: options.allowPrivate,
    ca: options.ca
  });
  const contentType = String(response.headers['content-type'] || '');
  if (!contentType.includes(mediaType)) {
    return {
      mako: false,
      url,
      profile,
      content_type: contentType,
      bytes: response.buffer.length,
      mako_verified: false,
      frontmatter: null,
      errors: [],
      warnings: [{ code: 'mako_not_served', message: 'content negotiation did not return ' + mediaType }]
    };
  }
  const parsed = makoLib.parseFrontmatter(response.buffer);
  const errors = [...parsed.errors];
  if (parsed.frontmatter !== null) {
    errors.push(...makoLib.validateDocumentFields(parsed.frontmatter, profile));
  }
  const warnings = [];
  let makoVerified = false;
  if (options.publicKeyValue) {
    const containerText = await resolveMakoSignature(url, response, options);
    if (containerText === null) {
      warnings.push({ code: 'mako_signature_missing', message: 'no signature found' });
    } else {
      const result = makoLib.verifyMakoContainer({
        containerText,
        pageUrl: url,
        bodyBytes: response.buffer,
        publicKey: cryptoLib.decodePublicKey(options.publicKeyValue),
        context: profile
      });
      makoVerified = result.ok;
      errors.push(...result.errors);
    }
  } else {
    warnings.push({ code: 'verification_skipped', message: 'no publicKeyValue provided' });
  }
  return {
    mako: true,
    url,
    profile,
    content_type: contentType,
    bytes: response.buffer.length,
    body: response.buffer,
    frontmatter: parsed.frontmatter,
    mako_verified: makoVerified,
    tokens: parsed.frontmatter ? parsed.frontmatter.tokens : null,
    errors,
    warnings
  };
}

async function fetchIndexDelta(indexUrl, options = {}) {
  const response = await remoteLib.fetchText(indexUrl, {
    accept: 'application/json',
    allowedContentTypes: ['application/json'],
    maxBytes: options.maxBytes ?? 5 * 1024 * 1024,
    timeout: options.timeout ?? 15000,
    allowPrivate: options.allowPrivate,
    ca: options.ca
  });
  let index;
  try {
    index = parse.parseStrict(response.text, { integersOnly: true, maxDepth: 10, requireNFC: true });
  } catch (error) {
    return { ok: false, entries: [], changed: [], errors: [{ code: error.code || 'parse_error', message: error.message }] };
  }
  const errors = [];
  const schemaErrors = schemaLib.validate(index, require('./schema/mako-index.v0.2.json'), { root: require('./schema/mako-index.v0.2.json') });
  for (const schemaError of schemaErrors) {
    errors.push({ code: 'mako_index_invalid', path: schemaError.path, message: schemaError.message });
  }
  const entries = Array.isArray(index.entries) ? index.entries : [];
  const stored = options.storedDigests || {};
  const changed = entries.filter((entry) => stored[entry.url] !== entry['sha-256']);
  return { ok: errors.length === 0, index, entries, changed, errors };
}

function decideUsage(result, usageKey) {
  if (!result || !result.usage) return { allowed: false, attribution: null, reason: 'no_permissions' };
  const value = result.usage[usageKey];
  return {
    allowed: value === 'allow',
    attribution: result.attribution || null,
    reason: value === 'allow' ? 'allowed' : 'denied'
  };
}

function normalizeAsset(asset, pageUrl) {
  if (!asset || typeof asset !== 'object') return null;
  if (typeof asset.url !== 'string' || asset.url === '' || typeof asset.type !== 'string') return null;
  let resolved = asset.url;
  if (pageUrl && !/^(https?:)?\/\//i.test(resolved)) {
    try {
      resolved = new URL(resolved, pageUrl).toString();
    } catch (error) {
      resolved = asset.url;
    }
  }
  const normalized = { url: resolved, type: asset.type };
  for (const key of ['mime', 'title', 'alt', 'sha-256']) {
    if (typeof asset[key] === 'string' && asset[key] !== '') normalized[key] = asset[key];
  }
  if (Number.isInteger(asset.size) && asset.size >= 0) normalized.size = asset.size;
  return normalized;
}

function listAssets(result, options = {}) {
  const source = result && result.frontmatter ? result.frontmatter : result;
  const assets = source && source.aifeed && Array.isArray(source.aifeed.assets) ? source.aifeed.assets : [];
  const pageUrl = options.pageUrl || (result && typeof result.url === 'string' ? result.url : null);
  return assets.map((asset) => normalizeAsset(asset, pageUrl)).filter(Boolean);
}

function verifyAsset(bytes, asset) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const errors = [];
  const warnings = [];
  if (!asset || typeof asset !== 'object') {
    return {
      ok: false,
      verified: false,
      size: buffer.length,
      'sha-256': null,
      errors: [{ code: 'asset_invalid', message: 'asset entry missing' }],
      warnings
    };
  }
  if (Number.isInteger(asset.size) && asset.size >= 0 && buffer.length !== asset.size) {
    errors.push({
      code: 'asset_size_mismatch',
      message: 'expected ' + asset.size + ' bytes, got ' + buffer.length
    });
  }
  if (typeof asset['sha-256'] === 'string' && asset['sha-256'] !== '') {
    const digest = digestLib.sha256Base64(buffer);
    if (digest !== asset['sha-256']) {
      errors.push({ code: 'asset_digest_mismatch', message: 'sha-256 mismatch' });
    }
  }
  const verified = Number.isInteger(asset.size) || typeof asset['sha-256'] === 'string';
  if (!verified) {
    warnings.push({ code: 'asset_no_integrity', message: 'asset has no size or sha-256 to verify' });
  }
  return { ok: errors.length === 0, verified, size: buffer.length, 'sha-256': verified ? digestLib.sha256Base64(buffer) : null, errors, warnings };
}

function normalizeTerms(query) {
  return String(query || '')
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 2);
}

function scoreIndexEntry(entry, terms) {
  let score = 0;
  const title = String(entry.title || '').toLowerCase();
  const summary = String(entry.summary || '').toLowerCase();
  const url = String(entry.url || '').toLowerCase();
  const tags = Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag).toLowerCase()) : [];
  for (const term of terms) {
    if (title.includes(term)) score += 3;
    if (tags.some((tag) => tag.includes(term))) score += 2;
    if (summary.includes(term)) score += 1;
    if (url.includes(term)) score += 1;
  }
  return score;
}

async function fetchAimd(url, options = {}) {
  return fetchMako(url, { ...options, mediaType: 'text/aifeed+markdown' });
}

function selectEntries(entries, options = {}) {
  const terms = normalizeTerms(options.query);
  const maxPages = Number.isFinite(options.maxPages) ? options.maxPages : Infinity;
  const maxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : Infinity;
  const scored = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || typeof entry !== 'object') continue;
    const score = terms.length === 0 ? 1 : scoreIndexEntry(entry, terms);
    if (score <= 0) continue;
    scored.push({ entry, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const updated = String(b.entry.updated || '').localeCompare(String(a.entry.updated || ''));
    if (updated !== 0) return updated;
    return String(a.entry.url || '').localeCompare(String(b.entry.url || ''));
  });
  const selected = [];
  let totalTokens = 0;
  for (const item of scored) {
    if (selected.length >= maxPages) break;
    const tokens = Number(item.entry.tokens) || 0;
    if (selected.length > 0 && totalTokens + tokens > maxTokens) continue;
    selected.push({ ...item.entry, score: item.score });
    totalTokens += tokens;
  }
  return {
    selected,
    considered: scored.length,
    skipped: scored.length - selected.length,
    total_tokens: totalTokens,
    terms
  };
}

module.exports = {
  parseStrict: parse.parseStrict,
  StrictParseError: parse.StrictParseError,
  manifestSchema,
  manifestSchemaV02,
  signatureSchema,
  jcs,
  crypto: cryptoLib,
  schema: schemaLib,
  ...validateLib,
  digest: digestLib,
  revocation: revocationLib,
  rotation: rotationLib,
  bundle: bundleLib,
  remote: remoteLib,
  rawDigestOf: digestLib.rawDigestOf,
  verifyRawDigest: digestLib.verifyRawDigest,
  parseContentDigest: digestLib.parseContentDigest,
  verifyContentDigest: digestLib.verifyContentDigest,
  verifyRevocationDocument: revocationLib.verifyRevocationDocument,
  createBundle: bundleLib.createBundle,
  verifyBundle: bundleLib.verifyBundle,
  fetchText: remoteLib.fetchText,
  lookupAifeedTxt: remoteLib.lookupAifeedTxt,
  resolvePinnedAddress: remoteLib.resolvePinnedAddress,
  discoverManifestUrl: remoteLib.discoverManifestUrl,
  mako: makoLib,
  fetchMako,
  fetchAimd,
  fetchIndexDelta,
  decideUsage,
  listAssets,
  verifyAsset,
  selectEntries,
  verifyAimdDocument: makoLib.verifyAimdDocument,
  verifyAimdIndex: makoLib.verifyAimdIndex,
  AIMD_MEDIA_TYPE: makoLib.AIMD_MEDIA_TYPE,
  MAKO_MEDIA_TYPE: makoLib.MAKO_MEDIA_TYPE,
  AIMD_SEPARATION: makoLib.AIMD_SEPARATION,
  AIMD_INDEX_SEPARATION: makoLib.AIMD_INDEX_SEPARATION
};
