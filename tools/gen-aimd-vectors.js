#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const makoLib = require('../lib/mako');
const cryptoLib = require('../lib/crypto');
const { sha256Base64 } = require('../lib/digest');
const { privateKeyFromSeed, SEED_PRIMARY } = require('./gen-vectors');

const ROOT = path.join(__dirname, '..');
const AIMD_DIR = path.join(ROOT, 'conformance', 'aimd');
const PAGE_URL = 'https://berita.example/artikel/aimd';
const INDEX_URL = 'https://berita.example/.well-known/aifeed-index.json';
const SIGNED_AT = '2026-09-15T08:00:00Z';

function publicKeyValue(privateKey) {
  return cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(privateKey));
}

function pretty(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function basePageText(marker) {
  const markers = marker === 'dual' ? ['aimd: "1.0"', 'mako: "1.0"'] : marker === 'mako-only' ? ['mako: "1.0"'] : ['aimd: "1.0"'];
  return [
    '---',
    ...markers,
    'type: article',
    'entity: "Panduan AIFeed Markdown"',
    'updated: 2026-09-15',
    'tokens: 120',
    'language: id',
    'canonical: ' + PAGE_URL,
    'summary: "Dokumen native AIFeed."',
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
    '# Panduan AIFeed Markdown',
    '',
    'AIFeed Markdown adalah profil konten native AIFeed.',
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

function expectedDocument(overrides = {}) {
  return {
    verified: true,
    errors: [],
    warnings: [],
    usage: { training: 'deny', summarize: 'allow' },
    attribution: 'required',
    ...overrides
  };
}

function writeDocumentCase(group, name, options) {
  const dir = path.join(AIMD_DIR, group, name);
  fs.mkdirSync(dir, { recursive: true });
  const bytes = options.pageBytes || Buffer.from(options.pageText, 'utf8');
  fs.writeFileSync(path.join(dir, 'page.aifeed.md'), bytes);
  if (options.container) {
    fs.writeFileSync(path.join(dir, 'signature.json'), pretty(options.container));
  }
  fs.writeFileSync(path.join(dir, 'manifest.fragment.json'), pretty(options.fragment));
  fs.writeFileSync(path.join(dir, 'expected.json'), pretty({
    kind: 'document',
    profile: 'aimd',
    url: options.url || PAGE_URL,
    expected: options.expected
  }));
}

function writeIndexCase(group, name, options) {
  const dir = path.join(AIMD_DIR, group, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.json'), options.indexText);
  if (options.signatureText) {
    fs.writeFileSync(path.join(dir, 'signature.json'), options.signatureText);
  }
  fs.writeFileSync(path.join(dir, 'manifest.fragment.json'), pretty(options.fragment));
  fs.writeFileSync(path.join(dir, 'expected.json'), pretty({
    kind: 'index',
    profile: 'aimd',
    url: INDEX_URL,
    expected: options.expected
  }));
}

function buildIndexText(publicKey, pageBytes) {
  const index = {
    version: '0.2',
    domain: 'berita.example',
    site: { name: 'Berita Contoh', type: 'news', languages: ['id'] },
    generated_at: '2026-09-15T08:00:00Z',
    page: 1,
    page_count: 1,
    entries: [
      {
        url: '/artikel/aimd',
        type: 'article',
        tokens: 120,
        title: 'Panduan AIFeed Markdown',
        summary: 'Dokumen native AIFeed.',
        tags: ['aimd', 'protokol'],
        lang: 'id',
        related: ['/artikel/mako'],
        updated: '2026-09-15',
        etag: '"aimd-1"',
        'sha-256': sha256Base64(pageBytes)
      }
    ]
  };
  return JSON.stringify(index, null, 2) + '\n';
}

function generate() {
  const primaryKey = privateKeyFromSeed(SEED_PRIMARY);
  const primaryPublic = publicKeyValue(primaryKey);
  const fragment = baseFragment(primaryPublic);

  const basicText = basePageText('aimd');
  const basicBytes = Buffer.from(basicText, 'utf8');
  writeDocumentCase('positive', '001-aimd-basic', {
    pageText: basicText,
    fragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, basicBytes, { context: 'aimd', signedAt: SIGNED_AT }),
    expected: expectedDocument()
  });

  const dualText = basePageText('dual');
  writeDocumentCase('positive', '002-aimd-dual-marker', {
    pageText: dualText,
    fragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, Buffer.from(dualText, 'utf8'), { context: 'aimd', signedAt: SIGNED_AT }),
    expected: expectedDocument()
  });

  const indexText = buildIndexText(primaryPublic, basicBytes);
  writeIndexCase('positive', '003-aimd-index', {
    indexText,
    signatureText: pretty(makoLib.signMakoContainer(primaryKey, INDEX_URL, Buffer.from(indexText, 'utf8'), { context: 'aimd-index', signedAt: SIGNED_AT })),
    fragment,
    expected: { verified: true, errors: [], warnings: [] }
  });

  const assetsAlternatesText = basePageText('aimd').replace(
    '  limits:\n    requests_per_minute: 30\n---',
    [
      '  limits:',
      '    requests_per_minute: 30',
      '  assets:',
      '    - url: /laporan.pdf',
      '      type: document',
      '      title: "Laporan"',
      '      mime: application/pdf',
      '      size: 2048',
      '      sha-256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="',
      'alternates:',
      '  - url: https://contoh.example/en/aimd',
      '    lang: en',
      '---'
    ].join('\n')
  );
  writeDocumentCase('positive', '004-aimd-assets-alternates', {
    pageText: assetsAlternatesText,
    fragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, Buffer.from(assetsAlternatesText, 'utf8'), { context: 'aimd', signedAt: SIGNED_AT }),
    expected: expectedDocument()
  });

  writeDocumentCase('negative', '101-cross-format-replay', {
    pageText: basicText,
    fragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, basicBytes, { context: 'mako', signedAt: SIGNED_AT }),
    expected: expectedDocument({ verified: false, errors: ['mako_context_invalid'], usage: undefined, attribution: undefined })
  });

  const makoOnlyText = basePageText('mako-only');
  writeDocumentCase('negative', '102-missing-aimd-marker', {
    pageText: makoOnlyText,
    fragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, Buffer.from(makoOnlyText, 'utf8'), { context: 'aimd', signedAt: SIGNED_AT }),
    expected: expectedDocument({ verified: true, errors: ['aimd_frontmatter_missing'], usage: undefined, attribution: undefined })
  });

  const tamperedText = basicText + '\nTambahan ilegal.\n';
  writeDocumentCase('negative', '103-tampered-body', {
    pageBytes: Buffer.from(tamperedText, 'utf8'),
    fragment,
    container: makoLib.signMakoContainer(primaryKey, PAGE_URL, basicBytes, { context: 'aimd', signedAt: SIGNED_AT }),
    expected: expectedDocument({ verified: false, errors: ['mako_digest_mismatch'], usage: undefined, attribution: undefined })
  });

  const freshnessText = basePageText('aimd').replace('type: article', 'freshness: sometimes\ntype: article');
  writeDocumentCase('negative', '104-freshness-invalid', {
    pageText: freshnessText,
    fragment,
    expected: expectedDocument({ verified: false, errors: ['aimd_frontmatter_invalid'], usage: undefined, attribution: undefined })
  });

  const tooManyAlternates = [];
  for (let index = 0; index < 21; index++) {
    tooManyAlternates.push('  - url: /x' + index);
    tooManyAlternates.push('    lang: en');
  }
  const alternatesText = basePageText('aimd').replace(
    '---\n\n# Panduan AIFeed Markdown',
    'alternates:\n' + tooManyAlternates.join('\n') + '\n---\n\n# Panduan AIFeed Markdown'
  );
  writeDocumentCase('negative', '105-alternates-too-many', {
    pageText: alternatesText,
    fragment,
    expected: expectedDocument({ verified: false, errors: ['aimd_frontmatter_invalid'], usage: undefined, attribution: undefined })
  });

  const tokensText = basePageText('aimd').replace('tokens: 120', 'tokens: 2000000');
  writeDocumentCase('negative', '106-tokens-overflow', {
    pageText: tokensText,
    fragment,
    expected: expectedDocument({ verified: false, errors: ['aimd_frontmatter_invalid'], usage: undefined, attribution: undefined })
  });

  const mediaText = basePageText('aimd').replace(
    '---\n\n# Panduan AIFeed Markdown',
    'media:\n  cover:\n    url: /img.png\n---\n\n# Panduan AIFeed Markdown'
  );
  writeDocumentCase('negative', '107-media-invalid', {
    pageText: mediaText,
    fragment,
    expected: expectedDocument({ verified: false, errors: ['aimd_frontmatter_invalid'], usage: undefined, attribution: undefined })
  });

  return { primaryPublic };
}

