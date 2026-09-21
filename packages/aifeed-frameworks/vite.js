'use strict';

const path = require('node:path');
const { runBuild } = require('./index');

function aifeed(options = {}) {
  let root = process.cwd();
  let outDir = 'dist';
  return {
    name: 'aifeed',
    apply: 'build',
    configResolved(config) {
      root = (config && config.root) || process.cwd();
      outDir = (config && config.build && config.build.outDir) || 'dist';
    },
    closeBundle() {
      const target = path.isAbsolute(outDir) ? outDir : path.resolve(root, outDir);
      return runBuild(options, { root, outDir: target });
    }
  };
}

module.exports = aifeed;
module.exports.aifeed = aifeed;
