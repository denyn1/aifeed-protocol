#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { parseStrict, StrictParseError } = require('../lib/parse');
const { validate: validateSchema } = require('../lib/schema');
const cryptoLib = require('../lib/crypto');
const validateLib = require('../lib/validate');
const bundleLib = require('../lib/bundle');
const revocationLib = require('../lib/revocation');
const rotationLib = require('../lib/rotation');
const scaffoldLib = require('../lib/scaffold');
const openapiLib = require('../lib/openapi');
const makoLib = require('../lib/mako');
const makoHtmlLib = require('../lib/mako-html');
const siteLib = require('../lib/site');
const { rawDigestOf, verifyContentDigest, sha256Base64 } = require('../lib/digest');
const remote = require('../lib/remote');
const manifestSchema = require('../schema/ai-json.v0.1.json');
const manifestSchema02 = require('../schema/ai-json.v0.2.json');

const VERSION = require('../package.json').version;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item.startsWith('--')) {
      const equals = item.indexOf('=');
      if (equals !== -1) {
        args[item.slice(2, equals)] = item.slice(equals + 1);
      } else {
        const key = item.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          args[key] = next;
          i++;
        } else {
          args[key] = true;
        }
      }
    } else {
      args._.push(item);
    }
  }
  return args;
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function fail(message, code = 2) {
  process.stderr.write('error: ' + message + '\n');
  process.exitCode = code;
  return null;
}

function usage() {
  process.stderr.write(
    'aifeed ' + VERSION + ' — AIFeed protocol tools\n\n' +
    'Usage:\n' +
    '  aifeed keygen [--out DIR] [--force]\n' +
    '  aifeed sign <ai.json> [--key FILE] [--out PATH]\n' +
    '  aifeed rotate --dir DIR [--key FILE] [--window H] [--accelerated] [--lead H] [--dry-run] [--json]\n' +
    '  aifeed validate <domain|DIR|FILE> [--json] [--now ISO] [--domain D] [--revocation-url URL] [--governance-key FILE] [--require-dns-anchor]\n' +
    '  aifeed bundle create <sourceDir> --out <bundleDir> --domain D [--key FILE] [--key-id ID] [--revocation FILE]\n' +
    '  aifeed bundle verify <bundleDir> [--bundler-key FILE] [--json] [--now ISO]\n' +
    '  aifeed init --domain D [--dir DIR] [--profile ' + Object.keys(scaffoldLib.PROFILES).join('|') + '] [--name N] [--organization O] [--contact MAILTO] [--locale L] [--force]\n' +
    '  aifeed import-openapi <spec.json> [--out FILE]\n' +
    '  aifeed mako generate <html|DIR> [--out PATH] [--format mako|aimd|both] [--type T] [--entity E] [--url URL] [--language L] [--max-tokens N] [--aifeed FILE] [--alternates FILE]\n' +
    '  aifeed mako sign <file.aifeed.md|file.mako.md> --url URL [--key FILE] [--out PATH]\n' +
    '  aifeed mako verify <file.aifeed.md|file.mako.md> --url URL [--key FILE|--manifest ai.json] [--signature FILE] [--json]\n' +
    '  aifeed mako index <DIR> (--domain D|--base-url URL) [--format mako|aimd] [--out FILE] [--sign --key FILE] [--manifest ai.json] [--name N] [--description D] [--license L]\n' +
    '  aifeed mako fetch <URL> [--format mako|aimd|both] [--key FILE] [--out FILE] [--json]\n' +
    '  aifeed aimd <generate|sign|verify|index|fetch> ...   # alias for mako with --format aimd\n' +
    '  aifeed site build <DIR> --domain D --key PRIVATE.pem [--profile aimd|mako|both] [--base-url URL] [--name N] [--type T] [--locale L] [--contact MAILTO] [--inject] [--llms] [--json]\n\n' +
    'Exit codes: 0 verified, 1 unverified, 2 usage/internal error\n'
  );
  process.exitCode = 2;
}

function runKeygen(args) {
  const outDir = args.out || '.';
  const privatePath = path.join(outDir, 'aifeed-private.pem');
  const publicPath = path.join(outDir, 'aifeed-public.txt');

  if (fs.existsSync(privatePath) && !args.force) {
    return fail('refusing to overwrite existing key at ' + privatePath + ' (use --force)');
  }

  fs.mkdirSync(outDir, { recursive: true });
  const { privateKey, publicKey } = cryptoLib.generateKeyPair();
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicKeyValue = cryptoLib.encodePublicKey(publicKey);
  const fingerprint = cryptoLib.fingerprintOf(publicKey);

  fs.writeFileSync(privatePath, pem, { mode: 0o600 });
  fs.writeFileSync(publicPath, publicKeyValue + '\n' + fingerprint + '\n');

  printJson({
    private_key: privatePath,
    public_key: publicPath,
    public_key_value: publicKeyValue,
    fingerprint
  });
  return 0;
}

function runSign(args) {
  const manifestPath = args._[0];
  if (!manifestPath) return usage();

  let manifestBuffer;
  let text;
  try {
    manifestBuffer = fs.readFileSync(manifestPath);
    text = manifestBuffer.toString('utf8');
  } catch (error) {
    return fail('cannot read manifest: ' + error.message);
  }

  let manifest;
  try {
    manifest = parseStrict(text, { integersOnly: true, maxDepth: 10, requireNFC: true });
  } catch (error) {
    if (error instanceof StrictParseError) return fail('manifest rejected (' + error.code + '): ' + error.message, 1);
    throw error;
  }

  const schema = cryptoLib.manifestFamily(manifest.version) === '0.2' ? manifestSchema02 : manifestSchema;
  const schemaErrors = validateSchema(manifest, schema);
  if (schemaErrors.length > 0) {
    for (const error of schemaErrors) {
      process.stderr.write('schema: ' + error.path + ' ' + error.message + '\n');
    }
    return fail('manifest does not conform to schema', 1);
  }

  const keyCandidates = [
    path.join(path.dirname(manifestPath), 'aifeed-private.pem'),
    path.join(path.dirname(path.dirname(manifestPath)), 'aifeed-private.pem')
  ];
  const keyPath = args.key || keyCandidates.find((candidate) => fs.existsSync(candidate)) || keyCandidates[0];
  let privateKey;
  try {
    privateKey = nodeCrypto.createPrivateKey(fs.readFileSync(keyPath));
  } catch (error) {
    return fail('cannot load private key: ' + error.message);
  }

  const derivedPublic = nodeCrypto.createPublicKey(privateKey);
  const derivedPublicValue = cryptoLib.encodePublicKey(derivedPublic);
  if (derivedPublicValue !== manifest.identity.public_key) {
    return fail('signer key does not match identity.public_key (signer_key_mismatch)', 1);
  }

  const signatureBytes = cryptoLib.signManifest(privateKey, manifest);
  if (!cryptoLib.verifyManifest(derivedPublic, manifest, signatureBytes)) {
    return fail('self-verification failed before writing output (self_verify_failed)', 1);
  }

  const container = {
    algorithm: 'ed25519',
    canonicalization: 'jcs-rfc8785',
    signature: cryptoLib.encodeSignature(signatureBytes)
  };
  if (!args['no-raw-digest']) {
    container.raw_digest = rawDigestOf(manifestBuffer);
  }

  let outPath = path.join(path.dirname(manifestPath), 'ai-signature.json');
  if (args.out) {
    const stat = fs.existsSync(args.out) ? fs.statSync(args.out) : null;
    outPath = stat && stat.isDirectory() ? path.join(args.out, 'ai-signature.json') : args.out;
  }
  fs.writeFileSync(outPath, JSON.stringify(container, null, 2) + '\n');

  printJson({
    manifest: manifestPath,
    signature: outPath,
    key_fingerprint: cryptoLib.fingerprintOf(derivedPublic),
    result: 'signed'
  });
  return 0;
}

