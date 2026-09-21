#!/usr/bin/env node
'use strict';

const { runBuild } = require('./index');
const { parseArgv, boolFlag } = require('./cli-args');

const USAGE = [
  'usage: aifeed-next [--dir out] --domain D [options]',
  '',
  'Runs after "next build" (output: "export"); signs the exported directory.',
  'Add to package.json: "postbuild": "aifeed-next --domain example.com"',
  '',
  'options: --domain --key --dir --base-url --profile --name --type --locale',
  '         --no-inject --no-llms --no-prune --no-verify --json'
].join('\n');

function main(argv = process.argv.slice(2)) {
  const args = parseArgv(argv);
  if (args.flags.help === true || args.flags.h === true) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  const dir = args.flags.dir || 'out';
  try {
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
        pages: summary.pages,
        fingerprint: summary.fingerprint,
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
