#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const cryptoLib = require('../lib/crypto');
const digestLib = require('../lib/digest');
const makoLib = require('../lib/mako');
const { privateKeyFromSeed, SEED_PRIMARY, SEED_SECONDARY } = require('./gen-vectors');

const ROOT = path.join(__dirname, '..');
const MAKO_VECTOR_DIR = path.join(ROOT, 'conformance', 'mako');
const PAGE_URL = 'https://berita.example/artikel/aifeed-protokol';
const INDEX_URL = 'https://berita.example/.well-known/mako-index.json';
const SIGNED_AT = '2026-09-15T08:00:00Z';

function publicKeyValue(privateKey) {
  return cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(privateKey));
}

function pretty(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function basePageText() {
  return [
    '---',
    'mako: "1.0"',
    'type: article',
    'entity: "Panduan Protokol AIFeed"',
    'updated: 2026-09-14',
    'tokens: 280',
    'language: id',
    'canonical: https://berita.example/artikel/aifeed-protokol',
    'summary: "Ringkasan singkat tentang AIFeed dan MAKO."',
    'aifeed:',
    '  policy_version: "0.2"',
    '  usage:',
    '    training: deny',
    '    summarize: allow',
    '  attribution: required',
    '  limits:',
    '    requests_per_minute: 30',
    '---',
    '',
    '# Panduan Protokol AIFeed',
    '',
    'AIFeed v0.2 mengikat deklarasi izin bertanda tangan ke format MAKO per halaman.',
    '',
    '## Poin Kunci',
    '',
    '- Izin diwarisi dari manifest dan hanya boleh diperketat',
    '- Tanda tangan mengikat konten ke URL halaman',
    '- Indeks delta menghapus crawl berulang',
    ''
  ].join('\n');
}

function baseFragment(publicKey) {
  return {
    public_key: publicKey,
    content_mako: { signature: 'optional', overrides: 'restrict-only' },
    permissions: {
      default: 'allow',
      usage: {
        search: 'allow',
        retrieval: 'allow',
        input: 'allow',
        training: 'allow',
        quote: 'allow',
        summarize: 'allow',
        reproduce: 'deny',
        translate: 'allow',
        modify: 'deny',
        embed: 'deny',
        commercial_use: 'deny'
      },
      attribution: 'optional'
    }
  };
}

function replaceOnce(text, from, to) {
  if (!text.includes(from)) throw new Error('pattern not found: ' + from);
  return text.replace(from, to);
}

function documentExpected(overrides = {}) {
  return {
    mako_verified: true,
    errors: [],
    warnings: [],
    usage: {
      training: 'deny',
      summarize: 'allow',
      search: 'allow',
      reproduce: 'deny'
    },
    attribution: 'required',
    limits: { requests_per_minute: 30 },
    ...overrides
  };
}

function writeDocumentCase(group, name, options) {
  const dir = path.join(MAKO_VECTOR_DIR, group, name);
  fs.mkdirSync(dir, { recursive: true });
  const bytes = options.pageBytes || Buffer.from(options.pageText, 'utf8');
  fs.writeFileSync(path.join(dir, 'page.mako.md'), bytes);
  if (options.container) {
    fs.writeFileSync(path.join(dir, 'signature.json'), pretty(options.container));
  }
  fs.writeFileSync(path.join(dir, 'manifest.fragment.json'), pretty(options.fragment));
  fs.writeFileSync(
    path.join(dir, 'expected.json'),
    pretty({
      kind: 'document',
      url: options.url || PAGE_URL,
      ...(options.lastModified ? { last_modified: options.lastModified } : {}),
      expected: options.expected
    })
  );
}

function writeIndexCase(group, name, options) {
  const dir = path.join(MAKO_VECTOR_DIR, group, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.json'), options.indexText);
  if (options.signatureText) {
    fs.writeFileSync(path.join(dir, 'signature.json'), options.signatureText);
  }
  if (options.bodyBytes) {
    fs.writeFileSync(path.join(dir, 'body.mako.md'), options.bodyBytes);
  }
  fs.writeFileSync(path.join(dir, 'manifest.fragment.json'), pretty(options.fragment));
  fs.writeFileSync(
    path.join(dir, 'expected.json'),
    pretty({
      kind: 'index',
      url: INDEX_URL,
      ...(options.requireSignature ? { require_signature: true } : {}),
      ...(options.entryDigestCheck ? { entry_digest_check: options.entryDigestCheck } : {}),
      expected: options.expected
    })
  );
}

function createIndexText({ domain = 'berita.example', sha256, site, entryExtra, entriesOverride }) {
  const entry = {
    url: '/artikel/aifeed-protokol',
    type: 'article',
    tokens: 280,
    updated: '2026-09-14',
    etag: '"mako-a1b2c3"',
    'sha-256': sha256,
    ...(entryExtra || {})
  };
  const index = {
    version: '0.2',
    domain,
    ...(site ? { site } : {}),
    generated_at: '2026-09-15T08:00:00Z',
    page: 1,
    page_count: 1,
    entries: entriesOverride || [entry]
  };
  return JSON.stringify(index, null, 2) + '\n';
}

function tamperSignature(signatureValue) {
  const bytes = Buffer.from(signatureValue.slice('base64url:'.length), 'base64url');
  bytes[0] = bytes[0] ^ 0xff;
  return cryptoLib.encodeSignature(bytes);
}

function generate() {
  const primaryKey = privateKeyFromSeed(SEED_PRIMARY);
  const secondaryKey = privateKeyFromSeed(SEED_SECONDARY);
  const primaryPublic = publicKeyValue(primaryKey);
  const secondaryPublic = publicKeyValue(secondaryKey);
  const fragment = baseFragment(primaryPublic);
  const pageText = basePageText();
  const pageBytes = Buffer.from(pageText, 'utf8');
  const validContainer = makoLib.signMakoContainer(primaryKey, PAGE_URL, pageBytes, { signedAt: SIGNED_AT });

  writeDocumentCase('positive', '001-signed-restrictive', {
    pageText, fragment, container: validContainer, expected: documentExpected()
  });

  writeDocumentCase('positive', '002-unsigned-optional', {
    pageText, fragment, expected: documentExpected({ mako_verified: false })
  });

  const requiredFragment = baseFragment(primaryPublic);
  requiredFragment.content_mako.signature = 'required';
  writeDocumentCase('positive', '003-signature-required-valid', {
    pageText, fragment: requiredFragment, container: validContainer, expected: documentExpected()
  });

  const bidirectionalFragment = baseFragment(primaryPublic);
  bidirectionalFragment.content_mako.overrides = 'bidirectional';
  bidirectionalFragment.permissions.usage.training = 'deny';
  const grantText = replaceOnce(pageText, '    training: deny', '    training: allow');
  writeDocumentCase('positive', '004-bidirectional-grant', {
    pageText: grantText,
    fragment: bidirectionalFragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, Buffer.from(grantText, 'utf8'), { signedAt: SIGNED_AT }),
    expected: documentExpected({
      usage: { training: 'allow', summarize: 'allow', search: 'allow', reproduce: 'deny' }
    })
  });

  const commentText = [
    '---',
    '# MAKO untuk artikel berita',
    "mako: '1.0'",
    'type: article',
    "entity: 'Panduan Protokol AIFeed'",
    'updated: 2026-09-14',
    'tokens: 280',
    'language: id',
    'summary: "Ringkasan singkat." # komentar akhir baris',
    'aifeed:',
    "  policy_version: '0.2'",
    '  usage:',
    '    training: deny  # hanya untuk pengujian',
    '  limits:',
    '    concurrent: 1',
    '---',
    '',
    '# Panduan Protokol AIFeed',
    '',
    'Isi ringkas.',
    ''
  ].join('\n');
  writeDocumentCase('positive', '005-comments-and-quotes', {
    pageText: commentText,
    fragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, Buffer.from(commentText, 'utf8'), { signedAt: SIGNED_AT }),
    expected: documentExpected({
      usage: { training: 'deny', summarize: 'allow', search: 'allow', reproduce: 'deny' },
      attribution: 'optional',
      limits: { concurrent: 1 }
    })
  });

  const indexText = createIndexText({ sha256: digestLib.sha256Base64(pageBytes) });
  const indexSignature = makoLib.signMakoContainer(primaryKey, INDEX_URL, Buffer.from(indexText, 'utf8'), {
    context: 'mako-index',
    signedAt: SIGNED_AT
  });
  writeIndexCase('positive', '006-index-signed', {
    indexText,
    signatureText: pretty(indexSignature),
    fragment,
    expected: { verified: true, errors: [], warnings: [] }
  });

  const unquotedVersionText = replaceOnce(pageText, 'mako: "1.0"', 'mako: 1.0');
  writeDocumentCase('positive', '007-unquoted-version', {
    pageText: unquotedVersionText,
    fragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, Buffer.from(unquotedVersionText, 'utf8'), { signedAt: SIGNED_AT }),
    expected: documentExpected()
  });

  const staleText = replaceOnce(pageText, 'updated: 2026-09-14', 'updated: 2026-01-01');
  writeDocumentCase('positive', '008-stale-warning', {
    pageText: staleText,
    fragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, Buffer.from(staleText, 'utf8'), { signedAt: SIGNED_AT }),
    lastModified: '2026-09-14T00:00:00Z',
    expected: documentExpected({ warnings: ['mako_stale'] })
  });

  const assetsText = replaceOnce(
    pageText,
    '  limits:\n    requests_per_minute: 30',
    [
      '  limits:',
      '    requests_per_minute: 30',
      '  assets:',
      '    - url: /uploads/sampul.webp',
      '      type: image',
      '      alt: "Sampul"',
      '    - url: /laporan.pdf',
      '      type: document',
      '      title: "Laporan Lengkap"'
    ].join('\n')
  );
  writeDocumentCase('positive', '009-aifeed-assets', {
    pageText: assetsText,
    fragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, Buffer.from(assetsText, 'utf8'), { signedAt: SIGNED_AT }),
    expected: documentExpected()
  });

  const triageIndexText = createIndexText({
    sha256: digestLib.sha256Base64(pageBytes),
    site: {
      name: 'Berita Contoh',
      description: 'Berita harian independen untuk uji konformansi.',
      type: 'news',
      languages: ['id'],
      license: 'All Rights Reserved',
      updated_at: '2026-09-15T08:00:00Z'
    },
    entryExtra: {
      title: 'Panduan Protokol AIFeed',
      summary: 'Ringkasan singkat tentang AIFeed dan MAKO.',
      tags: ['aifeed', 'mako'],
      lang: 'id',
      related: ['/artikel/mako-index']
    }
  });
  const triageSignature = makoLib.signMakoContainer(primaryKey, INDEX_URL, Buffer.from(triageIndexText, 'utf8'), {
    context: 'mako-index',
    signedAt: SIGNED_AT
  });
  writeIndexCase('positive', '010-index-triage', {
    indexText: triageIndexText,
    signatureText: pretty(triageSignature),
    fragment,
    expected: { verified: true, errors: [], warnings: [] }
  });

  const tamperedText = pageText + '\nTambahan ilegal setelah ditandatangani.\n';
  writeDocumentCase('negative', '101-tampered-body', {
    pageBytes: Buffer.from(tamperedText, 'utf8'),
    fragment,
    container: validContainer,
    expected: documentExpected({ mako_verified: false, errors: ['mako_digest_mismatch'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const badSignatureContainer = { ...validContainer, signature: tamperSignature(validContainer.signature) };
  writeDocumentCase('negative', '102-bad-signature', {
    pageText, fragment, container: badSignatureContainer,
    expected: documentExpected({ mako_verified: false, errors: ['mako_bad_signature'] })
  });

  const wrongKeyContainer = makoLib.signMakoContainer(secondaryKey, PAGE_URL, pageBytes, { signedAt: SIGNED_AT });
  writeDocumentCase('negative', '103-wrong-key', {
    pageText, fragment, container: wrongKeyContainer,
    expected: documentExpected({ mako_verified: false, errors: ['mako_key_mismatch'] })
  });

  const lyingFingerprintContainer = { ...wrongKeyContainer, key_fingerprint: cryptoLib.fingerprintOf(nodeCrypto.createPublicKey(primaryKey)) };
  writeDocumentCase('negative', '104-lying-fingerprint', {
    pageText, fragment, container: lyingFingerprintContainer,
    expected: documentExpected({ mako_verified: false, errors: ['mako_bad_signature'] })
  });

  const otherUrlContainer = makoLib.signMakoContainer(primaryKey, 'https://berita.example/artikel/lain', pageBytes, { signedAt: SIGNED_AT });
  writeDocumentCase('negative', '105-url-mismatch', {
    pageText, fragment, container: otherUrlContainer,
    expected: documentExpected({ mako_verified: false, errors: ['mako_url_mismatch'] })
  });

  writeDocumentCase('negative', '106-required-missing', {
    pageText, fragment: requiredFragment,
    expected: documentExpected({ mako_verified: false, errors: ['mako_signature_missing'] })
  });

  const wrongContextContainer = { ...validContainer, context: 'manifest' };
  writeDocumentCase('negative', '107-context-invalid', {
    pageText, fragment, container: wrongContextContainer,
    expected: documentExpected({ mako_verified: false, errors: ['mako_context_invalid'] })
  });

  const anchorText = replaceOnce(pageText, 'entity: "Panduan Protokol AIFeed"', 'entity: &anchor "Panduan"');
  writeDocumentCase('negative', '108-yaml-anchor', {
    pageText: anchorText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['yaml_anchor_forbidden'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const aliasText = replaceOnce(pageText, 'entity: "Panduan Protokol AIFeed"', 'entity: *anchor');
  writeDocumentCase('negative', '109-yaml-alias', {
    pageText: aliasText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['yaml_alias_forbidden'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const flowText = replaceOnce(pageText, 'summary: "Ringkasan singkat tentang AIFeed dan MAKO."', 'summary: "Ringkasan singkat tentang AIFeed dan MAKO."\ntags: [aifeed, mako]');
  writeDocumentCase('negative', '110-yaml-flow', {
    pageText: flowText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['yaml_flow_forbidden'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const blockScalarText = replaceOnce(pageText, 'summary: "Ringkasan singkat tentang AIFeed dan MAKO."', 'summary: |');
  writeDocumentCase('negative', '111-yaml-block-scalar', {
    pageText: blockScalarText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['yaml_block_scalar_forbidden'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const nullText = replaceOnce(pageText, 'summary: "Ringkasan singkat tentang AIFeed dan MAKO."', 'summary: null');
  writeDocumentCase('negative', '112-yaml-null', {
    pageText: nullText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['yaml_null_forbidden'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const floatText = replaceOnce(pageText, 'tokens: 280', 'tokens: 1.5');
  writeDocumentCase('negative', '113-yaml-float', {
    pageText: floatText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['float_not_allowed'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const duplicateText = replaceOnce(
    pageText,
    'entity: "Panduan Protokol AIFeed"',
    'entity: "Panduan Protokol AIFeed"\nentity: "Duplikat"'
  );
  writeDocumentCase('negative', '114-yaml-duplicate-key', {
    pageText: duplicateText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['duplicate_key'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const tabText = replaceOnce(pageText, '    requests_per_minute: 30', '\trequests_per_minute: 30');
  writeDocumentCase('negative', '115-yaml-tab-indent', {
    pageText: tabText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['yaml_tab_indent'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const deepText = replaceOnce(
    pageText,
    'aifeed:',
    ['x_ext:', '  a:', '    b:', '      c:', '        d:', '          e:', '            f: 1', 'aifeed:'].join('\n')
  );
  writeDocumentCase('negative', '116-yaml-max-depth', {
    pageText: deepText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['yaml_max_depth'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const looseOverrideFragment = baseFragment(primaryPublic);
  looseOverrideFragment.permissions.usage.training = 'deny';
  const looseOverrideText = replaceOnce(pageText, '    training: deny', '    training: allow');
  writeDocumentCase('negative', '117-override-loosen', {
    pageText: looseOverrideText, fragment: looseOverrideFragment,
    expected: documentExpected({
      mako_verified: false,
      warnings: ['permission_override_rejected'],
      usage: { training: 'deny', summarize: 'allow' }
    })
  });

  const unknownFieldText = replaceOnce(pageText, '  policy_version: "0.2"', '  policy_version: "0.2"\n  foo: 1');
  writeDocumentCase('negative', '118-aifeed-unknown-field', {
    pageText: unknownFieldText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['aifeed_unknown_field'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const unsupportedVersionText = replaceOnce(pageText, 'mako: "1.0"', 'mako: "2.0"');
  writeDocumentCase('negative', '119-mako-unsupported', {
    pageText: unsupportedVersionText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['mako_unsupported'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const missingTokensText = replaceOnce(pageText, 'tokens: 280\n', '');
  writeDocumentCase('negative', '120-missing-field', {
    pageText: missingTokensText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['mako_frontmatter_missing'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const longSummaryText = replaceOnce(
    pageText,
    'summary: "Ringkasan singkat tentang AIFeed dan MAKO."',
    'summary: "' + 'a'.repeat(9000) + '"'
  );
  writeDocumentCase('negative', '121-scalar-too-long', {
    pageText: longSummaryText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['scalar_too_long'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const indexTampered = { ...indexSignature, signature: tamperSignature(indexSignature.signature) };
  writeIndexCase('negative', '122-index-bad-signature', {
    indexText,
    signatureText: pretty(indexTampered),
    fragment,
    expected: { verified: false, errors: ['mako_bad_signature'], warnings: [] }
  });

  const wrongDigestIndexText = createIndexText({ sha256: digestLib.sha256Base64(Buffer.from('konten lain', 'utf8')) });
  writeIndexCase('negative', '123-index-entry-digest-mismatch', {
    indexText: wrongDigestIndexText,
    bodyBytes: pageBytes,
    fragment,
    entryDigestCheck: { body: 'body.mako.md', error: 'mako_index_digest_mismatch' },
    expected: { verified: false, errors: [], warnings: [] }
  });

  const wrongDomainIndexText = createIndexText({ domain: 'other.example', sha256: digestLib.sha256Base64(pageBytes) });
  writeIndexCase('negative', '124-index-domain-mismatch', {
    indexText: wrongDomainIndexText,
    fragment,
    expected: { verified: false, errors: ['mako_index_domain_mismatch'], warnings: [] }
  });

  const trailingEmptyText = replaceOnce(pageText, 'summary: "Ringkasan singkat tentang AIFeed dan MAKO."\n', '') 
    .replace('---\n\n# Panduan', 'summary:\n---\n\n# Panduan');
  writeDocumentCase('negative', '125-trailing-empty-key', {
    pageText: trailingEmptyText, fragment,
    expected: documentExpected({ mako_verified: false, errors: ['yaml_null_forbidden'], usage: undefined, attribution: undefined, limits: undefined })
  });

  const longSummaryIndexText = createIndexText({
    sha256: digestLib.sha256Base64(pageBytes),
    entryExtra: { summary: 'a'.repeat(200) }
  });
  writeIndexCase('negative', '126-index-summary-too-long', {
    indexText: longSummaryIndexText,
    fragment,
    expected: { verified: false, errors: ['mako_index_invalid'], warnings: [] }
  });

  const manyTagsIndexText = createIndexText({
    sha256: digestLib.sha256Base64(pageBytes),
    entryExtra: { tags: Array.from({ length: 12 }, (unused, index) => 'tag' + index) }
  });
  writeIndexCase('negative', '127-index-tags-too-many', {
    indexText: manyTagsIndexText,
    fragment,
    expected: { verified: false, errors: ['mako_index_invalid'], warnings: [] }
  });

  const badSiteIndexText = createIndexText({
    sha256: digestLib.sha256Base64(pageBytes),
    site: { name: 'Berita Contoh', type: 'not-a-type' }
  });
  writeIndexCase('negative', '128-index-site-invalid', {
    indexText: badSiteIndexText,
    fragment,
    expected: { verified: false, errors: ['mako_index_invalid'], warnings: [] }
  });

  const licenseFragment = baseFragment(primaryPublic);
  licenseFragment.permissions.license = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };
  const licenseOverrideText = replaceOnce(
    pageText,
    '  attribution: required',
    '  attribution: required\n  license:\n    name: "All Rights Reserved"\n    url: "https://berita.example/license"'
  );
  writeDocumentCase('negative', '129-license-override-rejected', {
    pageText: licenseOverrideText,
    fragment: licenseFragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, Buffer.from(licenseOverrideText, 'utf8'), { signedAt: SIGNED_AT }),
    expected: documentExpected({
      warnings: ['permission_override_rejected'],
      license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }
    })
  });

  return { primaryPublic, secondaryPublic };
}

function checkCodes(actual, expected, failures, label) {
  const codes = actual.map((item) => item.code);
  for (const code of expected) {
    if (!codes.includes(code)) {
      failures.push('missing expected ' + label + ' ' + code + ' (got ' + codes.join(',') + ')');
    }
  }
}

function compareUsage(actual, expected, failures) {
  for (const [key, value] of Object.entries(expected)) {
    if (!actual || actual[key] !== value) {
      failures.push('usage.' + key + ' expected ' + value + ' got ' + (actual ? actual[key] : 'null'));
    }
  }
}

function check() {
  let failures = 0;
  let total = 0;
  for (const group of ['positive', 'negative']) {
    const groupDir = path.join(MAKO_VECTOR_DIR, group);
    if (!fs.existsSync(groupDir)) continue;
    for (const name of fs.readdirSync(groupDir)) {
      const dir = path.join(groupDir, name);
      const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
      const fragment = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.fragment.json'), 'utf8'));
      const caseFailures = [];
      total++;
      if (expected.kind === 'index') {
        const indexText = fs.readFileSync(path.join(dir, 'index.json'), 'utf8');
        const signaturePath = path.join(dir, 'signature.json');
        const signatureText = fs.existsSync(signaturePath) ? fs.readFileSync(signaturePath, 'utf8') : undefined;
        const result = makoLib.verifyMakoIndex({
          indexText,
          indexUrl: expected.url,
          publicKeyValue: fragment.public_key,
          signatureText,
          requireSignature: expected.require_signature === true
        });
        if (result.verified !== expected.expected.verified) {
          caseFailures.push('verified expected ' + expected.expected.verified + ' got ' + result.verified);
        }
        checkCodes(result.errors, expected.expected.errors, caseFailures, 'error');
        checkCodes(result.warnings || [], expected.expected.warnings || [], caseFailures, 'warning');
        if (expected.entry_digest_check) {
          const body = fs.readFileSync(path.join(dir, expected.entry_digest_check.body));
          const digestResult = makoLib.checkIndexEntryDigest(result.entries[0], body);
          if (digestResult.ok) {
            caseFailures.push('expected entry digest mismatch but check passed');
          } else if (digestResult.error.code !== expected.entry_digest_check.error) {
            caseFailures.push('entry digest error expected ' + expected.entry_digest_check.error + ' got ' + digestResult.error.code);
          }
        }
      } else {
        const signaturePath = path.join(dir, 'signature.json');
        const result = makoLib.verifyMakoDocument({
          pageUrl: expected.url,
          makoBytes: fs.readFileSync(path.join(dir, 'page.mako.md')),
          containerText: fs.existsSync(signaturePath) ? fs.readFileSync(signaturePath, 'utf8') : undefined,
          manifestFragment: fragment,
          lastModified: expected.last_modified
        });
        if (result.mako_verified !== expected.expected.mako_verified) {
          caseFailures.push('mako_verified expected ' + expected.expected.mako_verified + ' got ' + result.mako_verified);
        }
        checkCodes(result.errors, expected.expected.errors, caseFailures, 'error');
        checkCodes(result.warnings, expected.expected.warnings, caseFailures, 'warning');
        if (expected.expected.usage) compareUsage(result.usage, expected.expected.usage, caseFailures);
        if (expected.expected.attribution !== undefined && result.attribution !== expected.expected.attribution) {
          caseFailures.push('attribution expected ' + expected.expected.attribution + ' got ' + result.attribution);
        }
        if (expected.expected.limits) {
          for (const [key, value] of Object.entries(expected.expected.limits)) {
            if (!result.limits || result.limits[key] !== value) {
              caseFailures.push('limits.' + key + ' expected ' + value + ' got ' + (result.limits ? result.limits[key] : 'null'));
            }
          }
        }
        if (expected.expected.license !== undefined) {
          const actualLicense = JSON.stringify(result.license ?? null);
          const wantedLicense = JSON.stringify(expected.expected.license);
          if (actualLicense !== wantedLicense) {
            caseFailures.push('license expected ' + wantedLicense + ' got ' + actualLicense);
          }
        }
      }
      if (caseFailures.length > 0) {
        failures++;
        process.stderr.write('FAIL ' + group + '/' + name + ': ' + caseFailures.join('; ') + '\n');
      }
    }
  }
  process.stdout.write('mako vectors checked: ' + total + ', failures: ' + failures + '\n');
  return failures === 0 ? 0 : 1;
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    process.exitCode = check();
  } else {
    fs.rmSync(MAKO_VECTOR_DIR, { recursive: true, force: true });
    const summary = generate();
    process.stdout.write('mako vectors generated for ' + summary.primaryPublic + '\n');
    process.exitCode = check();
  }
}

module.exports = { generate, check };