function check() {
  let failures = 0;
  let total = 0;
  for (const group of ['positive', 'negative']) {
    const groupDir = path.join(AIMD_DIR, group);
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
        const result = makoLib.verifyAimdIndex({
          indexText,
          indexUrl: expected.url,
          publicKeyValue: fragment.public_key,
          signatureText
        });
        if (result.verified !== expected.expected.verified) {
          caseFailures.push('verified expected ' + expected.expected.verified + ' got ' + result.verified);
        }
        const codes = result.errors.map((item) => item.code);
        for (const code of expected.expected.errors) {
          if (!codes.includes(code)) caseFailures.push('missing error ' + code + ' (got ' + codes.join(',') + ')');
        }
      } else {
        const signaturePath = path.join(dir, 'signature.json');
        const result = makoLib.verifyAimdDocument({
          pageUrl: expected.url,
          makoBytes: fs.readFileSync(path.join(dir, 'page.aifeed.md')),
          containerText: fs.existsSync(signaturePath) ? fs.readFileSync(signaturePath, 'utf8') : undefined,
          manifestFragment: fragment
        });
        if (result.verified !== expected.expected.verified) {
          caseFailures.push('verified expected ' + expected.expected.verified + ' got ' + result.verified);
        }
        const codes = result.errors.map((item) => item.code);
        for (const code of expected.expected.errors) {
          if (!codes.includes(code)) caseFailures.push('missing error ' + code + ' (got ' + codes.join(',') + ')');
        }
        if (expected.expected.usage) {
          for (const [key, value] of Object.entries(expected.expected.usage)) {
            if (!result.usage || result.usage[key] !== value) {
              caseFailures.push('usage.' + key + ' expected ' + value + ' got ' + (result.usage ? result.usage[key] : 'null'));
            }
          }
        }
      }
      if (caseFailures.length > 0) {
        failures++;
        process.stderr.write('FAIL ' + group + '/' + name + ': ' + caseFailures.join('; ') + '\n');
      }
    }
  }
  process.stdout.write('aimd vectors checked: ' + total + ', failures: ' + failures + '\n');
  return failures === 0 ? 0 : 1;
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    process.exitCode = check();
  } else {
    fs.rmSync(AIMD_DIR, { recursive: true, force: true });
    generate();
    process.exitCode = check();
  }
}

module.exports = { generate, check, basePageText };
