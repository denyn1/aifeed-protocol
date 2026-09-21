'use strict';

function parseArgv(argv) {
  const result = { _: [], flags: {} };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === '--') {
      result._.push(...argv.slice(index + 1));
      break;
    }
    if (token.startsWith('--')) {
      const body = token.slice(2);
      const eq = body.indexOf('=');
      const key = eq >= 0 ? body.slice(0, eq) : body;
      let value = eq >= 0 ? body.slice(eq + 1) : undefined;
      if (value === undefined) {
        const next = argv[index + 1];
        if (next !== undefined && !next.startsWith('-')) {
          value = next;
          index++;
        } else {
          value = true;
        }
      }
      result.flags[key] = value;
      continue;
    }
    if (token.length > 1 && token.startsWith('-')) {
      result.flags[token.slice(1)] = true;
      continue;
    }
    result._.push(token);
  }
  return result;
}

function boolFlag(flags, name, fallback) {
  if (flags['no-' + name] === true || flags[name] === false || flags[name] === 'false') return false;
  if (flags[name] === true || flags[name] === 'true') return true;
  return fallback;
}

module.exports = { parseArgv, boolFlag };
