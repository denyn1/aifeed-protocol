'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const http = require('node:http');
const https = require('node:https');
const { resolvePinnedAddress } = require('../../lib/remote');
const { sha256Base64 } = require('../../lib/digest');

const USER_AGENT = 'AIFeedStudio/0.1 (+https://aifeed.md)';
const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const PAGE_EXTENSIONS_BLOCK = /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|json|xml|rss|atom|pdf|zip|gz|tgz|tar|rar|7z|mp4|webm|mov|mp3|wav|ogg|woff2?|ttf|eot|exe|dmg|apk)$/i;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function decodeBody(buffer, headers) {
  const encoding = String(headers['content-encoding'] || 'identity').toLowerCase();
  if (encoding === 'gzip' || (buffer[0] === 0x1f && buffer[1] === 0x8b)) return zlib.gunzipSync(buffer);
  if (encoding === 'deflate') return zlib.inflateSync(buffer);
  if (encoding === 'br') return zlib.brotliDecompressSync(buffer);
  return buffer;
}

function normalizeOrigin(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('origin must be https://');
  return url.origin;
}

function normalizePath(urlPath) {
  const clean = String(urlPath || '/').split('#')[0];
  if (clean === '') return '/';
  const [pathPart, query] = clean.split('?');
  const withQuery = query ? pathPart + '?' + query : pathPart;
  if (withQuery.length > 1 && withQuery.endsWith('/')) return withQuery.slice(0, -1);
  return withQuery;
}

function pagePathFromUrl(url) {
  return normalizePath(url.pathname + (url.search || ''));
}

function outputBaseFor(urlPath) {
  const clean = String(urlPath || '/').split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '');
  return clean === '' ? 'index' : clean;
}

function fetchPage(urlString, options = {}, redirects = 0) {
  const allowPrivate = Boolean(options.allowPrivate);
  const parsed = new URL(urlString);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && allowPrivate)) {
    return Promise.reject(new Error('only https origins are supported (http only for loopback tests)'));
  }
  const transport = parsed.protocol === 'https:' ? https : http;
  return resolvePinnedAddress(parsed.hostname, { allowPrivate }).then((pinned) => new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const request = transport.request(parsed, {
      method: 'GET',
      timeout: options.timeout || DEFAULT_TIMEOUT,
      lookup: (hostname, lookupOptions, callback) => {
        if (lookupOptions && lookupOptions.all) {
          callback(null, [pinned]);
        } else {
          callback(null, pinned.address, pinned.family);
        }
      },
      headers: {
        'user-agent': options.userAgent || USER_AGENT,
        accept: options.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        ...(options.headers || {})
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (redirects >= MAX_REDIRECTS) {
          response.resume();
          fail(new Error('too many redirects'));
          return;
        }
        const target = new URL(response.headers.location, parsed);
        if (target.origin !== parsed.origin) {
          response.resume();
          fail(new Error('cross-origin redirect refused: ' + target.origin));
          return;
        }
        response.resume();
        settled = true;
        resolve(fetchPage(target.toString(), options, redirects + 1));
        return;
      }
      const chunks = [];
      let total = 0;
      const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
      response.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          request.destroy(new Error('response exceeds ' + maxBytes + ' bytes'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (settled) return;
        settled = true;
        let body;
        try {
          body = decodeBody(Buffer.concat(chunks), response.headers);
        } catch (error) {
          fail(new Error('cannot decode response body: ' + error.message));
          return;
        }
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body,
          text: body.toString('utf8'),
          url: parsed.toString()
        });
      });
      response.on('error', fail);
    });
    request.on('timeout', () => request.destroy(new Error('request timed out')));
    request.on('error', fail);
    request.end();
  }));
}

function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (current && current.rules.length > 0) {
        groups.push(current);
        current = null;
      }
      if (!current) current = { agents: [], rules: [] };
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    if (field === 'disallow' || field === 'allow') {
      current.rules.push({ allow: field === 'allow', path: value });
    } else if (field === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelay = seconds;
    }
  }
  if (current && current.rules.length > 0) groups.push(current);
  return groups;
}

function robotsFor(groups, userAgent) {
  const token = String(userAgent).toLowerCase();
  let best = null;
  let bestScore = -1;
  for (const group of groups) {
    for (const agent of group.agents) {
      if (agent === '*') {
        if (bestScore < 0) {
          best = group;
          bestScore = 0;
        }
      } else if (token.includes(agent)) {
        if (agent.length > bestScore) {
          best = group;
          bestScore = agent.length;
        }
      }
    }
  }
  return best;
}

