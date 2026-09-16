'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sdk = require('../packages/aifeed-verify');
const { verifyRevocationDocument } = require('../lib/revocation');
const { generateSite, revocationsFor } = require('../tools/gen-demos');
const definitions = require('../demos/sites');
const keys = require('../demos/keys');

test('demo generator produces verifiable origins for every site', () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-demos-'));
  try {
    for (const site of definitions) {
      const dir = generateSite(site, outRoot);
      const manifest = fs.readFileSync(path.join(dir, '.well-known', 'ai.json'));
      const signature = fs.readFileSync(path.join(dir, '.well-known', 'ai-signature.json'), 'utf8');
      const result = sdk.verifyAll({
        manifestText: manifest.toString('utf8'),
        manifestBytes: manifest,
        signatureText: signature,
        domain: site.domain
      });
      assert.strictEqual(result.result, 'VERIFIED', site.domain + ': ' + JSON.stringify(result.errors));

      const index = path.join(dir, '.well-known', 'aifeed-index.json');
      assert.ok(fs.existsSync(index), site.domain + ': delta index missing');

      const md = fs.readdirSync(dir, { recursive: true }).filter((name) => String(name).endsWith('.aifeed.md'));
      assert.ok(md.length >= site.pages.length, site.domain + ': missing signed markdown pages');

      const mako = fs.readdirSync(dir, { recursive: true }).filter((name) => String(name).endsWith('.mako.md'));
      assert.ok(mako.length >= site.pages.length, site.domain + ': missing MAKO pages');
    }
  } finally {
    fs.rmSync(outRoot, { recursive: true, force: true });
  }
});

test('demo policies are enforced in the signed manifests', () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aifeed-demos-policy-'));
  try {
    const strict = definitions.find((site) => site.sub === 'strict');
    const gov = definitions.find((site) => site.sub === 'gov');
    generateSite(strict, outRoot);
    generateSite(gov, outRoot);
    const strictManifest = JSON.parse(fs.readFileSync(path.join(outRoot, 'strict', '.well-known', 'ai.json'), 'utf8'));
    assert.deepStrictEqual(
      Object.keys(strictManifest.permissions.usage).filter((key) => strictManifest.permissions.usage[key] === 'allow'),
      ['search']
    );
    const govManifest = JSON.parse(fs.readFileSync(path.join(outRoot, 'gov', '.well-known', 'ai.json'), 'utf8'));
    assert.strictEqual(govManifest.permissions.usage.reproduce, 'allow');
    assert.strictEqual(govManifest.permissions.attribution, 'optional');
  } finally {
    fs.rmSync(outRoot, { recursive: true, force: true });
  }
});

test('demo revocation documents verify with two governance signatures', () => {
  const document = revocationsFor('revoked.aifeed.md');
  assert.strictEqual(document.status, 'suspended');
  assert.strictEqual(document.signatures.length, 2);
  const result = verifyRevocationDocument(JSON.stringify(document), {
    domain: 'revoked.aifeed.md',
    governanceKeys: keys.governance.map((item) => item.publicKey)
  });
  assert.strictEqual(result.result, 'valid', JSON.stringify(result.errors));
  assert.strictEqual(result.status, 'suspended');
});

test('pages function routes demo hosts and enforces the strict policy', async () => {
  const mod = await import('../functions/[[path]].js');
  assert.strictEqual(mod.demoSub('demo.aifeed.md'), 'demo');
  assert.strictEqual(mod.demoSub('aifeed.md'), null);
  assert.strictEqual(mod.demoSub('evil.demo.aifeed.md'), null);

  assert.strictEqual(mod.strictDecision({ accept: 'text/html', ua: 'GPTBot/1.0' }), null);
  assert.strictEqual(mod.strictDecision({ accept: 'text/aifeed+markdown', ua: 'GPTBot/1.0' }), null);
  assert.strictEqual(mod.strictDecision({ accept: '*/*', ua: 'GPTBot/1.0' }).status, 403);
  assert.strictEqual(mod.strictDecision({ accept: '*/*', ua: 'Scrapy/2.11' }).status, 429);
  assert.strictEqual(mod.strictDecision({ accept: '*/*', ua: 'Scrapy/2.11' }).retryAfter, 60);
});
