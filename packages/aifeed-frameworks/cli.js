#!/usr/bin/env node
'use strict';

const { runBuild, keygen } = require('./index');
const { parseArgv, boolFlag } = require('./cli-args');

const USAGE = [
  'usage: aifeed-build [build] <DIR> --domain D [options]',
  '',
  'options:',
  '  --domain D        origin domain (or AIFEED_DOMAIN)',
  '  --key FILE        private key PEM (default aifeed-private.pem, or AIFEED_KEY)',
  '  --base-url URL    absolute base URL (default https://D)',
  '  --profile P       aimd | mako | both (default aimd)',
  '  --name N          site name (default domain)',
  '  --type T          site type (default blog)',
  '  --locale L        primary language tag (default en)',
  '  --no-inject       do not add <link rel="alternate"> to HTML',
  '  --no-llms         do not write llms.txt',
  '  --no-prune        keep generated files from previous builds',
  '  --no-verify       skip post-build self-verification',
  '  --json            machine-readable summary',
  '',
  'usage: aifeed-build keygen [--out DIR] [--force] [--json]'
].join('\n');

function main(argv = process.argv.slice(2)) {
  const args = parseArgv(argv);
  const command = args._[0] === 'keygen' || args._[0] === 'build' ? args._.shift() : 'build';

  if (args.flags.help === true || args.flags.h === true || (command === 'build' && args._.length === 0)) {
    process.stdout.write(USAGE + '\n');
    return command === 'build' && args._.length === 0 && args.flags.help !== true ? 2 : 0;
  }

  try {
    if (command === 'keygen') {
      const result = keygen({ out: args.flags.out, force: args.flags.force === true });
      if (args.flags.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      else {
        process.stdout.write('private key: ' + result.private_key + '\n');
        process.stdout.write('public key : ' + result.public_key + '\n');
        process.stdout.write('fingerprint: ' + result.fingerprint + '\n');
      }
      return 0;
    }

    const dir = args._[0];
    if (!dir) {
      process.stderr.write(USAGE + '\n');
      return 2;
    }
    const summary = runBuild({
      domain: args.flags.domain,
      keyPath: args.flags.key,
      outDir: dir,
      baseUrl: args.flags['base-url'],
      name: args.flags.name,
      description: args.flags.description,
      type: args.flags.type,
      locale: args.flags.locale,
      contact: args.flags.contact,
      keyId: args.flags['key-id'],
      profile: args.flags.profile,
      inject: boolFlag(args.flags, 'inject', true),
      llms: boolFlag(args.flags, 'llms', true),
      prune: boolFlag(args.flags, 'prune', true),
      verifyAfter: boolFlag(args.flags, 'verify', true),
      updated: args.flags.updated,
      log: !args.flags.json
    }, { root: process.cwd(), outDir: dir });
    if (args.flags.json) {
      process.stdout.write(JSON.stringify({
        dir: summary.dir,
        profile: summary.profile,
        domain: summary.domain,
        baseUrl: summary.baseUrl,
        fingerprint: summary.fingerprint,
        pages: summary.pages,
        index: summary.index,
        manifest: summary.manifest,
        llms: summary.llms,
        warnings: summary.warnings
      }, null, 2) + '\n');
    }
    return 0;
  } catch (error) {
    process.stderr.write(error.message + '\n');
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { main, USAGE };
