#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const cryptoLib = require('../lib/crypto');
const bundleLib = require('../lib/bundle');
const { rawDigestOf } = require('../lib/digest');
const { verifyAll } = require('../lib/validate');

const ROOT = path.join(__dirname, '..');
const VECTOR_DIR = path.join(ROOT, 'conformance', 'vectors');
const FIXTURE_DIR = path.join(ROOT, 'conformance', 'fixtures');
const REVOCATION_DIR = path.join(ROOT, 'conformance', 'revocation');
const BUNDLE_NOW = new Date('2026-09-14T08:00:00Z');
const BUNDLE_CHECK_NOW = '2026-09-15T00:00:00Z';
const EXAMPLE_MAP = [
  ['news', 'examples/news/news.example.json', 'news.example'],
  ['ecommerce', 'examples/ecommerce/toko.example.json', 'toko.example'],
  ['blog', 'examples/blog/blog-minimal.example.json', 'catatan.example'],
  ['government', 'examples/government/gov.example.json', 'layanan.go.id.example'],
  ['saas', 'examples/saas/saas.example.json', 'api.example'],
  ['marketplace', 'examples/marketplace/marketplace.example.json', 'marketplace.example']
];

const SEED_PRIMARY = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const SEED_SECONDARY = '202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f';
const SEED_ROTATION = '404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f';

const NOW = '2026-10-01T00:00:00Z';
const DOMAIN = 'tokobuku.example';

function privateKeyFromSeed(seedHex) {
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const der = Buffer.concat([prefix, Buffer.from(seedHex, 'hex')]);
  return nodeCrypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

function publicKeyValue(privateKey) {
  return cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(privateKey));
}

