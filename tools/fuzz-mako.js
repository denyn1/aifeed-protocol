#!/usr/bin/env node
'use strict';

const cryptoLib = require('../lib/crypto');
const makoLib = require('../lib/mako');
const { mulberry32 } = require('./fuzz');

const FRONTMATTER_CORPUS = [
  '---\nmako: "1.0"\ntype: article\nentity: "X"\nupdated: 2026-09-15\ntokens: 10\nlanguage: id\n---\n\nIsi.\n',
  '---\nmako: 1.0\ntype: product\nentity: "Sepatu"\nupdated: 2026-02-13\ntokens: 280\nlanguage: es\naifeed:\n  policy_version: "0.2"\n  usage:\n    training: deny\n    summarize: allow\n  attribution: required\n  limits:\n    requests_per_minute: 30\n    concurrent: 2\n---\n\n# Produk\n\nFakta.\n',
  '---\nmako: "1.0"\ntype: docs\nentity: "API"\nupdated: 2026-09-15T08:00:00Z\ntokens: 300\nlanguage: en\nrelated:\n  - /a\n  - /b\nactions:\n  - name: search\n    description: "Cari"\n    endpoint: /api/search\n    method: GET\nmedia:\n  cover:\n    url: /img.png\n    alt: "x"\n---\n\n# API\n\nDocs.\n',
  '---\nmako: "2.0"\ntype: article\nentity: "Y"\nupdated: 2026-09-15\ntokens: 5\nlanguage: id\n---\n\nBody.\n',
  '---\nmako: "1.0"\ntype: article\nentity: "Z"\nupdated: 2026-09-15\ntokens: 5\nlanguage: id\naifeed:\n  policy_version: "0.2"\n  usage:\n    training: allow\n---\n\nBody.\n',
  '---\naimd: "1.0"\nmako: "1.0"\ntype: article\nentity: "A"\nupdated: 2026-09-15\ntokens: 120\nlanguage: id\naifeed:\n  policy_version: "0.2"\n  usage:\n    training: deny\n  assets:\n    - url: /laporan.pdf\n      type: document\n---\n\nBody native AIFeed Markdown.\n',
  '---\n---\nbody\n',
  'mako: "1.0"\nbody without delimiters\n'
];

const YAML_CHAR_POOL = [
  '&', '*', '!', '%', '|', '>', '~', '{', '}', '[', ']', ':', '#', '-', '?', ',',
  '"', "'", '\\', '\n', '\t', ' ', '0', '1', '9',
  'a', 'z', 'A', 'Z', '_', ': ', '# ',
  '<<', '...', '---', '\r', '\u00e9', '\u{1F600}', '\ud800', '\ufeff',
  'a'.repeat(64), ' '.repeat(16), '9'.repeat(32)
];

const CONTAINER_CORPUS = [
  '{"algorithm":"ed25519","context":"mako","url":"https://x.example/a","key_fingerprint":"sha256:x","signed_at":"2026-09-15T08:00:00Z","signature":"base64url:AAAA","raw_digest":{"sha-256":"AAAA","applies_to":"raw-bytes"}}',
  '{}',
  '{"algorithm":"ed25519","context":"mako-index","url":"https://x.example/.well-known/mako-index.json"}',
  '{"algorithm":"ed25519","context":"mako","url":"not-a-url","signature":"base64url:zzz"}',
  '[]'
];

const INDEX_CORPUS = [
  '{"version":"0.2","domain":"x.example","generated_at":"2026-09-15T08:00:00Z","page":1,"page_count":1,"entries":[{"url":"/a","type":"article","tokens":10,"updated":"2026-09-15","etag":"\\"mako-1\\"","sha-256":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="}]}',
  '{"version":"0.2","domain":"x.example","generated_at":"2026-09-15T08:00:00Z","page":1,"page_count":1,"entries":[]}',
  '{"version":"9.9","domain":"x.example","entries":[{"url":"a","type":"nope","tokens":"x","sha-256":1}]}',
  '{}'
];

function mutate(text, random) {
  let out = text;
  const rounds = 1 + Math.floor(random() * 5);
  for (let i = 0; i < rounds; i++) {
    const operation = Math.floor(random() * 7);
    const position = Math.floor(random() * (out.length + 1));
    if (operation === 0) {
      out = out.slice(0, position) + YAML_CHAR_POOL[Math.floor(random() * YAML_CHAR_POOL.length)] + out.slice(position);
    } else if (operation === 1 && out.length > 0) {
      const index = Math.min(position, out.length - 1);
      out = out.slice(0, index) + out.slice(index + 1);
    } else if (operation === 2 && out.length > 0) {
      const index = Math.min(position, out.length - 1);
      out = out.slice(0, index) + YAML_CHAR_POOL[Math.floor(random() * YAML_CHAR_POOL.length)] + out.slice(index + 1);
    } else if (operation === 3) {
      out = out.slice(0, position);
    } else if (operation === 4) {
      out = out.slice(0, position) + '\n' + YAML_CHAR_POOL[Math.floor(random() * YAML_CHAR_POOL.length)].repeat(64) + '\n' + out.slice(position);
    } else if (operation === 5) {
      out = out.slice(0, position) + '&anchor: *alias\n' + out.slice(position);
    } else {
      out = out.slice(0, position) + '\ud800' + out.slice(position);
    }
  }
  return out;
}