function collectRemoteErrors(result, errors) {
  for (const error of errors) result.errors.push(error);
}

function isoSeconds(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function loadManifestFile(dir) {
  const manifestPath = path.join(dir, 'ai.json');
  const text = fs.readFileSync(manifestPath, 'utf8');
  return {
    manifestPath,
    manifest: parseStrict(text, { integersOnly: true, maxDepth: 10, requireNFC: true })
  };
}

function writeSignedManifest(dir, manifest, privateKey) {
  const buffer = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const signatureBytes = cryptoLib.signManifest(privateKey, manifest);
  if (!cryptoLib.verifyManifest(nodeCrypto.createPublicKey(privateKey), manifest, signatureBytes)) {
    throw new Error('self-verification failed before writing output (self_verify_failed)');
  }
  const manifestPath = path.join(dir, 'ai.json');
  const signaturePath = path.join(dir, 'ai-signature.json');
  fs.writeFileSync(manifestPath, buffer);
  fs.writeFileSync(signaturePath, JSON.stringify({
    algorithm: 'ed25519',
    canonicalization: 'jcs-rfc8785',
    signature: cryptoLib.encodeSignature(signatureBytes),
    raw_digest: rawDigestOf(buffer)
  }, null, 2) + '\n');
  return { manifestPath, signaturePath };
}

function dnsTxtLine(domain, fields) {
  return '_aifeed.' + domain + '. TXT "v=aifeed1; ' + fields.join('; ') + '; manifest=https://' + domain + '/.well-known/ai.json"';
}

async function runRotatePrepare(dir, args, manifest, dryRun) {
  if (manifest.rotation) return fail('manifest already carries a rotation directive', 1);
  const schemaErrors = validateSchema(manifest, manifestSchema02);
  if (schemaErrors.length > 0) {
    return fail('manifest does not conform to schema v0.2: ' + schemaErrors[0].path + ' ' + schemaErrors[0].message, 1);
  }

  const keyPath = args.key || path.join(dir, 'aifeed-private.pem');
  if (!fs.existsSync(keyPath)) return fail('private key not found at ' + keyPath + ' (pass --key)');
  let oldKey;
  try {
    oldKey = nodeCrypto.createPrivateKey(fs.readFileSync(keyPath));
  } catch (error) {
    return fail('cannot load private key: ' + error.message);
  }
  const oldPublicValue = cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(oldKey));
  if (oldPublicValue !== manifest.identity.public_key) {
    return fail('signer key does not match identity.public_key (signer_key_mismatch)', 1);
  }

  const windowHours = args.window ? Number(args.window) : (args.accelerated ? 6 : 72);
  const leadHours = args.lead ? Number(args.lead) : (args.accelerated ? 1 : 24);
  if (!(windowHours >= 1) || !(leadHours >= 0)) {
    return fail('--window must be at least 1 hour and --lead must not be negative');
  }

  const now = args.now ? new Date(args.now) : new Date();
  const effectiveAt = isoSeconds(new Date(now.getTime() + leadHours * 3600 * 1000));
  const graceUntil = isoSeconds(new Date(now.getTime() + (leadHours + windowHours) * 3600 * 1000));

  const { privateKey: nextPrivate, publicKey: nextPublic } = cryptoLib.generateKeyPair();
  const nextValue = cryptoLib.encodePublicKey(nextPublic);
  const nextFingerprint = cryptoLib.fingerprintOf(nextPublic);

  const overlap = JSON.parse(JSON.stringify(manifest));
  overlap.rotation = { successor_fp: nextFingerprint, effective_at: effectiveAt, grace_until: graceUntil };

  const check = validateLib.checkManifest(overlap, { domain: manifest.identity.domain, now });
  if (check.errors.length > 0) {
    return fail('overlap manifest failed validation: ' + check.errors.map((entry) => entry.code).join(', '), 1);
  }

  const nextKeyPath = path.join(dir, 'aifeed-private.next.pem');
  let written = { manifestPath: path.join(dir, 'ai.json'), signaturePath: path.join(dir, 'ai-signature.json') };
  if (!dryRun) {
    try {
      written = writeSignedManifest(dir, overlap, oldKey);
    } catch (error) {
      return fail('cannot write overlap manifest: ' + error.message);
    }
    fs.writeFileSync(nextKeyPath, nextPrivate.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(path.join(dir, 'aifeed-public.next.txt'), nextValue + '\n' + nextFingerprint + '\n');
  }

  const domain = manifest.identity.domain;
  const summary = {
    action: 'prepare',
    phase: 'announced',
    dry_run: dryRun,
    manifest: written.manifestPath,
    signature: written.signaturePath,
    successor_key: nextKeyPath,
    successor_fingerprint: nextFingerprint,
    effective_at: effectiveAt,
    grace_until: graceUntil,
    dns_txt: dnsTxtLine(domain, [
      'pk=' + manifest.identity.public_key,
      'pk2=' + nextValue,
      'effective_at=' + effectiveAt
    ]),
    warnings: check.warnings,
    next: [
      'publish the overlap manifest and the advisory DNS pk2 record now',
      'after ' + effectiveAt + ' run: aifeed rotate --dir ' + dir,
      'then publish the old fingerprint to the revocation registry (governance signatures)'
    ]
  };
  if (args.json) {
    printJson(summary);
  } else {
    process.stdout.write((dryRun ? 'dry-run: no files written; ' : '') + 'overlap manifest: ' + summary.manifest + '\n');
    process.stdout.write('Successor key           : ' + summary.successor_key + ' (' + nextFingerprint + ')\n');
    process.stdout.write('Effective at            : ' + effectiveAt + ' (then run rotate again)\n');
    process.stdout.write('Grace until             : ' + graceUntil + '\n');
    process.stdout.write('DNS TXT                 : ' + summary.dns_txt + '\n');
    for (const warning of check.warnings) process.stdout.write('warning: [' + warning.code + '] ' + warning.message + '\n');
    for (const step of summary.next) process.stdout.write('next    : ' + step + '\n');
  }
  return 0;
}

async function runRotateCutover(dir, args, manifest, dryRun) {
  const directive = manifest.rotation;
  if (!directive || typeof directive.successor_fp !== 'string') {
    return fail('manifest does not carry a successor rotation directive', 1);
  }

  const keyPath = args.key || path.join(dir, 'aifeed-private.next.pem');
  if (!fs.existsSync(keyPath)) return fail('successor key not found at ' + keyPath + ' (pass --key)');
  let nextKey;
  try {
    nextKey = nodeCrypto.createPrivateKey(fs.readFileSync(keyPath));
  } catch (error) {
    return fail('cannot load successor key: ' + error.message);
  }
  const nextPublicValue = cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(nextKey));
  const nextFingerprint = cryptoLib.fingerprintOf(nodeCrypto.createPublicKey(nextKey));
  if (nextFingerprint !== directive.successor_fp) {
    return fail('successor key does not match rotation.successor_fp (successor_key_mismatch)', 1);
  }

  const now = args.now ? new Date(args.now) : new Date();
  const effectiveAt = Date.parse(directive.effective_at);
  const early = !Number.isNaN(effectiveAt) && now.getTime() < effectiveAt;

  const cutover = JSON.parse(JSON.stringify(manifest));
  cutover.identity.public_key = nextPublicValue;
  cutover.validity.signed_at = isoSeconds(now);
  cutover.rotation = {
    predecessor_fp: cryptoLib.fingerprintOf(cryptoLib.decodePublicKey(manifest.identity.public_key)),
    supersedes_at: isoSeconds(now)
  };

  const check = validateLib.checkManifest(cutover, { domain: manifest.identity.domain, now });
  if (check.errors.length > 0) {
    return fail('cutover manifest failed validation: ' + check.errors.map((entry) => entry.code).join(', '), 1);
  }

  let written = { manifestPath: path.join(dir, 'ai.json'), signaturePath: path.join(dir, 'ai-signature.json') };
  if (!dryRun) {
    try {
      written = writeSignedManifest(dir, cutover, nextKey);
    } catch (error) {
      return fail('cannot write cutover manifest: ' + error.message);
    }
  }

  const domain = manifest.identity.domain;
  const expiresAt = Date.parse(cutover.validity.expires_at);
  const expiryWarning = !Number.isNaN(expiresAt) && expiresAt <= now.getTime()
    ? 'validity.expires_at is in the past; extend it and re-run cutover'
    : null;
  const summary = {
    action: 'cutover',
    phase: 'cutover',
    dry_run: dryRun,
    manifest: written.manifestPath,
    signature: written.signaturePath,
    signing_key: nextFingerprint,
    predecessor_fp: cutover.rotation.predecessor_fp,
    early,
    dns_txt: dnsTxtLine(domain, ['pk=' + nextPublicValue, 'fp=' + nextFingerprint]),
    expiry_warning: expiryWarning,
    next: [
      'switch the DNS TXT record to pk=' + nextPublicValue + ' and remove pk2',
      'publish ' + cutover.rotation.predecessor_fp + ' in the revocation registry (governance signatures)',
      'verify from outside: aifeed validate ' + domain
    ]
  };
  if (args.json) {
    printJson(summary);
  } else {
    process.stdout.write((dryRun ? 'dry-run: no files written; ' : '') + 'cutover manifest: ' + summary.manifest + '\n');
    process.stdout.write('Signing key             : ' + nextFingerprint + '\n');
    if (early) process.stdout.write('warning : cutover ran before effective_at; pin-learning clients may need a refresh\n');
    if (expiryWarning) process.stdout.write('warning : ' + expiryWarning + '\n');
    process.stdout.write('DNS TXT                 : ' + summary.dns_txt + '\n');
    for (const step of summary.next) process.stdout.write('next    : ' + step + '\n');
  }
  return 0;
}