function pretty(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function baseManifest(publicKey) {
  return {
    $schema: 'https://aifeed.md/schema/ai-json/v0.1.json',
    version: '0.1',
    identity: {
      domain: DOMAIN,
      name: 'Toko Buku Nusantara',
      organization: 'PT Toko Buku Nusantara',
      type: 'ecommerce',
      locale: 'id-ID',
      contact: 'mailto:admin@tokobuku.example',
      public_key: publicKey,
      key_id: 'tokobuku-2026-key1',
      signature_url: '/.well-known/ai-signature.json'
    },
    validity: {
      signed_at: '2026-09-14T08:00:00Z',
      expires_at: '2027-09-14T08:00:00Z'
    },
    content: {
      llms_txt: '/llms.txt',
      sitemap: '/sitemap.xml',
      markdown: { template: '/{path}.md', link_relation: true },
      languages: ['id', 'en'],
      license: {
        name: 'All Rights Reserved',
        url: 'https://tokobuku.example/license',
        rsl_url: 'https://tokobuku.example/rsl.xml'
      }
    },
    permissions: {
      default: 'deny',
      usage: {
        search: 'allow',
        retrieval: 'allow',
        input: 'allow',
        training: 'deny',
        quote: 'allow',
        summarize: 'allow',
        reproduce: 'deny',
        translate: 'allow',
        modify: 'deny',
        embed: 'deny',
        commercial_use: 'deny'
      },
      attribution: 'required',
      attribution_url: 'https://tokobuku.example/ai-attribution',
      attribution_text: 'Sumber: Toko Buku Nusantara (tokobuku.example)'
    },
    limits: {
      requests_per_minute: 60,
      concurrent: 2,
      crawl_delay_seconds: 1
    },
    types: {
      product: {
        type: 'object',
        required: ['id', 'name', 'price_idr'],
        properties: {
          id: { type: 'string', max_length: 64 },
          name: { type: 'string', max_length: 256 },
          price_idr: { type: 'integer', minimum: 0 },
          url: { type: 'string', format: 'uri-reference' }
        }
      }
    },
    capabilities: {
      search_products: {
        description: 'Cari produk berdasarkan kata kunci',
        endpoint: '/api/v1/search',
        method: 'GET',
        params: {
          q: { type: 'string', required: true, in: 'query', max_length: 128 },
          limit: { type: 'integer', required: false, in: 'query', default: 20, minimum: 1, maximum: 100 }
        },
        returns: { type: 'array', items_ref: 'product', max_items: 100 },
        auth_required: false
      }
    },
    actions: {
      purchase: {
        description: 'Beli produk',
        endpoint: '/api/v1/orders',
        method: 'POST',
        params: {
          product_id: { type: 'string', required: true, in: 'body', max_length: 64 },
          quantity: { type: 'integer', required: true, in: 'body', minimum: 1, maximum: 99 }
        },
        returns: { type: 'object', items_ref: 'product' },
        requires_auth: true,
        auth: { type: 'oauth2', documentation_url: 'https://tokobuku.example/api/docs' },
        payment_terms_url: 'https://tokobuku.example/payment-terms',
        human_confirmation_required: true,
        requires_idempotency_key: true,
        spending_limit: { amount: 1000000, currency: 'IDR' }
      }
    },
    revocation: {
      list_url: 'https://aifeed.md/revoke/v1/' + DOMAIN + '.json',
      maximum_check_interval_hours: 24
    },
    metadata: {
      generated_at: '2026-09-14T08:00:00Z',
      generated_by: 'aifeed-protocol/0.1.0'
    }
  };
}

function signContainer(manifest, privateKey, fileText, options = {}) {
  const signatureBytes = cryptoLib.signManifest(privateKey, manifest);
  const container = {
    algorithm: 'ed25519',
    canonicalization: 'jcs-rfc8785',
    signature: cryptoLib.encodeSignature(signatureBytes)
  };
  if (options.rawDigest !== false) {
    container.raw_digest = rawDigestOf(Buffer.from(fileText, 'utf8'));
  }
  return container;
}

function tamperSignature(container) {
  const bytes = Buffer.from(container.signature.slice('base64url:'.length), 'base64url');
  bytes[0] = bytes[0] ^ 0xff;
  return {
    algorithm: 'ed25519',
    canonicalization: 'jcs-rfc8785',
    signature: cryptoLib.encodeSignature(bytes)
  };
}

function writeCase(group, name, manifestText, signature, expected) {
  const dir = path.join(VECTOR_DIR, group, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ai.json'), manifestText.endsWith('\n') ? manifestText : manifestText + '\n');
  fs.writeFileSync(path.join(dir, 'ai-signature.json'), JSON.stringify(signature, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'expected.json'), JSON.stringify(expected, null, 2) + '\n');
}

function generateConformanceFixtures(primaryKey, secondaryKey) {
  const primaryPublic = publicKeyValue(primaryKey);
  const secondaryPublic = publicKeyValue(secondaryKey);

  for (const [name, relativePath, domain] of EXAMPLE_MAP) {
    const sourceText = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    const manifest = JSON.parse(sourceText);
    const targetDir = path.join(FIXTURE_DIR, 'examples', name);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'ai.json'), sourceText);
    fs.writeFileSync(
      path.join(targetDir, 'ai-signature.json'),
      JSON.stringify(signContainer(manifest, primaryKey, sourceText), null, 2) + '\n'
    );
    fs.writeFileSync(
      path.join(targetDir, 'expected.json'),
      JSON.stringify({ result: 'VERIFIED', domain, now: NOW, errors: [], warnings: [] }, null, 2) + '\n'
    );
  }

  const newsSourceDir = path.join(FIXTURE_DIR, 'examples', 'news');

  const unsignedBundleDir = path.join(FIXTURE_DIR, 'bundles', 'unsigned');
  bundleLib.createBundle({ sourceDir: newsSourceDir, outDir: unsignedBundleDir, domain: 'news.example', now: BUNDLE_NOW });
  fs.writeFileSync(
    path.join(unsignedBundleDir, 'expected.json'),
    JSON.stringify({ result: 'VERIFIED', now: BUNDLE_CHECK_NOW, warnings: ['bundle_unsigned'], bundler_public_key: null }, null, 2) + '\n'
  );

  const signedBundleDir = path.join(FIXTURE_DIR, 'bundles', 'signed');
  bundleLib.createBundle({
    sourceDir: newsSourceDir,
    outDir: signedBundleDir,
    domain: 'news.example',
    privateKey: secondaryKey,
    keyId: 'fixture-bundler-1',
    now: BUNDLE_NOW
  });
  fs.writeFileSync(path.join(signedBundleDir, 'bundler-public.txt'), secondaryPublic + '\n');
  fs.writeFileSync(
    path.join(signedBundleDir, 'expected.json'),
    JSON.stringify({ result: 'VERIFIED', now: BUNDLE_CHECK_NOW, warnings: [], bundler_public_key: secondaryPublic }, null, 2) + '\n'
  );

  const baseRevocation = () => ({
    version: '0.1',
    domain: 'tokobuku.example',
    status: 'active',
    reason: 'repeated_spam',
    reason_detail: 'fixture',
    effective_at: '2026-09-01T00:00:00Z',
    expires_at: '2026-12-01T00:00:00Z',
    revoked_by: 'aifeed-governance',
    appeal_url: 'https://aifeed.md/appeal?domain=tokobuku.example',
    keys: [{ fingerprint: 'sha256:xY3nQ7vK2mR8tL5pW1sB6dC0aF4gH9jK2mN3qS4uY0z' }]
  });

  const signRevocationWith = (document, privateKeys) => {
    const { signatures, ...signed } = document;
    return {
      ...signed,
      signatures: privateKeys.map((key) => ({
        algorithm: 'ed25519',
        key_id: 'fixture-governance',
        canonicalization: 'jcs-rfc8785',
        signature: cryptoLib.encodeSignature(cryptoLib.signRevocation(key, signed))
      }))
    };
  };

  const revocationCase = (name, document, expected) => {
    const targetDir = path.join(REVOCATION_DIR, name);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'revocation.json'), JSON.stringify(document, null, 2) + '\n');
    fs.writeFileSync(
      path.join(targetDir, 'expected.json'),
      JSON.stringify({
        domain: 'tokobuku.example',
        now: NOW,
        governance_keys: [primaryPublic, secondaryPublic],
        warnings: [],
        ...expected
      }, null, 2) + '\n'
    );
  };

  revocationCase('001-active-multisig', signRevocationWith(baseRevocation(), [primaryKey, secondaryKey]), {
    result: 'valid',
    status: 'active',
    errors: []
  });

  revocationCase('002-suspended-multisig', signRevocationWith({ ...baseRevocation(), status: 'suspended' }, [primaryKey, secondaryKey]), {
    result: 'valid',
    status: 'suspended',
    errors: []
  });

  revocationCase('003-single-signature', signRevocationWith(baseRevocation(), [primaryKey]), {
    result: 'invalid',
    status: 'active',
    errors: ['revocation_threshold_not_met']
  });

  revocationCase('004-unsigned', baseRevocation(), {
    result: 'invalid',
    status: 'active',
    errors: ['revocation_unsigned']
  });

  const tampered = signRevocationWith(baseRevocation(), [primaryKey, secondaryKey]);
  tampered.status = 'suspended';
  revocationCase('005-tampered-status', tampered, {
    result: 'invalid',
    status: 'suspended',
    errors: ['revocation_threshold_not_met']
  });

  return { primaryPublic, secondaryPublic };
}

