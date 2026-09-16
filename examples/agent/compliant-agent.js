#!/usr/bin/env node
'use strict';

const sdk = require('../../packages/aifeed-verify');

function signatureUrlFor(manifestUrl) {
  if (/ai\.json$/.test(manifestUrl)) return manifestUrl.replace(/ai\.json$/, 'ai-signature.json');
  return manifestUrl + '.sig';
}

async function assess(options = {}) {
  const baseUrl = String(options.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error('baseUrl is required');
  const domain = options.domain || new URL(baseUrl).hostname;
  const use = options.use || 'retrieval';
  const pagePath = options.pagePath || '/';
  const shouldFetch = options.fetch === true;
  const fetchOptions = options.fetchOptions || {};

  let discovery;
  try {
    discovery = await sdk.discoverManifestUrl(baseUrl, fetchOptions);
  } catch (error) {
    return { status: 'NO_DECLARATION', domain, use, decision: { allowed: false, attribution: null, reason: 'no_declaration' }, training: { allowed: false, attribution: null, reason: 'no_declaration' }, discovery: null, errors: [{ code: 'discovery_failed', message: error.message }], warnings: [] };
  }

  let manifestResponse;
  let signatureResponse;
  try {
    manifestResponse = await sdk.fetchText(discovery.manifestUrl, fetchOptions);
    signatureResponse = await sdk.fetchText(signatureUrlFor(discovery.manifestUrl), fetchOptions);
  } catch (error) {
    return { status: 'NO_DECLARATION', domain, use, decision: { allowed: false, attribution: null, reason: 'no_declaration' }, training: { allowed: false, attribution: null, reason: 'no_declaration' }, discovery, errors: [{ code: 'declaration_unreachable', message: error.message }], warnings: [] };
  }

  const verified = sdk.verifyAll({
    manifestText: manifestResponse.text,
    manifestBytes: manifestResponse.buffer,
    signatureText: signatureResponse.text,
    domain
  });

  const permissions = verified.manifest && verified.manifest.permissions ? verified.manifest.permissions : null;
  const decision = permissions ? sdk.decideUsage(permissions, use) : { allowed: false, attribution: null, reason: 'no_permissions' };
  const training = permissions ? sdk.decideUsage(permissions, 'training') : { allowed: false, attribution: null, reason: 'no_permissions' };
  const indexUrl = verified.manifest && verified.manifest.content ? verified.manifest.content.index_url : null;

  let content = null;
  if (shouldFetch && decision.allowed && verified.result === 'VERIFIED') {
    const publicKeyValue = verified.manifest.identity.public_key;
    const pageUrl = baseUrl + (pagePath.startsWith('/') ? pagePath : '/' + pagePath);
    content = await sdk.fetchAimd(pageUrl, { ...fetchOptions, publicKeyValue });
    if (!content.mako) content = await sdk.fetchMako(pageUrl, { ...fetchOptions, publicKeyValue });
  }

  return {
    status: verified.result,
    domain,
    use,
    decision,
    training,
    indexUrl,
    content,
    discovery,
    errors: verified.errors,
    warnings: verified.warnings
  };
}

function printReport(report) {
  const lines = [];
  lines.push('AIFeed check — ' + report.domain);
  lines.push('discovery : ' + (report.discovery ? report.discovery.manifestUrl + ' (' + report.discovery.discoveredVia + ')' : 'none'));
  lines.push('verify    : ' + report.status + (report.errors && report.errors.length ? ' (' + report.errors.length + ' errors)' : ''));
  lines.push('use       : ' + report.use + ' → ' + (report.decision.allowed ? 'allowed' : 'denied') + (report.decision.attribution ? ' (attribution ' + report.decision.attribution + ')' : ''));
  lines.push('training  : ' + (report.training.allowed ? 'allowed' : 'denied'));
  if (report.indexUrl) lines.push('index     : ' + report.indexUrl);
  if (report.content) {
    lines.push('content   : ' + report.content.content_type + ' · ' + report.content.bytes + ' bytes · tokens=' + report.content.tokens + ' · signature ' + (report.content.mako_verified ? 'verified' : 'not verified'));
  }
  if (report.status === 'UNVERIFIED' && report.errors) {
    for (const error of report.errors.slice(0, 5)) lines.push('  error: ' + error.code + ' — ' + error.message);
  }
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((arg) => !arg.startsWith('--'));
  if (!url) {
    process.stderr.write('usage: node examples/agent/compliant-agent.js <url> [--use KEY] [--page /path] [--fetch] [--domain TLD] [--json]\n');
    process.exitCode = 2;
    return;
  }
  const valueOf = (flag) => {
    const index = args.indexOf(flag);
    return index === -1 ? null : args[index + 1];
  };
  const options = {
    baseUrl: url,
    use: valueOf('--use') || 'retrieval',
    pagePath: valueOf('--page') || '/',
    domain: valueOf('--domain') || undefined,
    fetch: args.includes('--fetch')
  };
  const report = await assess(options);
  if (args.includes('--json')) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else process.stdout.write(printReport(report) + '\n');
  process.exitCode = report.status === 'VERIFIED' ? 0 : 1;
}

module.exports = { assess, printReport };

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write('fatal: ' + error.message + '\n');
    process.exitCode = 2;
  });
}
