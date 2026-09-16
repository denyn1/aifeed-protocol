'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { parseStrict } = require('../lib/parse');
const { validate: validateSchema } = require('../lib/schema');
const cryptoLib = require('../lib/crypto');
const { rawDigestOf } = require('../lib/digest');
const { verifyAll } = require('../lib/validate');
const { privateKeyFromSeed, SEED_PRIMARY } = require('../tools/gen-vectors');
const manifestSchema = require('../schema/ai-json.v0.1.json');

const NOW = new Date('2026-10-01T00:00:00Z');

const CASES = [
  { file: 'examples/news/news.example.json', domain: 'news.example', label: 'large news' },
  { file: 'examples/ecommerce/toko.example.json', domain: 'toko.example', label: 'e-commerce' },
  { file: 'examples/blog/blog-minimal.example.json', domain: 'catatan.example', label: 'minimal blog' },
  { file: 'examples/government/gov.example.json', domain: 'layanan.go.id.example', label: 'government' },
  { file: 'examples/saas/saas.example.json', domain: 'api.example', label: 'SaaS' },
  { file: 'examples/marketplace/marketplace.example.json', domain: 'marketplace.example', label: 'large marketplace' }
];

for (const testCase of CASES) {
  test('example conforms and verifies: ' + testCase.label, () => {
    const manifestPath = path.join(__dirname, '..', testCase.file);
    const manifestText = fs.readFileSync(manifestPath, 'utf8');
    const manifest = parseStrict(manifestText, { integersOnly: true, maxDepth: 10 });

    const schemaErrors = validateSchema(manifest, manifestSchema);
    assert.deepStrictEqual(
      schemaErrors.map((error) => error.path + ' ' + error.message),
      [],
      'schema errors for ' + testCase.label
    );

    const privateKey = privateKeyFromSeed(SEED_PRIMARY);
    const signatureBytes = cryptoLib.signManifest(privateKey, manifest);
    const container = {
      algorithm: 'ed25519',
      canonicalization: 'jcs-rfc8785',
      signature: cryptoLib.encodeSignature(signatureBytes),
      raw_digest: rawDigestOf(Buffer.from(manifestText, 'utf8'))
    };

    const result = verifyAll({
      manifestText,
      manifestBytes: Buffer.from(manifestText, 'utf8'),
      signatureText: JSON.stringify(container),
      domain: testCase.domain,
      now: NOW
    });
    assert.strictEqual(
      result.result,
      'VERIFIED',
      testCase.label + ' errors: ' + JSON.stringify(result.errors)
    );
  });
}

test('example public keys match the deterministic signer', () => {
  const expected = cryptoLib.encodePublicKey(nodeCrypto.createPublicKey(privateKeyFromSeed(SEED_PRIMARY)));
  for (const testCase of CASES) {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', testCase.file), 'utf8'));
    assert.strictEqual(manifest.identity.public_key, expected, 'public key mismatch in ' + testCase.file);
  }
});
