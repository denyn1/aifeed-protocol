'use strict';

const remote = require('../../lib/remote');
const validateLib = require('../../lib/validate');
const cryptoLib = require('../../lib/crypto');

function compareAnchor(records, publicKeyValue) {
  const warnings = [];
  const errors = [];
  if (!Array.isArray(records) || records.length === 0) {
    return { anchored: false, errors, warnings: [{ code: 'dns_not_anchored', message: 'no _aifeed TXT record found' }] };
  }
  const usable = records.filter((record) => record && record.v === 'aifeed1');
  const selected = usable.length > 0 ? usable : records;
  const distinctKeys = new Set(selected.map((record) => record.pk).filter(Boolean));
  if (distinctKeys.size > 1) {
    errors.push({ code: 'dns_mismatch', message: 'multiple _aifeed TXT records with different public keys' });
    return { anchored: false, errors, warnings };
  }
  const record = selected[0];
  if (record.pk !== publicKeyValue) {
    errors.push({ code: 'dns_mismatch', message: 'DNS TXT public key does not match the manifest key' });
    return { anchored: false, errors, warnings };
  }
  if (typeof record.fp === 'string' && record.fp.length > 0) {
    let matches = false;
    try {
      matches = record.fp === cryptoLib.fingerprintOf(cryptoLib.decodePublicKey(publicKeyValue));
    } catch (error) {
      matches = false;
    }
    if (!matches) {
      errors.push({ code: 'dns_mismatch', message: 'DNS TXT fingerprint does not match the manifest key' });
      return { anchored: false, errors, warnings };
    }
  }
  return { anchored: true, errors, warnings };
}

async function liveVerify(options) {
  const domain = options.domain;
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const manifestResponse = await remote.fetchText('https://' + domain + '/.well-known/ai.json', {
    maxBytes: 100 * 1024,
    allowedContentTypes: ['application/json']
  });
  let manifest;
  try {
    manifest = JSON.parse(manifestResponse.text);
  } catch (error) {
    return { result: 'UNVERIFIED', dns_anchored: null, errors: [{ code: 'parse_error', message: 'manifest is not valid JSON' }], warnings: [] };
  }
  const signatureUrl = manifest.identity && manifest.identity.signature_url
    ? new URL(manifest.identity.signature_url, 'https://' + domain).toString()
    : 'https://' + domain + '/.well-known/ai-signature.json';
  const signatureResponse = await remote.fetchText(signatureUrl, {
    maxBytes: 2 * 1024,
    allowedContentTypes: ['application/json']
  });

  const verified = validateLib.verifyAll({
    manifestText: manifestResponse.text,
    signatureText: signatureResponse.text,
    domain,
    now
  });

  const errors = [...verified.errors];
  const warnings = [...verified.warnings];
  let anchored = null;
  try {
    const records = await remote.lookupAifeedTxt(domain);
    const anchor = compareAnchor(records, manifest.identity ? manifest.identity.public_key : '');
    errors.push(...anchor.errors);
    warnings.push(...anchor.warnings);
    anchored = anchor.anchored;
  } catch (error) {
    warnings.push({ code: 'dns_lookup_failed', message: error.message });
  }

  return {
    result: errors.length === 0 ? 'VERIFIED' : 'UNVERIFIED',
    dns_anchored: anchored,
    errors,
    warnings,
    manifest: {
      domain: manifest.identity ? manifest.identity.domain : null,
      version: manifest.version || null,
      profile: manifest.content ? manifest.content.profile || null : null
    }
  };
}

module.exports = { liveVerify, compareAnchor };