function preview(text) {
  const limited = text.length > 200 ? text.slice(0, 200) + '\u2026' : text;
  return JSON.stringify(limited);
}

function checkFrontmatter(text) {
  let result;
  try {
    result = makoLib.parseFrontmatter(Buffer.from(text, 'utf8'));
  } catch (error) {
    return 'parseFrontmatter threw ' + error.name + ': ' + error.message;
  }
  if (result === null || typeof result !== 'object') return 'result is not an object';
  if (typeof result.ok !== 'boolean') return 'missing ok flag';
  if (!Array.isArray(result.errors)) return 'errors is not an array';
  for (const item of result.errors) {
    if (!item || typeof item.code !== 'string') return 'error entry without code';
  }
  if (result.ok) {
    if (result.frontmatter === null || typeof result.frontmatter !== 'object' || Array.isArray(result.frontmatter)) {
      return 'ok result without plain frontmatter object';
    }
    if (Object.getPrototypeOf(result.frontmatter) !== Object.prototype) return 'frontmatter prototype is not Object.prototype';
    if (typeof result.body !== 'string') return 'ok result without body string';
  }
  if (Buffer.byteLength(text, 'utf8') > makoLib.FRONTMATTER_MAX_BYTES + 1024 && result.ok) {
    return 'oversized document accepted';
  }
  if (Object.prototype.polluted !== undefined) return 'Object.prototype polluted';
  if ({}.polluted !== undefined) return 'pollution sentinel visible';
  return null;
}

function checkContainer(text, publicKeyValue) {
  try {
    const result = makoLib.verifyMakoContainer({
      containerText: text,
      pageUrl: 'https://x.example/a',
      bodyBytes: Buffer.from('body', 'utf8'),
      publicKey: require('node:crypto').createPublicKey(publicKeyValue.privateKey)
    });
    if (typeof result.ok !== 'boolean' || !Array.isArray(result.errors)) return 'container result shape invalid';
  } catch (error) {
    return 'verifyMakoContainer threw ' + error.name + ': ' + error.message;
  }
  return null;
}

function checkIndex(text, publicKeyValue) {
  try {
    const result = makoLib.verifyMakoIndex({
      indexText: text,
      indexUrl: 'https://x.example/.well-known/mako-index.json',
      publicKeyValue
    });
    if (result === null || typeof result.ok !== 'boolean' || typeof result.verified !== 'boolean') return 'index result shape invalid';
  } catch (error) {
    return 'verifyMakoIndex threw ' + error.name + ': ' + error.message;
  }
  return null;
}

function runMakoFuzz(options = {}) {
  const iterations = options.iterations ?? 5000;
  const seed = options.seed ?? 42;
  const random = mulberry32(seed);
  const keyPair = cryptoLib.generateKeyPair();
  const publicKeyValue = cryptoLib.encodePublicKey(keyPair.publicKey);
  const failures = [];
  let executed = 0;

  for (let i = 0; i < iterations; i++) {
    const base = FRONTMATTER_CORPUS[Math.floor(random() * FRONTMATTER_CORPUS.length)];
    let text = mutate(base, random);
    if (text.length > 70000) text = text.slice(0, 70000);
    executed++;
    const reason = checkFrontmatter(text);
    if (reason) {
      failures.push({ target: 'frontmatter', iteration: i, seed, reason, input: preview(text) });
      if (failures.length >= 20) break;
      continue;
    }

    const containerText = mutate(CONTAINER_CORPUS[Math.floor(random() * CONTAINER_CORPUS.length)], random).slice(0, 4096);
    executed++;
    const containerReason = checkContainer(containerText, { privateKey: keyPair.privateKey });
    if (containerReason) {
      failures.push({ target: 'container', iteration: i, seed, reason: containerReason, input: preview(containerText) });
      if (failures.length >= 20) break;
      continue;
    }

    const indexText = mutate(INDEX_CORPUS[Math.floor(random() * INDEX_CORPUS.length)], random).slice(0, 4096);
    executed++;
    const indexReason = checkIndex(indexText, publicKeyValue);
    if (indexReason) {
      failures.push({ target: 'index', iteration: i, seed, reason: indexReason, input: preview(indexText) });
      if (failures.length >= 20) break;
    }
  }

  return { seed, iterations, executed, failures };
}

function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
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
  }
  const result = runMakoFuzz({
    iterations: args.iterations ? Number(args.iterations) : 5000,
    seed: args.seed ? Number(args.seed) : 42
  });
  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(
      'fuzz:mako targets=' + result.executed + ' seed=' + result.seed + ' failures=' + result.failures.length + '\n'
    );
    for (const failure of result.failures) {
      process.stdout.write('  - [' + failure.target + '] iteration ' + failure.iteration + ': ' + failure.reason + '\n');
      process.stdout.write('    input: ' + failure.input + '\n');
    }
  }
  return result.failures.length === 0 ? 0 : 1;
}

module.exports = { runMakoFuzz, mutate, FRONTMATTER_CORPUS };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