function generate() {
  const primaryKey = privateKeyFromSeed(SEED_PRIMARY);
  const secondaryKey = privateKeyFromSeed(SEED_SECONDARY);
  const rotationKey = privateKeyFromSeed(SEED_ROTATION);
  const primaryPublic = publicKeyValue(primaryKey);
  const rotationPublic = publicKeyValue(rotationKey);
  const primaryFingerprint = cryptoLib.fingerprintOf(cryptoLib.decodePublicKey(primaryPublic));
  const rotationFingerprint = cryptoLib.fingerprintOf(cryptoLib.decodePublicKey(rotationPublic));

  const base = baseManifest(primaryPublic);
  const baseText = pretty(base);
  const baseSignature = signContainer(base, primaryKey, baseText);
  const baseSignatureNoRaw = signContainer(base, primaryKey, baseText, { rawDigest: false });

  writeCase('positive', '001-basic', baseText, baseSignature, {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: []
  });

  const extended = JSON.parse(baseText);
  extended.x_vendor = { registered_via: 'test-suite' };
  extended.permissions.usage.x_experimental_use = 'deny';
  writeCase('positive', '002-extension-fields', pretty(extended), signContainer(extended, primaryKey, pretty(extended)), {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: []
  });

  const patchVersion = JSON.parse(baseText);
  patchVersion.version = '0.1.2';
  writeCase('positive', '003-version-patch', pretty(patchVersion), signContainer(patchVersion, primaryKey, pretty(patchVersion)), {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: []
  });

  const mismatchedUrl = JSON.parse(baseText);
  mismatchedUrl.revocation.list_url = 'https://aifeed.md/revoke/v1/other.example.json';
  writeCase('positive', '004-revocation-url-warning', pretty(mismatchedUrl), signContainer(mismatchedUrl, primaryKey, pretty(mismatchedUrl)), {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: ['revocation_url_mismatch']
  });

  const cappedInterval = JSON.parse(baseText);
  cappedInterval.revocation.maximum_check_interval_hours = 200;
  writeCase('positive', '005-interval-capped-warning', pretty(cappedInterval), signContainer(cappedInterval, primaryKey, pretty(cappedInterval)), {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: ['check_interval_capped']
  });

  const v02 = JSON.parse(baseText);
  v02.$schema = 'https://aifeed.md/schema/ai-json/v0.2.json';
  v02.version = '0.2';
  v02.content.mako = {
    index_url: '/.well-known/mako-index.json',
    signature: 'optional',
    overrides: 'restrict-only'
  };
  v02.metadata.generated_by = 'aifeed-protocol/0.2.0';
  writeCase('positive', '007-v02-manifest', pretty(v02), signContainer(v02, primaryKey, pretty(v02)), {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: []
  });

  const rotationBase = () => JSON.parse(JSON.stringify(v02));

  const announced = rotationBase();
  announced.rotation = { successor_fp: rotationFingerprint, effective_at: '2026-10-05T00:00:00Z', grace_until: '2026-10-12T00:00:00Z' };
  writeCase('positive', '008-rotation-announced', pretty(announced), signContainer(announced, primaryKey, pretty(announced)), {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: []
  });

  const grace = rotationBase();
  grace.rotation = { successor_fp: rotationFingerprint, effective_at: '2026-09-20T00:00:00Z', grace_until: '2026-10-15T00:00:00Z' };
  writeCase('positive', '009-rotation-grace', pretty(grace), signContainer(grace, primaryKey, pretty(grace)), {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: ['grace_accepted']
  });

  const cutoverManifest = rotationBase();
  cutoverManifest.identity.public_key = rotationPublic;
  cutoverManifest.rotation = { predecessor_fp: primaryFingerprint, supersedes_at: '2026-09-14T08:00:00Z' };
  writeCase('positive', '010-rotation-cutover', pretty(cutoverManifest), signContainer(cutoverManifest, rotationKey, pretty(cutoverManifest)), {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: []
  });

  const emergency = rotationBase();
  emergency.rotation = { successor_fp: rotationFingerprint, effective_at: '2026-10-01T00:00:00Z', grace_until: '2026-10-01T06:00:00Z' };
  writeCase('positive', '011-rotation-emergency-window', pretty(emergency), signContainer(emergency, primaryKey, pretty(emergency)), {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: []
  });

  const reformatted = baseText.replace('{\n', '{\n   ');
  writeCase('positive', '006-reformatted-tolerated', reformatted, baseSignatureNoRaw, {
    result: 'VERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: [],
    warnings: []
  });

  writeCase('negative', '101-bad-signature', baseText, tamperSignature(baseSignature), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['bad_signature'],
    warnings: []
  });

  const expired = JSON.parse(baseText);
  expired.validity.signed_at = '2025-01-01T00:00:00Z';
  expired.validity.expires_at = '2026-01-01T00:00:00Z';
  writeCase('negative', '102-expired', pretty(expired), signContainer(expired, primaryKey, pretty(expired)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['expired'],
    warnings: []
  });

  writeCase('negative', '103-domain-mismatch', baseText, baseSignature, {
    result: 'UNVERIFIED',
    domain: 'other.example',
    now: NOW,
    errors: ['domain_mismatch'],
    warnings: []
  });

  const badVersion = JSON.parse(baseText);
  badVersion.version = '0.3';
  writeCase('negative', '104-version-invalid', pretty(badVersion), signContainer(badVersion, primaryKey, pretty(badVersion)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['upgrade_required'],
    warnings: []
  });

  const unknownField = JSON.parse(baseText);
  unknownField.foo = 1;
  writeCase('negative', '105-unknown-field', pretty(unknownField), signContainer(unknownField, primaryKey, pretty(unknownField)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['schema_violation'],
    warnings: []
  });

  const floatText = baseText.replace('"requests_per_minute": 60', '"requests_per_minute": 1.5');
  writeCase('negative', '106-float-rejected', floatText, baseSignatureNoRaw, {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['float_not_allowed'],
    warnings: []
  });

  const overflowText = baseText.replace('"amount": 1000000', '"amount": 9007199254740992');
  writeCase('negative', '107-integer-overflow', overflowText, baseSignatureNoRaw, {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['integer_out_of_range'],
    warnings: []
  });

  const duplicateText = baseText.replace('{\n  "$schema"', '{\n  "version": "0.1",\n  "$schema"');
  writeCase('negative', '108-duplicate-key', duplicateText, baseSignatureNoRaw, {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['duplicate_key'],
    warnings: []
  });

  const nfdText = baseText.replace('"name": "Toko Buku Nusantara"', '"name": "Cafe\u0301 Nusantara"');
  writeCase('negative', '109-nfd-string', nfdText, baseSignatureNoRaw, {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['not_nfc'],
    warnings: []
  });

  const missingDefault = JSON.parse(baseText);
  delete missingDefault.permissions.default;
  writeCase('negative', '110-missing-default', pretty(missingDefault), signContainer(missingDefault, primaryKey, pretty(missingDefault)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['schema_violation'],
    warnings: []
  });

  const badPk = JSON.parse(baseText);
  badPk.identity.public_key = 'ed25519:AAAA';
  writeCase('negative', '111-bad-public-key', pretty(badPk), baseSignatureNoRaw, {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['schema_violation'],
    warnings: []
  });

  const malformedSignature = {
    algorithm: 'ed25519',
    canonicalization: 'jcs-rfc8785',
    signature: 'base64url:AAAA'
  };
  writeCase('negative', '112-signature-malformed', baseText, malformedSignature, {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['signature_malformed'],
    warnings: []
  });

  const invalidRevocationUrl = JSON.parse(baseText);
  invalidRevocationUrl.revocation.list_url = 'https://evil.example/revoke.json';
  writeCase('negative', '113-revocation-url-invalid', pretty(invalidRevocationUrl), signContainer(invalidRevocationUrl, primaryKey, pretty(invalidRevocationUrl)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['schema_violation'],
    warnings: []
  });

  let deep = '1';
  for (let i = 0; i < 12; i++) deep = '{"a":' + deep + '}';
  const deepText = '{"version":"0.1","x_deep":' + deep + '}\n';
  writeCase('negative', '114-depth-exceeded', deepText, baseSignatureNoRaw, {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['max_depth'],
    warnings: []
  });

  const tampered = JSON.parse(baseText);
  tampered.identity.name = 'Toko Buku Palsu';
  writeCase('negative', '115-tampered-after-signing', pretty(tampered), baseSignature, {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['bad_signature', 'raw_digest_mismatch'],
    warnings: []
  });

  const wrongKeySignature = signContainer(base, secondaryKey, baseText);
  writeCase('negative', '116-wrong-signing-key', baseText, wrongKeySignature, {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['bad_signature'],
    warnings: []
  });

  const futureSigned = JSON.parse(baseText);
  futureSigned.validity.signed_at = '2026-10-01T06:00:00Z';
  futureSigned.validity.expires_at = '2027-10-01T06:00:00Z';
  writeCase('negative', '117-signed-in-future', pretty(futureSigned), signContainer(futureSigned, primaryKey, pretty(futureSigned)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['validity_not_yet_valid'],
    warnings: []
  });

  const reformattedWithDigest = baseText.replace('{\n', '{\n   ');
  writeCase('negative', '118-raw-digest-mismatch', reformattedWithDigest, baseSignature, {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['raw_digest_mismatch'],
    warnings: []
  });

  const conflict = rotationBase();
  conflict.rotation = {
    successor_fp: rotationFingerprint,
    predecessor_fp: primaryFingerprint,
    effective_at: '2026-10-05T00:00:00Z',
    grace_until: '2026-10-12T00:00:00Z'
  };
  writeCase('negative', '119-rotation-conflict', pretty(conflict), signContainer(conflict, primaryKey, pretty(conflict)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['rotation_invalid'],
    warnings: []
  });

  const tooShort = rotationBase();
  tooShort.rotation = { successor_fp: rotationFingerprint, effective_at: '2026-10-05T00:00:00Z', grace_until: '2026-10-05T00:30:00Z' };
  writeCase('negative', '120-rotation-window-too-short', pretty(tooShort), signContainer(tooShort, primaryKey, pretty(tooShort)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['rotation_invalid'],
    warnings: []
  });

  const graceExpired = rotationBase();
  graceExpired.rotation = { successor_fp: rotationFingerprint, effective_at: '2026-09-01T00:00:00Z', grace_until: '2026-09-20T00:00:00Z' };
  writeCase('negative', '121-rotation-grace-expired', pretty(graceExpired), signContainer(graceExpired, primaryKey, pretty(graceExpired)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['rotation_denied'],
    warnings: []
  });

  const lateBinding = rotationBase();
  lateBinding.identity.public_key = rotationPublic;
  lateBinding.rotation = { predecessor_fp: primaryFingerprint, supersedes_at: '2026-09-16T00:00:00Z' };
  writeCase('negative', '122-rotation-time-invalid', pretty(lateBinding), signContainer(lateBinding, rotationKey, pretty(lateBinding)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['rotation_invalid'],
    warnings: []
  });

  const rotationOnV01 = JSON.parse(baseText);
  rotationOnV01.rotation = { successor_fp: rotationFingerprint, effective_at: '2026-10-05T00:00:00Z', grace_until: '2026-10-12T00:00:00Z' };
  writeCase('negative', '123-rotation-on-v01', pretty(rotationOnV01), signContainer(rotationOnV01, primaryKey, pretty(rotationOnV01)), {
    result: 'UNVERIFIED',
    domain: DOMAIN,
    now: NOW,
    errors: ['schema_violation'],
    warnings: []
  });

  generateConformanceFixtures(primaryKey, secondaryKey);

  return { primaryPublic };
}

