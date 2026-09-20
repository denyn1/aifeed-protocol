// Cloudflare Pages Function: routes demo subdomains to their generated origins,
// negotiates signed markdown, adds CORS for the browser verifier, and simulates
// edge enforcement for the `strict` origin. The apex falls through to static
// assets after the same content negotiation.

const DEMO_HOSTS = new Set(
  ['demo', 'news', 'shop', 'gov', 'strict', 'revoked', 'verify'].map((sub) => sub + '.aifeed.md')
);

const TRAINING_UA = /GPTBot|CCBot|Google-Extended|anthropic-ai|ClaudeBot|Bytespider|Amazonbot|Applebot-Extended|Meta-ExternalAgent|cohere-ai|PerplexityBot|Omgilibot|Diffbot/i;
const CRAWLER_UA = /Scrapy|python-requests|python-urllib|aiohttp|httpx|Go-http-client|curl\/|Wget|libwww|node-fetch|axios|okhttp|Java\/|Apache-HttpClient|FacebookBot/i;

export function demoSub(host) {
  if (typeof host !== 'string') return null;
  const normalized = host.toLowerCase().split(':')[0];
  return DEMO_HOSTS.has(normalized) ? normalized.split('.')[0] : null;
}

export function strictDecision(input) {
  const accept = String((input && input.accept) || '');
  const ua = String((input && input.ua) || '');
  if (/text\/(aifeed|mako)\+markdown/.test(accept)) return null;
  if (accept.includes('text/html')) return null;
  if (TRAINING_UA.test(ua)) {
    return {
      status: 403,
      body: {
        error: 'training_not_permitted',
        manifest: 'https://strict.aifeed.md/.well-known/ai.json',
        hint: 'The signed manifest denies training for this origin.'
      }
    };
  }
  if (CRAWLER_UA.test(ua)) {
    return {
      status: 429,
      retryAfter: 60,
      body: {
        error: 'rate_limited',
        hint: 'Negotiate text/aifeed+markdown and read the signed manifest before retrying.'
      }
    };
  }
  return null;
}

function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function withCommonHeaders(response, host) {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-headers', 'accept, content-type');
  headers.set('access-control-expose-headers', 'x-aifeed-profile, x-aifeed-signature, retry-after');
  headers.set('vary', 'accept');
  headers.set('x-aifeed-origin', host);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function jsonResponse(status, body, host, retryAfter) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'x-aifeed-origin': host
  };
  if (retryAfter) headers['retry-after'] = String(retryAfter);
  return new Response(JSON.stringify(body) + '\n', { status, headers });
}

export async function negotiate(request, env, prefix, pathname, accept, host) {
  const wantsAimd = accept.includes('text/aifeed+markdown');
  const wantsMako = accept.includes('text/mako+markdown');
  if (!wantsAimd && !wantsMako) return null;
  const lastSegment = pathname.split('/').pop();
  const hasExtension = /\.[A-Za-z0-9]+$/.test(lastSegment);
  if (hasExtension && !pathname.endsWith('.html')) return null;
  const suffix = wantsAimd ? '.aifeed.md' : '.mako.md';
  const context = wantsAimd ? 'aimd' : 'mako';
  const mediaType = wantsAimd ? 'text/aifeed+markdown' : 'text/mako+markdown';
  const basePath = pathname.endsWith('/') ? pathname + 'index' : pathname.replace(/\.html$/, '');
  let mdPath = prefix + basePath + suffix;
  let mdResponse = await env.ASSETS.fetch(new Request(new URL(mdPath, request.url).toString(), request));
  if (!mdResponse.ok && !pathname.endsWith('/')) {
    const altPath = prefix + basePath + '/index' + suffix;
    const altResponse = await env.ASSETS.fetch(new Request(new URL(altPath, request.url).toString(), request));
    if (altResponse.ok) {
      mdPath = altPath;
      mdResponse = altResponse;
    }
  }
  if (!mdResponse.ok) return null;
  const headers = new Headers(mdResponse.headers);
  headers.set('content-type', mediaType + '; charset=utf-8');
  headers.set('x-aifeed-profile', context);
  headers.set('vary', 'accept');
  const signature = await env.ASSETS.fetch(new Request(new URL(mdPath + '.sig', request.url).toString(), request));
  if (signature.ok) {
    headers.set('x-aifeed-signature', context + '1:' + base64UrlEncode(await signature.text()));
  }
  return withCommonHeaders(new Response(mdResponse.body, { status: 200, headers }), host);
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const host = (request.headers.get('host') || url.hostname).toLowerCase();
  const sub = demoSub(host);
  const accept = request.headers.get('accept') || '';
  const prefix = sub ? '/demos/' + sub : '';

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!sub) return next();
    return jsonResponse(405, { error: 'method_not_allowed' }, host);
  }

  if (sub === 'strict') {
    const decision = strictDecision({
      accept,
      ua: request.headers.get('user-agent') || ''
    });
    if (decision) return jsonResponse(decision.status, decision.body, host, decision.retryAfter);
  }

  const negotiated = await negotiate(request, env, prefix, url.pathname, accept, host);
  if (negotiated) return negotiated;

  if (!sub) {
    const response = await next();
    if (url.pathname.startsWith('/.well-known/') || url.pathname === '/llms.txt' || /\.(aifeed|mako)\.md(\.sig)?$/.test(url.pathname)) {
      return withCommonHeaders(response, host);
    }
    return response;
  }

  const assetUrl = new URL(request.url);
  assetUrl.pathname = prefix + url.pathname;
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));

  if (assetResponse.status >= 300 && assetResponse.status < 400) {
    const location = assetResponse.headers.get('location');
    if (location) {
      const target = new URL(location, assetUrl);
      const headers = new Headers(assetResponse.headers);
      const publicPath = target.pathname.startsWith(prefix) ? target.pathname.slice(prefix.length) || '/' : target.pathname;
      headers.set('location', publicPath + target.search);
      return withCommonHeaders(new Response(null, { status: assetResponse.status, headers }), host);
    }
  }

  if (assetResponse.status === 404) {
    const notFoundUrl = new URL(prefix + '/404.html', url);
    const notFound = await env.ASSETS.fetch(new Request(notFoundUrl.toString(), request));
    return withCommonHeaders(new Response(notFound.body, { status: 404, headers: notFound.headers }), host);
  }
  return withCommonHeaders(assetResponse, host);
}