function robotsAllows(groups, userAgent, urlPath) {
  const group = robotsFor(groups, userAgent);
  if (!group) return true;
  let decision = true;
  let longest = -1;
  for (const rule of group.rules) {
    if (!rule.path || rule.path === '') continue;
    if (urlPath.startsWith(rule.path) && rule.path.length > longest) {
      longest = rule.path.length;
      decision = rule.allow;
    }
  }
  return decision;
}

function robotsCrawlDelay(groups, userAgent) {
  const group = robotsFor(groups, userAgent);
  return group && Number.isFinite(group.crawlDelay) ? group.crawlDelay : null;
}

function extractLocs(xml) {
  const locs = [];
  for (const match of String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    locs.push(match[1]);
  }
  return locs;
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  for (const match of String(html).matchAll(/<a\b[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    const href = match[2] !== undefined ? match[2] : match[3];
    if (!href || href.startsWith('#') || /^(mailto|javascript|tel|data):/i.test(href)) continue;
    try {
      links.add(new URL(href, baseUrl).toString());
    } catch (error) {
      // skip malformed URLs
    }
  }
  return [...links];
}

function matchesFilters(urlPath, filters) {
  for (const pattern of filters.exclude || []) {
    if (pattern && urlPath.startsWith(pattern.replace(/\*+$/, ''))) return false;
  }
  if (filters.include && filters.include.length > 0) {
    return filters.include.some((pattern) => urlPath.startsWith(String(pattern).replace(/\*+$/, '')));
  }
  return true;
}

function createLimiter(requestsPerSecond) {
  const interval = 1000 / Math.max(0.1, requestsPerSecond);
  let next = 0;
  return async function wait() {
    const now = Date.now();
    const at = Math.max(now, next);
    next = at + interval;
    if (at > now) await sleep(at - now);
  };
}

function loadCache(cacheDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cacheDir, 'crawl-index.json'), 'utf8'));
  } catch (error) {
    return {};
  }
}

function saveCache(cacheDir, cache) {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'crawl-index.json'), JSON.stringify(cache, null, 2) + '\n');
}

async function discoverFromSitemap(origin, options, stats, limit) {
  const discovered = [];
  const sitemapCandidates = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml'];
  const queue = sitemapCandidates.map((candidate) => origin + candidate);
  const seenSitemaps = new Set();
  while (queue.length > 0 && discovered.length < limit && seenSitemaps.size < 50) {
    const sitemapUrl = queue.shift();
    if (seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);
    let response;
    try {
      response = await fetchPage(sitemapUrl, options);
    } catch (error) {
      continue;
    }
    if (response.status !== 200) continue;
    const locs = extractLocs(response.text);
    if (locs.length === 0) continue;
    const looksLikeIndex = locs.every((loc) => /\.xml(\.gz)?$/i.test(loc));
    if (looksLikeIndex) {
      if (stats) stats.sitemaps += 1;
      for (const loc of locs.slice(0, 50)) queue.push(loc);
      continue;
    }
    for (const loc of locs) {
      discovered.push(loc);
      if (discovered.length >= limit) break;
    }
  }
  return discovered;
}

async function discoverFromLinks(origin, options, stats, limit, onProgress) {
  const discovered = [];
  const seen = new Set();
  const queue = [{ url: origin + '/', depth: 0 }];
  const maxDepth = options.maxDepth || 3;
  while (queue.length > 0 && discovered.length < limit) {
    const { url, depth } = queue.shift();
    const normalized = normalizePath(new URL(url).pathname + new URL(url).search);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    let response;
    try {
      response = await fetchPage(url, options);
    } catch (error) {
      continue;
    }
    if (response.status !== 200 || !/text\/html/i.test(String(response.headers['content-type'] || ''))) continue;
    discovered.push(url);
    if (stats) stats.fetchedDuringDiscovery += 1;
    if (onProgress) onProgress({ type: 'progress', phase: 'discover', done: discovered.length, total: limit, current: normalized });
    if (depth >= maxDepth) continue;
    for (const link of extractLinks(response.text, url)) {
      const parsed = new URL(link);
      if (parsed.origin !== origin) continue;
      const linkPath = pagePathFromUrl(parsed);
      if (PAGE_EXTENSIONS_BLOCK.test(linkPath)) continue;
      queue.push({ url: link, depth: depth + 1 });
    }
  }
  return discovered;
}