function check() {
  const groups = ['positive', 'negative'];
  let failures = 0;
  let total = 0;
  for (const group of groups) {
    const groupDir = path.join(VECTOR_DIR, group);
    if (!fs.existsSync(groupDir)) continue;
    for (const name of fs.readdirSync(groupDir)) {
      const dir = path.join(groupDir, name);
      const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
      const manifestPath = path.join(dir, 'ai.json');
      const result = verifyAll({
        manifestText: fs.readFileSync(manifestPath, 'utf8'),
        manifestBytes: fs.readFileSync(manifestPath),
        signatureText: fs.readFileSync(path.join(dir, 'ai-signature.json'), 'utf8'),
        domain: expected.domain,
        now: new Date(expected.now)
      });
      total++;
      const errorCodes = result.errors.map((error) => error.code);
      const warningCodes = result.warnings.map((warning) => warning.code);
      const resultOk = result.result === expected.result;
      const errorsOk = expected.errors.every((code) => errorCodes.includes(code));
      const warningsOk = (expected.warnings || []).every((code) => warningCodes.includes(code));
      if (!resultOk || !errorsOk || !warningsOk) {
        failures++;
        process.stderr.write('FAIL ' + group + '/' + name + ': result=' + result.result + ' errors=' + errorCodes.join(',') + ' warnings=' + warningCodes.join(',') + '\n');
      }
    }
  }
  process.stdout.write('vectors checked: ' + total + ', failures: ' + failures + '\n');
  return failures === 0 ? 0 : 1;
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    process.exitCode = check();
  } else {
    fs.rmSync(VECTOR_DIR, { recursive: true, force: true });
    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
    fs.rmSync(REVOCATION_DIR, { recursive: true, force: true });
    const summary = generate();
    process.stdout.write('primary public key: ' + summary.primaryPublic + '\n');
    process.exitCode = check();
  }
}

module.exports = { generate, check, baseManifest, privateKeyFromSeed, SEED_PRIMARY, SEED_SECONDARY };