async function runRotate(args) {
  const dir = args.dir || args._[0] || '.';
  const dryRun = Boolean(args['dry-run']);
  let loaded;
  try {
    loaded = loadManifestFile(dir);
  } catch (error) {
    return fail('cannot read manifest: ' + error.message);
  }
  const manifest = loaded.manifest;
  if (cryptoLib.manifestFamily(manifest.version) !== '0.2') {
    return fail('rotation requires a v0.2 manifest (set "version": "0.2" and re-sign first)', 1);
  }
  const directive = manifest.rotation || null;
  if (!directive) return runRotatePrepare(dir, args, manifest, dryRun);
  if (typeof directive.successor_fp === 'string') return runRotateCutover(dir, args, manifest, dryRun);

  const now = args.now ? new Date(args.now) : new Date();
  const state = rotationLib.validateDirective(manifest, now);
  const summary = {
    action: 'complete',
    phase: state.phase,
    domain: manifest.identity.domain,
    predecessor_fp: directive.predecessor_fp,
    errors: state.errors,
    warnings: state.warnings,
    next: [
      'publish ' + directive.predecessor_fp + ' in the revocation registry if not done',
      'renew the manifest before validity.expires_at'
    ]
  };
  if (args.json) {
    printJson(summary);
  } else {
    process.stdout.write('Rotation: complete (predecessor ' + directive.predecessor_fp + ')\n');
    for (const entry of state.errors) process.stdout.write('error  : [' + entry.code + '] ' + entry.message + '\n');
    for (const entry of state.warnings) process.stdout.write('warning: [' + entry.code + '] ' + entry.message + '\n');
    for (const step of summary.next) process.stdout.write('next    : ' + step + '\n');
  }
  return state.errors.length === 0 ? 0 : 1;
}

