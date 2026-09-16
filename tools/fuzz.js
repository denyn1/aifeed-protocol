#!/usr/bin/env node
'use strict';

const { isDeepStrictEqual } = require('node:util');
const { parseStrict, StrictParseError } = require('../lib/parse');
const { serialize } = require('../lib/jcs');

const CORPUS = [
  '{"a":1}',
  '{"a":[1,2,{"b":"x\\n"}],"c":true,"d":null,"e":-3}',
  '{"name":"Caf\u00e9","emoji":"\u{1F600}"}',
  '{"nested":{"deep":{"value":9007199254740991}}}',
  '{"__proto__":{"polluted":true}}',
  '{"dup":1,"dup":2}',
  '{"text":"line\\u0041\\n","tab":"\\t"}',
  '{"big":12345678901234567890}',
  '{"float":1.5,"exp":1e10,"neg":-0}',
  '"unterminated',
  '{"u":"\\ud800"}',
  '{"u":"\\ud83d\\ude00"}',
  '[]',
  'null',
  'true',
  '{"a": ',
  '{',
  '}',
  '{"a":1,}',
  '{"a" 1}'
];

const CHAR_POOL = [
  '0', '1', '9', '-', '.', 'e', 'E', '+',
  '{', '}', '[', ']', ':', ',', '"',
  'a', 'z', 'A', 'Z', '_', ' ',
  '\\', '/', 'n', 't', 'u',
  '\u0000', '\u0001', '\u001f', '\u007f',
  '\n', '\r', '\t',
  '\u00e9', '\u00fc', '\u{1F600}',
  '\ud800', '\udc00', '\ufeff'
];

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mutate(text, random) {
  let out = text;
  const rounds = 1 + Math.floor(random() * 4);
  for (let i = 0; i < rounds; i++) {
    const operation = Math.floor(random() * 8);
    const position = Math.floor(random() * (out.length + 1));
    if (operation === 0) {
      out = out.slice(0, position) + CHAR_POOL[Math.floor(random() * CHAR_POOL.length)] + out.slice(position);
    } else if (operation === 1 && out.length > 0) {
      const index = Math.min(position, out.length - 1);
      out = out.slice(0, index) + out.slice(index + 1);
    } else if (operation === 2 && out.length > 0) {
      const index = Math.min(position, out.length - 1);
      out = out.slice(0, index) + CHAR_POOL[Math.floor(random() * CHAR_POOL.length)] + out.slice(index + 1);
    } else if (operation === 3) {
      out = out.slice(0, position);
    } else if (operation === 4) {
      out = out.slice(0, position) + '"__proto__":{"polluted":true},' + out.slice(position);
    } else if (operation === 5) {
      out = out.slice(0, position) + '"dup":1,' + out.slice(position);
    } else if (operation === 6) {
      const block = CHAR_POOL[Math.floor(random() * CHAR_POOL.length)].repeat(32);
      out = out.slice(0, position) + block + out.slice(position);
    } else {
      out = out.slice(0, position) + '\\ud800' + out.slice(position);
    }
  }
  return out;
}

function preview(text) {
  const limited = text.length > 300 ? text.slice(0, 300) + '…' : text;
  return JSON.stringify(limited);
}

function checkInvariants(text, options) {
  let value;
  try {
    value = parseStrict(text, options);
  } catch (error) {
    if (error instanceof StrictParseError) return null;
    return 'unexpected error ' + error.name + ': ' + error.message;
  }

  let canonical;
  try {
    canonical = serialize(value);
  } catch (error) {
    return 'serialize failed: ' + error.message;
  }

  let reparsed;
  try {
    reparsed = parseStrict(canonical, options);
  } catch (error) {
    return 'round-trip parse failed: ' + (error.name || 'Error') + ': ' + error.message;
  }

  if (!isDeepStrictEqual(value, reparsed)) return 'round-trip mismatch';

  if (Object.prototype.polluted !== undefined) return 'Object.prototype polluted';
  if (value && typeof value === 'object') {
    if (value.polluted !== undefined) return 'pollution sentinel visible through property lookup';
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
      return 'unexpected prototype on parsed object';
    }
  }
  return null;
}

function runFuzz(options = {}) {
  const iterations = options.iterations ?? 5000;
  const seed = options.seed ?? 42;
  const maxInputLength = options.maxInputLength ?? 8192;
  const random = mulberry32(seed);
  const failures = [];
  let executed = 0;

  for (let i = 0; i < iterations; i++) {
    const base = CORPUS[Math.floor(random() * CORPUS.length)];
    let text = mutate(base, random);
    if (text.length > maxInputLength) text = text.slice(0, maxInputLength);
    const parseOptions = i % 3 === 0 ? { integersOnly: true } : {};
    executed++;
    const reason = checkInvariants(text, parseOptions);
    if (reason) {
      failures.push({ iteration: i, seed, reason, input: preview(text) });
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
  const result = runFuzz({
    iterations: args.iterations ? Number(args.iterations) : 5000,
    seed: args.seed ? Number(args.seed) : 42
  });
  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(
      'fuzz: iterations=' + result.executed + ' seed=' + result.seed +
      ' failures=' + result.failures.length + '\n'
    );
    for (const failure of result.failures) {
      process.stdout.write('  - iteration ' + failure.iteration + ': ' + failure.reason + '\n');
      process.stdout.write('    input: ' + failure.input + '\n');
    }
  }
  return result.failures.length === 0 ? 0 : 1;
}

module.exports = { runFuzz, mutate, checkInvariants, mulberry32, CORPUS };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
