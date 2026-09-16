#!/usr/bin/env node
'use strict';

// Live conformance check for the deployed demo origins. Uses the SDK against the
// real internet, so it is a separate gate: `npm run verify:live`.

const dns = require('node:dns');
const https = require('node:https');
const sdk = require('../packages/aifeed-verify');
const { verifyRevocationDocument } = require('../lib/revocation');
const siteDefinitions = require('../demos/sites');
const keys = require('../demos/keys');

// Public resolvers keep the check stable on machines with stale local DNS caches.
dns.setServers((process.env.AIFEED_LIVE_RESOLVERS || '1.1.1.1,8.8.8.8').split(',').map((value) => value.trim()));

function caresLookup(hostname, options, callback) {
  dns.resolve4(hostname, (error, addresses) => {
    if (error || !addresses || addresses.length === 0) {
      callback(error || new Error('no addresses for ' + hostname));
      return;
    }
    const sorted = addresses.slice().sort();
    if (options && options.all) callback(null, sorted.map((address) => ({ address, family: 4 })));
    else callback(null, sorted[0], 4);
  });
}

const originalLookup = dns.promises.lookup.bind(dns.promises);
dns.promises.lookup = async (hostname, options = {}) => {
  try {
    const addresses = (await dns.promises.resolve4(hostname)).slice().sort();
    if (addresses.length === 0) throw new Error('no addresses');
    if (options.all) return addresses.map((address) => ({ address, family: 4 }));
    return { address: addresses[0], family: 4 };
  } catch (error) {
    return originalLookup(hostname, options);
  }
};

function rawGet(urlString, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const request = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'GET',
        headers,
        lookup: caresLookup,
        servername: url.hostname
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode, headers: response.headers }));
      }
    );
    request.on('error', reject);
    request.end();
  });
}

const TRAINING_UA = 'GPTBot/1.0';
const CRAWLER_UA = 'Scrapy/2.11';

async function checkOrigin(domain) {
  const report = { domain, steps: {}, errors: [] };
  const base = 'https://' + domain;
  try {
    const discovery = await sdk.discoverManifestUrl(base);
    report.steps.discovery = discovery.manifestUrl;
    const manifestResponse = await sdk.fetchText(discovery.manifestUrl);
    const signatureResponse = await sdk.fetchText(discovery.manifestUrl.replace(/ai\.json$/, 'ai-signature.json'));
    const verified = sdk.verifyAll({
      manifestText: manifestResponse.text,
      manifestBytes: manifestResponse.buffer,
      signatureText: signatureResponse.text,
      domain
    });
    report.steps.manifest = verified.result;
    if (verified.result !== 'VERIFIED') {
      report.errors.push('manifest ' + verified.result + ': ' + JSON.stringify((verified.errors || []).slice(0, 2)));
      return report;
    }
    const publicKey = verified.manifest.identity.public_key;

    try {
      const anchors = await sdk.lookupAifeedTxt(domain);
      const records = Array.isArray(anchors) ? anchors : [];
      const match = records.some((record) => record && record.pk === publicKey);
      report.steps.anchor = records.length === 0 ? 'missing' : match ? 'present (key matches)' : 'present (key mismatch)';
      if (records.length === 0) report.errors.push('DNS anchor missing for ' + domain);
      else if (!match) report.errors.push('DNS anchor key mismatch for ' + domain);
    } catch (error) {
      report.steps.anchor = 'error: ' + error.message;
      report.errors.push('anchor lookup failed: ' + error.message);
    }

    const page = await sdk.fetchAimd(base + '/', { publicKeyValue: publicKey });
    report.steps.content = page.content_type + ' · ' + page.bytes + ' bytes · signature ' + (page.mako_verified ? 'verified' : 'not verified');
    if (!page.mako_verified) report.errors.push('page signature not verified');

    const indexUrl = 'https://' + domain + '/.well-known/aifeed-index.json';
    const delta = await sdk.fetchIndexDelta(indexUrl, {});
    report.steps.index = delta.entries.length + ' entries';
    if (!delta.ok) report.errors.push('index invalid');

    const revocationUrl = verified.manifest.revocation && verified.manifest.revocation.list_url;
    if (revocationUrl) {
      const document = await sdk.fetchText(revocationUrl);
      const revocation = verifyRevocationDocument(document.text, {
        domain,
        governanceKeys: keys.governance.map((item) => item.publicKey)
      });
      report.steps.revocation = revocation.status + ' (' + revocation.result + ')';
      if (revocation.result !== 'valid') report.errors.push('revocation ' + revocation.result);
    }
  } catch (error) {
    report.errors.push(error.message);
  }
  return report;
}

async function checkStrictEnforcement(domain) {
  const report = { domain, steps: {}, errors: [] };
  async function probe(userAgent, accept, label, expected) {
    try {
      const response = await rawGet('https://' + domain + '/', { 'user-agent': userAgent, accept });
      report.steps[label] = response.status;
      if (response.status !== expected) report.errors.push(label + ' expected ' + expected + ', got ' + response.status);
    } catch (error) {
      report.errors.push(label + ' failed: ' + error.message);
    }
  }
  await probe(TRAINING_UA, '*/*', 'training', 403);
  await probe(CRAWLER_UA, '*/*', 'crawler', 429);
  await probe('Mozilla/5.0 (demo)', 'text/aifeed+markdown', 'compliant', 200);
  await probe('Mozilla/5.0 (demo)', 'text/html', 'human', 200);
  return report;
}

async function main() {
  const json = process.argv.includes('--json');
  const origins = siteDefinitions.map((site) => site.domain).concat(['aifeed.md']);
  const reports = [];
  for (const domain of origins) {
    const report = await checkOrigin(domain);
    if (domain === 'strict.aifeed.md') {
      const enforcement = await checkStrictEnforcement(domain);
      report.steps.enforcement = enforcement.steps;
      report.errors.push(...enforcement.errors);
    }
    reports.push(report);
    if (!json) {
      process.stdout.write((report.errors.length === 0 ? 'PASS ' : 'FAIL ') + domain + '\n');
      for (const [key, value] of Object.entries(report.steps)) process.stdout.write('  ' + key + ': ' + value + '\n');
      for (const error of report.errors) process.stderr.write('  ! ' + error + '\n');
    }
  }
  if (json) process.stdout.write(JSON.stringify(reports, null, 2) + '\n');
  const failed = reports.filter((report) => report.errors.length > 0).length;
  process.stdout.write('verify:live — origins: ' + reports.length + ', failures: ' + failed + '\n');
  process.exitCode = failed > 0 ? 1 : 0;
}

module.exports = { checkOrigin, checkStrictEnforcement };

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write('verify:live failed: ' + error.message + '\n');
    process.exitCode = 2;
  });
}