async function runValidateRemote(target, args, result) {
  result.result = 'UNVERIFIED';
  const domain = validateLib.normalizeDomain(target);
  if (!domain) {
    collectRemoteErrors(result, [{ code: 'invalid_domain', message: 'cannot normalize domain: ' + target }]);
    return;
  }

  let manifestResponse;
  try {
    manifestResponse = await remote.fetchText('https://' + domain + '/.well-known/ai.json', { maxBytes: 100 * 1024 });
  } catch (error) {
    collectRemoteErrors(result, [{ code: error.code || 'network_error', message: error.message }]);
    return;
  }

  const manifestBytes = manifestResponse.buffer || Buffer.from(manifestResponse.text, 'utf8');
  const manifestDigestHeader = manifestResponse.headers['content-digest'];
  if (manifestDigestHeader) {
    const digestCheck = verifyContentDigest(manifestDigestHeader, manifestBytes);
    if (!digestCheck.ok) collectRemoteErrors(result, digestCheck.errors);
  } else {
    result.warnings.push({ code: 'content_digest_absent', message: 'ai.json response has no Content-Digest header' });
  }

  let manifest = null;
  try {
    manifest = parseStrict(manifestResponse.text, { integersOnly: true, maxDepth: 10, requireNFC: true });
  } catch (error) {
    collectRemoteErrors(result, [{ code: error.code || 'parse_error', message: error.message }]);
    return;
  }

  const signatureUrl = new URL(manifest.identity && manifest.identity.signature_url ? manifest.identity.signature_url : '/.well-known/ai-signature.json', 'https://' + domain).toString();
  let signatureResponse;
  try {
    signatureResponse = await remote.fetchText(signatureUrl, { maxBytes: 2 * 1024 });
  } catch (error) {
    collectRemoteErrors(result, [{ code: error.code || 'network_error', message: error.message }]);
    return;
  }

  const signatureDigestHeader = signatureResponse.headers['content-digest'];
  if (signatureDigestHeader) {
    const digestCheck = verifyContentDigest(
      signatureDigestHeader,
      signatureResponse.buffer || Buffer.from(signatureResponse.text, 'utf8')
    );
    if (!digestCheck.ok) collectRemoteErrors(result, digestCheck.errors);
  }

  let txtRecords = [];
  try {
    txtRecords = await remote.lookupAifeedTxt(domain);
  } catch (error) {
    result.warnings.push({ code: 'dns_lookup_failed', message: error.message });
  }
  if (txtRecords.length > 0) {
    const aifeedRecords = txtRecords.filter((entry) => entry.v === 'aifeed1');
    const usableRecords = aifeedRecords.length > 0 ? aifeedRecords : txtRecords;
    const distinctKeys = new Set(usableRecords.map((entry) => entry.pk).filter(Boolean));
    if (distinctKeys.size > 1) {
      collectRemoteErrors(result, [{ code: 'dns_mismatch', message: 'multiple _aifeed TXT records with different public keys' }]);
    } else {
      const record = usableRecords[0];
      const pkMatches = record.pk === manifest.identity.public_key;
      let fpMatches = true;
      if (typeof record.fp === 'string' && record.fp.length > 0) {
        try {
          fpMatches = record.fp === cryptoLib.fingerprintOf(cryptoLib.decodePublicKey(manifest.identity.public_key));
        } catch (error) {
          fpMatches = false;
        }
      }
      if (!pkMatches) {
        collectRemoteErrors(result, [{ code: 'dns_mismatch', message: 'DNS TXT public key does not match manifest' }]);
      } else if (!fpMatches) {
        collectRemoteErrors(result, [{ code: 'dns_mismatch', message: 'DNS TXT fingerprint does not match manifest public key' }]);
      } else {
        result.dns_anchored = true;
        result.warnings.push(...rotationLib.evaluateAnchor(manifest, record).warnings);
      }
    }
  } else {
    result.dns_anchored = false;
    result.warnings.push({ code: 'dns_not_anchored', message: 'no _aifeed DNS TXT record found' });
    result.warnings.push(...rotationLib.evaluateAnchor(manifest, {}).warnings);
  }

  const now = args.now ? new Date(args.now) : new Date();
  const verified = validateLib.verifyAll({
    manifestText: manifestResponse.text,
    signatureText: signatureResponse.text,
    domain,
    now
  });
  result.result = verified.result;
  result.errors.push(...verified.errors);
  result.warnings.push(...verified.warnings);

  if (manifest.rotation) {
    const rotationState = rotationLib.validateDirective(manifest, now);
    result.rotation = {
      phase: rotationState.phase,
      successor_fp: manifest.rotation.successor_fp || null,
      predecessor_fp: manifest.rotation.predecessor_fp || null,
      effective_at: manifest.rotation.effective_at || null,
      grace_until: manifest.rotation.grace_until || null
    };
  }

  if (args['revocation-url']) {
    try {
      const revocation = await remote.fetchText(args['revocation-url'], { maxBytes: 16 * 1024 });
      let governanceKeys = [];
      if (args['governance-key']) {
        governanceKeys = fs.readFileSync(args['governance-key'], 'utf8')
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('ed25519:'));
      }
      let manifestFingerprint = null;
      try {
        manifestFingerprint = cryptoLib.fingerprintOf(cryptoLib.decodePublicKey(manifest.identity.public_key));
      } catch (error) {
        manifestFingerprint = null;
      }
      const revocationResult = revocationLib.verifyRevocationDocument(revocation.text, { domain, now, governanceKeys, keyFingerprint: manifestFingerprint });
      result.revocation = revocationResult;
      result.warnings.push(...revocationResult.warnings);
      if (revocationResult.errors.length > 0) {
        collectRemoteErrors(result, revocationResult.errors);
        if (revocationResult.errors.some((entry) => entry.code === 'key_revoked') && result.result === 'VERIFIED') {
          result.result = 'UNVERIFIED';
        }
      } else if (revocationResult.status === 'suspended') {
        result.result = 'SUSPENDED';
      } else if (revocationResult.status === 'under_review' && result.result === 'VERIFIED') {
        result.result = 'UNVERIFIED';
        result.errors.push({ code: 'under_review', message: 'registry status is under_review' });
      }
    } catch (error) {
      result.warnings.push({ code: 'revocation_unavailable', message: error.message });
    }
  } else {
    result.warnings.push({ code: 'revocation_check_skipped', message: 'no --revocation-url provided' });
  }
}

async function runValidate(args) {
  const target = args._[0];
  if (!target) return usage();

  const exists = fs.existsSync(target);
  const looksLikeDomain = !exists && target.includes('.') && !target.includes(path.sep) && !target.endsWith('.json');

  const result = {
    target,
    result: null,
    dns_anchored: null,
    errors: [],
    warnings: []
  };

  if (looksLikeDomain) {
    if (args['no-network']) return fail('--no-network set but target is a remote domain');
    await runValidateRemote(target, args, result);
  } else {
    try {
      const verified = validateLib.verifyDirectory(target, {
        domain: args.domain,
        now: args.now ? new Date(args.now) : new Date()
      });
      result.result = verified.result;
      result.errors.push(...verified.errors);
      result.warnings.push(...verified.warnings);
    } catch (error) {
      return fail('cannot validate local target: ' + error.message);
    }
  }

  if (args['require-dns-anchor'] && result.dns_anchored !== true) {
    if (result.result === 'VERIFIED') result.result = 'UNVERIFIED';
    result.errors.push({
      code: 'dns_anchor_required_or_unavailable',
      message: 'dns_anchored=true is required for high-risk actions but was not established'
    });
  }

  if (args.json) {
    printJson(result);
  } else {
    process.stdout.write('Result     : ' + (result.result || 'UNVERIFIED') + '\n');
    process.stdout.write('Target     : ' + target + '\n');
    if (result.dns_anchored !== null) process.stdout.write('DNS anchor : ' + result.dns_anchored + '\n');
    process.stdout.write('Errors     : ' + (result.errors.length === 0 ? 'none' : '') + '\n');
    for (const error of result.errors) process.stdout.write('  - [' + error.code + '] ' + error.message + '\n');
    process.stdout.write('Warnings   : ' + (result.warnings.length === 0 ? 'none' : '') + '\n');
    for (const warning of result.warnings) process.stdout.write('  - [' + warning.code + '] ' + warning.message + '\n');
  }

  process.exitCode = result.result === 'VERIFIED' ? 0 : 1;
  return process.exitCode;
}

