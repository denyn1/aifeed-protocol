#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { serialize } = require('../lib/jcs');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'jcs-php-fixtures.json');
const VECTOR_MANIFEST = path.join(ROOT, 'conformance', 'vectors', 'positive', '001-basic', 'ai.json');

const canonicalSorting = serialize({ b: 1, a: 2, A: 3 });
const canonicalEscaping = serialize({
  a: 'x"y\n',
  u: 'caf\u00e9',
  e: '\u{1F600}',
  c: '\u0001'
});

const manifest = JSON.parse(fs.readFileSync(VECTOR_MANIFEST, 'utf8'));
const canonicalManifest = serialize(manifest);
const digest = nodeCrypto.createHash('sha256').update(canonicalManifest, 'utf8').digest('hex');

const fixture = {
  c1: canonicalSorting,
  c2: canonicalEscaping,
  c3sha256: digest,
  c3length: Buffer.byteLength(canonicalManifest, 'utf8')
};

fs.writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
process.stdout.write('jcs fixtures written: length=' + fixture.c3length + ' sha256=' + digest + '\n');
