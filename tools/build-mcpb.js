#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const PKG_DIR = path.join(ROOT, 'packages', 'aifeed-mcp-server');
const STAGE = path.join(ROOT, 'build', 'mcpb');
const BUNDLE = path.join(ROOT, 'build', 'aifeed-mcp-server.mcpb');
const SERVER_ENTRIES = ['index.js', 'lib', 'schema', 'LICENSE'];

function manifestFor(pkg, server) {
  if (pkg.version !== server.version) {
    throw new Error('package.json version ' + pkg.version + ' does not match server.json version ' + server.version);
  }
  return {
    manifest_version: '0.3',
    name: pkg.name,
    display_name: 'AIFeed',
    version: pkg.version,
    description: server.description,
    author: {
      name: 'denyn1',
      url: 'https://aifeed.md'
    },
    repository: {
      type: 'git',
      url: 'https://github.com/denyn1/aifeed-protocol'
    },
    homepage: 'https://aifeed.md',
    license: pkg.license,
    keywords: pkg.keywords,
    compatibility: {
      runtimes: { node: pkg.engines.node }
    },
    user_config: {
      allow_private: {
        type: 'string',
        title: 'Allow loopback URLs',
        description: 'Set to 1 to allow http:// loopback origins during local testing (default 0).',
        default: '0',
        required: false
      }
    },
    server: {
      type: 'node',
      entry_point: 'server/index.js',
      mcp_config: {
        command: 'node',
        args: ['${__dirname}/server/index.js'],
        env: {
          AIFEED_MCP_ALLOW_PRIVATE: '${user_config.allow_private}'
        }
      }
    }
  };
}

function copyEntry(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      copyEntry(path.join(from, name), path.join(to, name));
    }
    return;
  }
  fs.copyFileSync(from, to);
}

function stage() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
  const server = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'server.json'), 'utf8'));
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(path.join(STAGE, 'server'), { recursive: true });
  for (const name of SERVER_ENTRIES) {
    copyEntry(path.join(PKG_DIR, name), path.join(STAGE, 'server', name));
  }
  fs.writeFileSync(path.join(STAGE, 'manifest.json'), JSON.stringify(manifestFor(pkg, server), null, 2) + '\n');
  return manifestFor(pkg, server);
}

function runMcpb(args) {
  const mcpbArgs = ['--yes', '@anthropic-ai/mcpb', ...args];
  const isWin = process.platform === 'win32';
  const result = isWin
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx', ...mcpbArgs], { stdio: 'inherit' })
    : spawnSync('npx', mcpbArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('mcpb ' + args[0] + ' failed with status ' + result.status);
  }
}

function main() {
  const manifest = stage();
  process.stdout.write('mcpb: staged ' + path.relative(ROOT, STAGE) + ' (v' + manifest.version + ')\n');
  runMcpb(['validate', STAGE]);
  runMcpb(['pack', STAGE, BUNDLE]);
  const size = fs.statSync(BUNDLE).size;
  process.stdout.write('mcpb: ' + path.relative(ROOT, BUNDLE) + ' (' + size + ' bytes)\n');
}

module.exports = { manifestFor, stage };

if (require.main === module) {
  main();
}