function runBundle(args) {
  const subcommand = args._[0];
  if (subcommand === 'create') {
    const sourceDir = args._[1];
    if (!sourceDir || !args.out || !args.domain) {
      process.stderr.write('usage: aifeed bundle create <sourceDir> --out <bundleDir> --domain <domain> [--key FILE] [--key-id ID] [--revocation FILE]\n');
      return 2;
    }
    let privateKey = null;
    if (args.key) {
      try {
        privateKey = nodeCrypto.createPrivateKey(fs.readFileSync(args.key));
      } catch (error) {
        return fail('cannot load bundler key: ' + error.message);
      }
    }
    try {
      const manifest = bundleLib.createBundle({
        sourceDir,
        outDir: args.out,
        domain: args.domain,
        privateKey,
        keyId: args['key-id'] || null,
        revocationFile: args.revocation || null
      });
      printJson({
        bundle: args.out,
        domain: manifest.domain,
        files: manifest.files.length,
        signed: Boolean(manifest.bundler)
      });
      return 0;
    } catch (error) {
      return fail('bundle create failed: ' + error.message);
    }
  }
  if (subcommand === 'verify') {
    const bundleDir = args._[1];
    if (!bundleDir) {
      process.stderr.write('usage: aifeed bundle verify <bundleDir> [--bundler-key FILE] [--json] [--now ISO]\n');
      return 2;
    }
    let bundlerPublicKeyValue = null;
    if (args['bundler-key']) {
      try {
        bundlerPublicKeyValue = fs.readFileSync(args['bundler-key'], 'utf8').split('\n')[0].trim();
      } catch (error) {
        return fail('cannot read bundler key: ' + error.message);
      }
    }
    const result = bundleLib.verifyBundle({
      bundleDir,
      now: args.now ? new Date(args.now) : new Date(),
      bundlerPublicKeyValue
    });

    if (args.json) {
      printJson(result);
    } else {
      process.stdout.write('Result     : ' + result.result + '\n');
      process.stdout.write('Files      : ' + result.files + '\n');
      process.stdout.write('Created at : ' + result.created_at + ' (age ' + result.age_hours + ' h)\n');
      process.stdout.write('Errors     : ' + (result.errors.length === 0 ? 'none' : '') + '\n');
      for (const error of result.errors) process.stdout.write('  - [' + error.code + '] ' + error.message + '\n');
      process.stdout.write('Warnings   : ' + (result.warnings.length === 0 ? 'none' : '') + '\n');
      for (const warning of result.warnings) process.stdout.write('  - [' + warning.code + '] ' + warning.message + '\n');
    }
    process.exitCode = result.result === 'VERIFIED' ? 0 : 1;
    return process.exitCode;
  }
  process.stderr.write('usage: aifeed bundle create|verify ...\n');
  return 2;
}

function runInit(args) {
  const dir = args.dir || args._[0] || '.';
  const domain = args.domain;
  if (!domain) {
    return fail('--domain is required, e.g. aifeed init --domain example.com --profile news');
  }
  const profile = args.profile || 'blog';
  if (!Object.prototype.hasOwnProperty.call(scaffoldLib.PROFILES, profile)) {
    return fail('unknown profile "' + profile + '"; choose one of: ' + Object.keys(scaffoldLib.PROFILES).join(', '));
  }
  try {
    const summary = scaffoldLib.initSite({
      dir,
      domain,
      profile,
      name: args.name,
      organization: args.organization,
      contact: args.contact,
      locale: args.locale,
      keyId: args['key-id'],
      force: Boolean(args.force)
    });
    printJson({ ...summary, next: 'Read ' + summary.setupPath + ' for DNS + server instructions' });
    return 0;
  } catch (error) {
    return fail(error.message);
  }
}

function runImportOpenApi(args) {
  const specPath = args._[0];
  if (!specPath) {
    return fail('usage: aifeed import-openapi <openapi.json> [--out FILE]');
  }
  let specification;
  try {
    specification = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  } catch (error) {
    return fail('cannot read OpenAPI spec: ' + error.message);
  }
  const result = openapiLib.importOpenApi(specification);
  const json = JSON.stringify(result.fragment, null, 2) + '\n';
  for (const warning of result.warnings.slice(0, 25)) {
    process.stderr.write('warning: ' + warning + '\n');
  }
  if (args.out) {
    fs.writeFileSync(args.out, json);
    printJson({ out: args.out, ...result.stats });
  } else {
    process.stdout.write(json);
  }
  return 0;
}

function loadPublicKeyValue(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  const first = text.split(/\r?\n/)[0].trim();
  if (first.startsWith('ed25519:')) return first;
  if (text.includes('BEGIN')) {
    const privateKey = nodeCrypto.createPrivateKey(text);
    return cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(privateKey));
  }
  const error = new Error('cannot read a public key from ' + filePath);
  error.code = 'key_unreadable';
  throw error;
}

function loadManifestPublicKey(manifestPath) {
  const manifest = parseStrict(fs.readFileSync(manifestPath, 'utf8'), { integersOnly: true, maxDepth: 10, requireNFC: true });
  if (!manifest.identity || typeof manifest.identity.public_key !== 'string') {
    const error = new Error('manifest has no identity.public_key');
    error.code = 'manifest_invalid';
    throw error;
  }
  return manifest.identity.public_key;
}

function collectFiles(dir, suffix) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, suffix));
    } else if (entry.name.endsWith(suffix)) {
      results.push(full);
    }
  }
  return results;
}

function profileFromArgs(args) {
  if (args.format === 'aimd') return 'aimd';
  if (args.format === 'both') return 'both';
  return 'mako';
}

function extensionForProfile(profile) {
  return profile === 'aimd' || profile === 'both' ? '.aifeed.md' : '.mako.md';
}