async function crawlSite(options) {
  const origin = normalizeOrigin(options.origin);
  const maxPages = Math.min(Math.max(options.maxPages || 500, 1), 50000);
  const requestsPerSecond = Math.min(Math.max(options.requestsPerSecond || 2, 0.1), 50);
  const concurrency = Math.min(Math.max(options.concurrency || 3, 1), 10);
  const allowPrivate = Boolean(options.allowPrivate);
  const respectRobots = options.respectRobots !== false;
  const cacheDir = path.resolve(options.cacheDir);
  const pagesDir = path.join(cacheDir, 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });

  const stats = { sitemap: false, sitemaps: 0, fetched: 0, unchanged: 0, skippedRobots: 0, errors: 0, fetchedDuringDiscovery: 0 };
  const fetchOptions = { allowPrivate, timeout: options.timeout, maxBytes: options.maxBytes };

  let robotsGroups = [];
  let crawlDelay = null;
  if (respectRobots) {
    try {
      const robotsResponse = await fetchPage(origin + '/robots.txt', { ...fetchOptions, accept: 'text/plain' });
      if (robotsResponse.status === 200) {
        robotsGroups = parseRobots(robotsResponse.text);
        crawlDelay = robotsCrawlDelay(robotsGroups, USER_AGENT);
      }
    } catch (error) {
      stats.robotsUnavailable = true;
    }
  }
  const effectiveRate = crawlDelay ? Math.min(requestsPerSecond, 1 / crawlDelay) : requestsPerSecond;

  let candidates = await discoverFromSitemap(origin, fetchOptions, stats, maxPages * 2);
  if (candidates.length > 0) {
    stats.sitemap = true;
  } else {
    candidates = await discoverFromLinks(origin, { ...fetchOptions, maxDepth: options.maxDepth }, stats, maxPages, options.onProgress);
  }

  const queue = [];
  const seen = new Set();
  for (const candidate of candidates) {
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch (error) {
      continue;
    }
    if (parsed.origin !== origin) continue;
    const urlPath = pagePathFromUrl(parsed);
    if (PAGE_EXTENSIONS_BLOCK.test(urlPath.split('?')[0])) continue;
    if (seen.has(urlPath)) continue;
    seen.add(urlPath);
    if (respectRobots && !robotsAllows(robotsGroups, USER_AGENT, urlPath)) {
      stats.skippedRobots += 1;
      continue;
    }
    if (!matchesFilters(urlPath, { include: options.include, exclude: options.exclude })) continue;
    queue.push({ url: candidate, urlPath });
    if (queue.length >= maxPages) break;
  }

  const cache = loadCache(cacheDir);
  const nextCache = { ...cache };
  const limiter = createLimiter(effectiveRate);
  const results = [];
  let position = 0;

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      await limiter();
      const previous = cache[item.urlPath];
      const headers = {};
      if (previous && previous.etag) headers['if-none-match'] = previous.etag;
      if (previous && previous.last_modified) headers['if-modified-since'] = previous.last_modified;
      try {
        const response = await fetchPage(item.url, { ...fetchOptions, headers });
        if (response.status === 304 && previous) {
          stats.unchanged += 1;
          results.push({ url: item.url, urlPath: item.urlPath, htmlPath: path.join(pagesDir, previous.file), html_sha256: previous.html_sha256, unchanged: true });
        } else if (response.status === 200 && /text\/html/i.test(String(response.headers['content-type'] || ''))) {
          const html_sha256 = sha256Base64(response.body);
          const fileName = html_sha256.slice('sha256:'.length).replace(/[^A-Za-z0-9_-]/g, '') + '.html';
          fs.writeFileSync(path.join(pagesDir, fileName), response.body);
          nextCache[item.urlPath] = {
            file: fileName,
            etag: response.headers.etag || null,
            last_modified: response.headers['last-modified'] || null,
            html_sha256,
            fetched_at: new Date().toISOString()
          };
          stats.fetched += 1;
          results.push({ url: item.url, urlPath: item.urlPath, htmlPath: path.join(pagesDir, fileName), html_sha256, unchanged: false });
        } else if (response.status !== 200) {
          stats.errors += 1;
        }
      } catch (error) {
        stats.errors += 1;
      }
      position += 1;
      if (options.onProgress && position % 10 === 0) {
        options.onProgress({ type: 'progress', phase: 'fetch', done: position, total: position + queue.length, current: item.urlPath });
      }
    }
  }

  const workers = [];
  for (let index = 0; index < concurrency; index++) workers.push(worker());
  await Promise.all(workers);
  saveCache(cacheDir, nextCache);

  if (options.onProgress) {
    options.onProgress({ type: 'progress', phase: 'fetch', done: position, total: position, current: '' });
  }

  return {
    origin,
    pages: results,
    stats: { ...stats, total: results.length, requested: candidates.length }
  };
}

module.exports = {
  crawlSite,
  fetchPage,
  parseRobots,
  robotsAllows,
  robotsCrawlDelay,
  extractLocs,
  extractLinks,
  outputBaseFor,
  normalizePath,
  pagePathFromUrl,
  USER_AGENT
};
