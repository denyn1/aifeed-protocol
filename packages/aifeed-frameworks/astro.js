'use strict';

const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { runBuild } = require('./index');

function outDirOf(dir) {
  if (dir && typeof dir === 'object' && typeof dir.href === 'string') return fileURLToPath(dir);
  if (typeof dir === 'string') {
    if (dir.startsWith('file://')) return fileURLToPath(dir);
    return dir;
  }
  return path.resolve(process.cwd(), 'dist');
}

function aifeed(options = {}) {
  return {
    name: 'aifeed',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const log = logger && typeof logger.info === 'function' ? (message) => logger.info(message) : undefined;
        return runBuild(options, {
          root: process.cwd(),
          outDir: outDirOf(dir),
          logger: log
        });
      }
    }
  };
}

module.exports = aifeed;
module.exports.aifeed = aifeed;