function runMakoGenerate(args) {
  const input = args._[1];
  if (!input) return fail('usage: aifeed mako generate <html|DIR> [--out PATH] [--format mako|aimd|both] [options]');

  const options = {
    type: args.type,
    entity: args.entity,
    updated: args.updated,
    language: args.language,
    summary: args.summary,
    canonical: args.url,
    profile: profileFromArgs(args)
  };
  const outputExtension = extensionForProfile(options.profile);
  if (args['max-tokens']) {
    const parsed = parseInt(args['max-tokens'], 10);
    if (!Number.isFinite(parsed) || parsed < 32) return fail('--max-tokens must be a number >= 32');
    options.maxTokens = parsed;
  }
  if (args.aifeed) {
    try {
      options.aifeed = JSON.parse(fs.readFileSync(args.aifeed, 'utf8'));
    } catch (error) {
      return fail('cannot read --aifeed JSON: ' + error.message);
    }
  }
  if (args.alternates) {
    try {
      const alternates = JSON.parse(fs.readFileSync(args.alternates, 'utf8'));
      if (!Array.isArray(alternates)) return fail('--alternates JSON must be an array of { url, lang }');
      options.alternates = alternates;
    } catch (error) {
      return fail('cannot read --alternates JSON: ' + error.message);
    }
  }

  let stat;
  try {
    stat = fs.statSync(input);
  } catch (error) {
    return fail('cannot read input: ' + error.message);
  }

  const outputs = [];
  const warnings = [];
  const targets = [];
  if (stat.isDirectory()) {
    for (const file of collectFiles(input, '.mako.md')) {
      targets.push(file);
    }
    for (const file of collectFiles(input, '.aifeed.md')) {
      targets.push(file);
    }
    for (const file of fs.readdirSync(input, { withFileTypes: true })) {
      const full = path.join(input, file.name);
      if (file.isDirectory()) {
        for (const nested of collectFiles(full, '.html')) targets.push(nested);
        for (const nested of collectFiles(full, '.htm')) targets.push(nested);
      } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        targets.push(full);
      }
    }
  } else {
    targets.push(input);
  }

  if (targets.length === 0) return fail('no HTML files found in ' + input);

  if (args.out && targets.length > 1 && args.out.endsWith('.mako.md')) {
    return fail('--out must be a directory when generating multiple files');
  }
  if (args.out && !args.out.endsWith('.mako.md') && !args.out.endsWith('.aifeed.md')) {
    let outStat = null;
    try {
      outStat = fs.statSync(args.out);
    } catch (error) {
      outStat = null;
    }
    if (outStat && !outStat.isDirectory()) {
      return fail('refusing to overwrite non-MAKO file: --out must be a directory or end with .mako.md (' + args.out + ')');
    }
  }

  for (const file of targets) {
    const html = fs.readFileSync(file, 'utf8');
    const converted = makoHtmlLib.htmlToMako(html, options);
    for (const warning of converted.warnings) {
      warnings.push({ file, ...warning });
    }
    let outPath;
    if (args.out && targets.length === 1 && (args.out.endsWith('.mako.md') || args.out.endsWith('.aifeed.md'))) {
      outPath = args.out;
    } else {
      const outDir = args.out || path.dirname(file);
      try {
        fs.mkdirSync(outDir, { recursive: true });
      } catch (error) {
        return fail('cannot create output directory ' + outDir + ': ' + error.message);
      }
      const base = path.basename(file).replace(/\.html?$/i, '');
      outPath = path.join(outDir, base + outputExtension);
    }
    if (fs.existsSync(outPath) && !outPath.endsWith('.mako.md') && !outPath.endsWith('.aifeed.md')) {
      return fail('refusing to overwrite non-content file: ' + outPath, 1);
    }
    fs.writeFileSync(outPath, converted.text, 'utf8');
    outputs.push({
      source: file,
      out: outPath,
      entity: converted.frontmatter.entity,
      tokens: converted.frontmatter.tokens,
      type: converted.frontmatter.type
    });
  }

  printJson({ generated: outputs, warnings });
  return 0;
}

function runMakoSign(args) {
  const file = args._[1];
  const url = args.url;
  if (!file || !url) return fail('usage: aifeed mako sign <file.mako.md> --url URL [--key FILE] [--out PATH]');

  const bytes = fs.readFileSync(file);
  const parsed = makoLib.parseFrontmatter(bytes);
  if (!parsed.ok) {
    for (const error of parsed.errors) process.stderr.write('frontmatter: [' + error.code + '] ' + error.message + '\n');
    return fail('content frontmatter is invalid', 1);
  }
  const profile = makoLib.documentProfile(parsed.frontmatter);
  if (!profile) {
    return fail('document carries neither an "aimd" nor a "mako" version marker', 1);
  }
  const fieldErrors = makoLib.validateDocumentFields(parsed.frontmatter, profile);
  if (fieldErrors.length > 0) {
    for (const error of fieldErrors) process.stderr.write('frontmatter: [' + error.code + '] ' + error.message + '\n');
    return fail('content frontmatter is invalid', 1);
  }

  const keyPath = args.key || path.join(path.dirname(file), 'aifeed-private.pem');
  let privateKey;
  try {
    privateKey = nodeCrypto.createPrivateKey(fs.readFileSync(keyPath));
  } catch (error) {
    return fail('cannot load private key: ' + error.message);
  }

  const signedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const container = makoLib.signMakoContainer(privateKey, url, bytes, { context: profile, signedAt });
  const publicKey = nodeCrypto.createPublicKey(privateKey);
  const check = makoLib.verifyMakoContainer({
    containerText: JSON.stringify(container),
    pageUrl: url,
    bodyBytes: bytes,
    publicKey,
    context: profile
  });
  if (!check.ok) return fail('self-verification failed before writing output', 1);

  const outPath = args.out || file + '.sig';
  fs.writeFileSync(outPath, JSON.stringify(container, null, 2) + '\n', 'utf8');
  printJson({
    file,
    signature: outPath,
    url,
    profile,
    key_fingerprint: container.key_fingerprint,
    result: 'signed'
  });
  return 0;
}

function runMakoVerify(args) {
  const file = args._[1];
  const url = args.url;
  if (!file || !url) return fail('usage: aifeed mako verify <file.mako.md> --url URL [--key FILE|--manifest ai.json] [--signature FILE] [--json]');

  const bytes = fs.readFileSync(file);
  const errors = [];
  const warnings = [];
  const parsed = makoLib.parseFrontmatter(bytes);
  errors.push(...parsed.errors);
  let frontmatter = null;
  let profile = args.profile === 'aimd' ? 'aimd' : args.profile === 'mako' ? 'mako' : null;
  if (parsed.ok) {
    frontmatter = parsed.frontmatter;
    profile = profile || makoLib.documentProfile(frontmatter) || 'mako';
    errors.push(...makoLib.validateDocumentFields(frontmatter, profile));
  }
  profile = profile || 'mako';

  let publicKeyValue = null;
  try {
    if (args.manifest) {
      publicKeyValue = loadManifestPublicKey(args.manifest);
    } else if (args.key) {
      publicKeyValue = loadPublicKeyValue(args.key);
    }
  } catch (error) {
    return fail(error.message);
  }

  const signaturePath = args.signature || file + '.sig';
  let containerText;
  if (fs.existsSync(signaturePath)) {
    containerText = fs.readFileSync(signaturePath, 'utf8');
  } else if (!args['allow-unsigned']) {
    errors.push({ code: 'mako_signature_missing', message: 'no signature found at ' + signaturePath });
  }

  let makoVerified = false;
  if (containerText !== undefined) {
    if (!publicKeyValue) {
      return fail('verification requires --key <public key file> or --manifest <ai.json>');
    }
    const result = makoLib.verifyMakoContainer({
      containerText,
      pageUrl: url,
      bodyBytes: bytes,
      publicKey: cryptoLib.decodePublicKey(publicKeyValue),
      context: profile
    });
    makoVerified = result.ok;
    errors.push(...result.errors);
  }

  const output = {
    file,
    url,
    profile,
    mako_verified: makoVerified,
    frontmatter: frontmatter
      ? { mako: frontmatter.mako, type: frontmatter.type, entity: frontmatter.entity, updated: frontmatter.updated, tokens: frontmatter.tokens }
      : null,
    errors,
    warnings
  };
  if (args.json) {
    printJson(output);
  } else {
    process.stdout.write('Result     : ' + (makoVerified && errors.length === 0 ? 'VERIFIED' : 'UNVERIFIED') + '\n');
    process.stdout.write('File       : ' + file + '\n');
    process.stdout.write('URL        : ' + url + '\n');
    process.stdout.write('Errors     : ' + (errors.length === 0 ? 'none' : '') + '\n');
    for (const error of errors) process.stdout.write('  - [' + error.code + '] ' + error.message + '\n');
    process.stdout.write('Warnings   : ' + (warnings.length === 0 ? 'none' : '') + '\n');
    for (const warning of warnings) process.stdout.write('  - [' + warning.code + '] ' + warning.message + '\n');
  }
  process.exitCode = makoVerified && errors.length === 0 ? 0 : 1;
  return process.exitCode;
}

