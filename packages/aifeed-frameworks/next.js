'use strict';

function withAifeed(nextConfig = {}, options = {}) {
  if (nextConfig.output !== 'export') {
    console.warn('AIFeed: next.config output is "' + (nextConfig.output || 'default') +
      '"; AIFeed signs the static export directory. Set output: "export" and add ' +
      '"postbuild": "aifeed-next" to package.json (domain: ' + (options.domain || process.env.AIFEED_DOMAIN || 'unset') + ').');
  }
  return nextConfig;
}

module.exports = withAifeed;
module.exports.withAifeed = withAifeed;
