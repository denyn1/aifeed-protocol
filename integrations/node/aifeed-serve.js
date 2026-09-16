'use strict';

/**
 * Framework-agnostic AIFeed server handler for Node.js (plain http, Express,
 * Connect, Fastify reply.raw, etc.).
 *
 * Usage (plain http):
 *   const http = require('node:http');
 *   const { createAifeedHandler } = require('./aifeed-serve');
 *   const handle = createAifeedHandler({ root: './public', mako: true });
 *   http.createServer((req, res) => {
 *     if (handle(req, res)) return;
 *     // your app here
 *     res.writeHead(404); res.end('not found');
 *   }).listen(8080);
 *
 * Usage (Express):
 *   app.use((req, res, next) => { if (!handle(req, res)) next(); });
 */

const fs = require('node:fs');
const path = require('node:path');

const MEDIA = {
  aimd: 'text/aifeed+markdown',
  mako: 'text/mako+markdown'
};

function parseFrontmatterFields(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const fields = {};
  if (!match) return fields;
  for (const line of match[1].split('\n')) {
    const keyValue = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!keyValue) continue;
    const key = keyValue[1];
    let value = keyValue[2].replace(/\s+#.*$/, '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (key === 'tokens') fields.tokens = Number(value);
    if (key === 'type' || key === 'language' || key === 'aimd' || key === 'mako') fields[key] = value;
  }
  return fields;
}

function safeJoin(root, relative) {
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

function createAifeedHandler(options = {}) {
  const root = path.resolve(options.root || '.');
  const wellKnownDir = path.join(root, '.well-known');
  const aimdEnabled = options.aimd !== false;
  const makoEnabled = options.mako === true;
  const llmsPath = safeJoin(root, 'llms.txt');
  const verbose = options.verbose === true;

  function serveFile(req, res, filePath, contentType, cacheSeconds) {
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (error) {
      return false;
    }
    if (!stat.isFile()) return false;
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=' + (cacheSeconds || 3600) + ', must-revalidate'
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return true;
    }
    res.end(fs.readFileSync(filePath));
    return true;
  }

  return function handle(req, res) {
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') return false;
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (error) {
      return false;
    }

    const wellKnownFiles = [
      ['/.well-known/ai.json', 'ai.json', aimdEnabled || makoEnabled],
      ['/.well-known/ai-signature.json', 'ai-signature.json', aimdEnabled || makoEnabled],
      ['/.well-known/aifeed-index.json', 'aifeed-index.json', aimdEnabled],
      ['/.well-known/aifeed-index.json.sig', 'aifeed-index.json.sig', aimdEnabled],
      ['/.well-known/mako-index.json', 'mako-index.json', makoEnabled],
      ['/.well-known/mako-index.json.sig', 'mako-index.json.sig', makoEnabled]
    ];
    for (const [route, file, enabled] of wellKnownFiles) {
      if (pathname !== route) continue;
      if (!enabled) return false;
      if (serveFile(req, res, path.join(wellKnownDir, file), 'application/json; charset=utf-8', 3600)) return true;
      return false;
    }
    if (pathname === '/llms.txt' && llmsPath) {
      if (serveFile(req, res, llmsPath, 'text/plain; charset=utf-8', 3600)) return true;
    }

    const accept = String(req.headers.accept || '');
    let profile = null;
    if (accept.includes(MEDIA.aimd) && aimdEnabled) profile = 'aimd';
    else if (accept.includes(MEDIA.mako) && makoEnabled) profile = 'mako';
    if (profile === null) return false;

    const suffix = profile === 'mako' ? '.mako.md' : '.aifeed.md';
    const cleanPath = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    const candidates = cleanPath === ''
      ? ['index' + suffix]
      : [cleanPath + suffix, cleanPath + '/index' + suffix];
    let mdPath = null;
    let body = null;
    for (const candidate of candidates) {
      const resolved = safeJoin(root, candidate);
      if (resolved === null) continue;
      try {
        body = fs.readFileSync(resolved);
        mdPath = resolved;
        break;
      } catch (error) {
        // try the next candidate
      }
    }
    if (process.env.AIFEED_DEBUG) {
      process.stderr.write('[aifeed-debug] candidates=' + candidates.join(',') + ' mdPath=' + mdPath + '\n');
    }
    if (mdPath === null) return false;

    const fields = parseFrontmatterFields(body.toString('utf8'));
    const headers = {
      'Content-Type': MEDIA[profile] + '; charset=utf-8',
      Vary: 'Accept',
      'X-Mako-Version': '1.0',
      'X-Mako-Tokens': String(Number.isFinite(fields.tokens) ? fields.tokens : ''),
      'X-Mako-Type': fields.type || 'custom',
      'X-Mako-Lang': fields.language || '',
      'X-Aifeed-Profile': profile,
      'Cache-Control': 'public, max-age=3600, must-revalidate'
    };
    const signatureName = mdPath + '.sig';
    try {
      const containerText = fs.readFileSync(signatureName, 'utf8').trim();
      headers['X-Aifeed-Signature'] = (profile === 'mako' ? 'mako1:' : 'aimd1:') +
        Buffer.from(containerText, 'utf8').toString('base64url');
    } catch (error) {
      // unsigned documents are allowed; manifest policy decides trust
    }
    if (verbose) process.stderr.write('[aifeed] served ' + profile + ' ' + mdRelative + '\n');
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return true;
    }
    res.end(body);
    return true;
  };
}

module.exports = { createAifeedHandler, parseFrontmatterFields };