function runMakoIndex(args) {
  const dir = args._[1];
  if (!dir) return fail('usage: aifeed mako index <DIR> (--domain D|--base-url URL) [--out FILE] [--sign --key FILE]');
  const baseUrl = args['base-url'] || (args.domain ? 'https://' + args.domain : null);
  if (!baseUrl) return fail('--domain or --base-url is required');

  let host;
  try {
    host = new URL(baseUrl).host;
  } catch (error) {
    return fail('invalid --base-url: ' + error.message);
  }

  const files = [...collectFiles(dir, '.mako.md'), ...collectFiles(dir, '.aifeed.md')];
  if (files.length === 0) return fail('no .mako.md or .aifeed.md files found in ' + dir);

  let site = null;
  if (args.manifest) {
    try {
      const manifest = parseStrict(fs.readFileSync(args.manifest, 'utf8'), { integersOnly: true, maxDepth: 10, requireNFC: true });
      site = {
        name: manifest.identity.name,
        type: manifest.identity.type,
        languages: manifest.content.languages
      };
      if (manifest.content.license && manifest.content.license.name) {
        site.license = manifest.content.license.name;
      }
    } catch (error) {
      return fail('cannot read --manifest: ' + error.message);
    }
  }
  if (args.name) site = { ...(site || {}), name: args.name };
  if (args.description) site = { ...(site || {}), description: args.description };
  if (args.license) site = { ...(site || {}), license: args.license };
  if (site) site.updated_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const entries = [];
  const warnings = [];
  for (const file of files) {
    const bytes = fs.readFileSync(file);
    const relative = path.relative(dir, file).split(path.sep).join('/');
    const extension = file.endsWith('.aifeed.md') ? '.aifeed.md' : '.mako.md';
    const url = '/' + relative.slice(0, -extension.length);
    const digest = sha256Base64(bytes);
    const parsed = makoLib.parseFrontmatter(bytes);
    if (!parsed.ok) {
      warnings.push({ code: 'mako_invalid_skipped', file, message: parsed.errors.map((item) => item.code).join(',') });
      continue;
    }
    const frontmatter = parsed.frontmatter;
    const entry = {
      url,
      type: frontmatter.type || 'custom',
      tokens: frontmatter.tokens || makoHtmlLib.estimateTokens(parsed.body),
      updated: typeof frontmatter.updated === 'string' ? frontmatter.updated : new Date().toISOString().slice(0, 10),
      etag: '"mako-' + digest.slice(0, 22).replace(/[+/=]/g, '') + '"',
      'sha-256': digest
    };
    if (typeof frontmatter.entity === 'string' && frontmatter.entity !== '') {
      entry.title = frontmatter.entity.slice(0, 500);
    }
    if (typeof frontmatter.summary === 'string' && frontmatter.summary !== '') {
      entry.summary = frontmatter.summary.slice(0, 160);
    }
    if (Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0) {
      entry.tags = frontmatter.tags.slice(0, 10);
    }
    if (typeof frontmatter.language === 'string') {
      entry.lang = frontmatter.language;
    }
    if (Array.isArray(frontmatter.related) && frontmatter.related.length > 0) {
      entry.related = frontmatter.related.slice(0, 20);
    }
    entries.push(entry);
  }
  if (entries.length === 0) return fail('no valid .mako.md files found in ' + dir);
  entries.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));

  const index = {
    version: '0.2',
    domain: host,
    ...(site ? { site } : {}),
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    page: 1,
    page_count: 1,
    entries
  };
  const indexProfile = profileFromArgs(args) === 'aimd' ? 'aimd' : 'mako';
  const defaultIndexName = indexProfile === 'aimd' ? 'aifeed-index.json' : 'mako-index.json';
  const outPath = args.out || path.join(dir, defaultIndexName);
  const indexText = JSON.stringify(index, null, 2) + '\n';
  fs.writeFileSync(outPath, indexText, 'utf8');

  const summary = { index: outPath, entries: entries.length, warnings, signed: false };
  if (args.sign) {
    const keyPath = args.key || path.join(dir, 'aifeed-private.pem');
    let privateKey;
    try {
      privateKey = nodeCrypto.createPrivateKey(fs.readFileSync(keyPath));
    } catch (error) {
      return fail('cannot load private key: ' + error.message);
    }
    const indexUrl = args['index-url'] || new URL(path.basename(outPath), baseUrl.endsWith('/') ? baseUrl : baseUrl + '/').toString();
    const container = makoLib.signMakoContainer(privateKey, indexUrl, Buffer.from(indexText, 'utf8'), {
      context: indexProfile === 'aimd' ? 'aimd-index' : 'mako-index',
      signedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    });
    fs.writeFileSync(outPath + '.sig', JSON.stringify(container, null, 2) + '\n', 'utf8');
    summary.signed = true;
    summary.signature = outPath + '.sig';
    summary.index_url = indexUrl;
  }

  printJson(summary);
  return 0;
}

async function runMakoFetch(args) {
  const url = args._[1];
  if (!url) return fail('usage: aifeed mako fetch <URL> [--format mako|aimd|both] [--key FILE] [--out FILE] [--json]');

  const profile = profileFromArgs(args);
  const mediaType = profile === 'aimd' ? makoLib.AIMD_MEDIA_TYPE : makoLib.MAKO_MEDIA_TYPE;
  const accept = profile === 'both' ? makoLib.AIMD_MEDIA_TYPE + ', ' + makoLib.MAKO_MEDIA_TYPE : mediaType;
  const allowedContentTypes = profile === 'both'
    ? [makoLib.AIMD_MEDIA_TYPE, makoLib.MAKO_MEDIA_TYPE, 'text/html']
    : [mediaType, 'text/html'];

  let response;
  try {
    response = await remote.fetchText(url, {
      accept,
      allowedContentTypes,
      maxBytes: 256 * 1024,
      timeout: 15000
    });
  } catch (error) {
    return fail('fetch failed: ' + error.message, 1);
  }

  const contentType = String(response.headers['content-type'] || '');
  const servedProfile = contentType.includes(makoLib.AIMD_MEDIA_TYPE) ? 'aimd'
    : contentType.includes(makoLib.MAKO_MEDIA_TYPE) ? 'mako' : null;
  const output = {
    url,
    profile: servedProfile,
    content_type: contentType,
    mako: servedProfile !== null,
    bytes: response.buffer.length,
    mako_verified: false,
    errors: [],
    warnings: []
  };

  if (servedProfile === null) {
    output.warning = 'server returned HTML; no AIFeed Markdown/MAKO support via content negotiation';
    if (args.json) printJson(output);
    else process.stdout.write('AIFeed Markdown/MAKO : not served (content-type: ' + contentType + ')\n');
    process.exitCode = 1;
    return 1;
  }

  const parsed = makoLib.parseFrontmatter(response.buffer);
  output.errors.push(...parsed.errors);
  if (parsed.frontmatter !== null) {
    output.errors.push(...makoLib.validateDocumentFields(parsed.frontmatter, servedProfile));
  }
  output.tokens = parsed.frontmatter ? parsed.frontmatter.tokens : null;

  let containerText;
  const inline = response.headers['x-aifeed-signature'];
  if (typeof inline === 'string') {
    const inlineMatch = /^(?:mako1|aimd1):/.exec(inline);
    if (inlineMatch) {
      try {
        containerText = Buffer.from(inline.slice(inlineMatch[0].length), 'base64url').toString('utf8');
        parseStrict(containerText, { integersOnly: true, maxDepth: 10, requireNFC: true });
      } catch (error) {
        containerText = undefined;
        output.errors.push({ code: 'mako_container_malformed', message: 'inline signature header is not valid' });
      }
    } else {
      output.errors.push({ code: 'mako_container_malformed', message: 'unknown inline signature format' });
    }
  }
  if (containerText === undefined) {
    const signatureUrl = typeof response.headers['x-aifeed-signature-url'] === 'string'
      ? new URL(response.headers['x-aifeed-signature-url'], url).toString()
      : url + '.sig';
    try {
      const signatureResponse = await remote.fetchText(signatureUrl, {
        accept: 'application/json',
        allowedContentTypes: ['application/json'],
        maxBytes: 2 * 1024
      });
      containerText = signatureResponse.text;
    } catch (error) {
      output.warnings.push({ code: 'mako_signature_missing', message: 'no signature retrieved: ' + error.message });
    }
  }

  if (containerText !== undefined && args.key) {
    try {
      const publicKeyValue = loadPublicKeyValue(args.key);
      const result = makoLib.verifyMakoContainer({
        containerText,
        pageUrl: url,
        bodyBytes: response.buffer,
        publicKey: cryptoLib.decodePublicKey(publicKeyValue),
        context: servedProfile
      });
      output.mako_verified = result.ok;
      output.errors.push(...result.errors);
    } catch (error) {
      output.errors.push({ code: 'mako_manifest_key_invalid', message: error.message });
    }
  } else if (args.key === undefined) {
    output.warnings.push({ code: 'verification_skipped', message: 'no --key provided; signature not verified' });
  }

  if (args.out) {
    fs.writeFileSync(args.out, response.buffer);
    output.saved = args.out;
  }

  if (args.json) {
    printJson(output);
  } else {
    process.stdout.write('Profile    : ' + servedProfile + ' (' + response.buffer.length + ' bytes, ' + (output.tokens || '?') + ' tokens)\n');
    process.stdout.write('Verified   : ' + output.mako_verified + '\n');
    process.stdout.write('Errors     : ' + (output.errors.length === 0 ? 'none' : '') + '\n');
    for (const error of output.errors) process.stdout.write('  - [' + error.code + '] ' + error.message + '\n');
    process.stdout.write('Warnings   : ' + (output.warnings.length === 0 ? 'none' : '') + '\n');
    for (const warning of output.warnings) process.stdout.write('  - [' + warning.code + '] ' + warning.message + '\n');
  }
  process.exitCode = output.errors.length === 0 ? 0 : 1;
  return process.exitCode;
}

function runSite(args) {
  const subcommand = args._[0];
  if (subcommand !== 'build') {
    process.stderr.write('usage: aifeed site build <DIR> --domain D --key PRIVATE.pem [options]\n');
    return 2;
  }
  const dir = args._[1];
  const domain = args.domain;
  if (!dir) return fail('usage: aifeed site build <DIR> --domain D --key PRIVATE.pem [options]');
  if (!domain) return fail('--domain is required (e.g. --domain example.com)');
  const keyPath = args.key || path.join(dir, 'aifeed-private.pem');
  if (!fs.existsSync(keyPath)) return fail('private key not found at ' + keyPath + ' (run "aifeed keygen --out <dir>" first)');

  const locale = args.locale || 'en';
  const profile = args.profile === 'mako' || args.profile === 'both' ? args.profile : 'aimd';
  try {
    const summary = siteLib.buildSite({
      dir,
      domain,
      baseUrl: args['base-url'],
      name: args.name || domain,
      description: args.description,
      type: args.type || 'blog',
      locale,
      contact: args.contact || 'mailto:ai@' + domain,
      keyPath,
      keyId: args['key-id'] || 'site-key-1',
      profile,
      inject: Boolean(args.inject),
      llms: Boolean(args.llms),
      updated: args.updated
    });
    if (args.json) {
      printJson(summary);
    } else {
      process.stdout.write('Site      : ' + summary.dir + '\n');
      process.stdout.write('Profile   : ' + summary.profile + '\n');
      process.stdout.write('Pages     : ' + summary.pages.length + '\n');
      process.stdout.write('Manifest  : ' + summary.manifest + '\n');
      process.stdout.write('Index     : ' + summary.index + '\n');
      if (summary.llms) process.stdout.write('llms.txt  : ' + summary.llms + '\n');
      process.stdout.write('Key       : ' + summary.fingerprint + '\n');
      process.stdout.write('Warnings  : ' + (summary.warnings.length === 0 ? 'none' : '') + '\n');
      for (const warning of summary.warnings) process.stdout.write('  - [' + warning.code + '] ' + warning.file + ': ' + warning.message + '\n');
      process.stdout.write('\nNext: deploy the directory (including .well-known/ and *.aifeed.md) and see integrations/ for host configs.\n');
    }
    return 0;
  } catch (error) {
    return fail('site build failed: ' + error.message);
  }
}

async function runMako(args) {
  const subcommand = args._[0];
  if (subcommand === 'generate') return runMakoGenerate(args);
  if (subcommand === 'sign') return runMakoSign(args);
  if (subcommand === 'verify') return runMakoVerify(args);
  if (subcommand === 'index') return runMakoIndex(args);
  if (subcommand === 'fetch') return runMakoFetch(args);
  process.stderr.write('usage: aifeed mako generate|sign|verify|index|fetch ...\n');
  return 2;
}

async function main(argv) {
  const command = argv[0];
  const args = parseArgs(argv.slice(1));
  if (command === 'keygen') return runKeygen(args);
  if (command === 'sign') return runSign(args);
  if (command === 'rotate') return runRotate(args);
  if (command === 'validate') return runValidate(args);
  if (command === 'bundle') return runBundle(args);
  if (command === 'init') return runInit(args);
  if (command === 'import-openapi') return runImportOpenApi(args);
  if (command === 'site') return runSite(args);
  if (command === 'mako') return runMako(args);
  if (command === 'aimd') {
    if (args.format === undefined) args.format = 'aimd';
    return runMako(args);
  }
  if (command === 'version' || args.version) {
    process.stdout.write(VERSION + '\n');
    return 0;
  }
  return usage();
}

module.exports = { main, parseArgs, runKeygen, runSign, runRotate, runValidate, runBundle, runInit, runImportOpenApi, runMako, runSite };

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write('fatal: ' + error.stack + '\n');
    process.exitCode = 2;
  });
}
