const MEDIA = {
  aimd: 'text/aifeed+markdown',
  mako: 'text/mako+markdown'
};

const SUFFIX = {
  aimd: '.aifeed.md',
  mako: '.mako.md'
};

export function negotiateTarget(pathname, accept) {
  const wantsAimd = accept.includes(MEDIA.aimd);
  const wantsMako = accept.includes(MEDIA.mako);
  if (!wantsAimd && !wantsMako) return null;
  const lastSegment = pathname.split('/').pop();
  const hasExtension = /\.[A-Za-z0-9]+$/.test(lastSegment);
  if (hasExtension && !pathname.endsWith('.html')) return null;
  const profile = wantsAimd ? 'aimd' : 'mako';
  const base = pathname === '/'
    ? '/index'
    : pathname.endsWith('/')
      ? pathname + 'index'
      : pathname.replace(/\.html$/, '');
  const alt = pathname.endsWith('/') ? null : base + '/index' + SUFFIX[profile];
  return { profile, target: base + SUFFIX[profile], alt, mediaType: MEDIA[profile] };
}

function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return env.ASSETS.fetch(request);
    }
    const url = new URL(request.url);
    const target = negotiateTarget(url.pathname, String(request.headers.get('accept') || ''));
    if (target) {
      let response = await env.ASSETS.fetch(new Request(new URL(target.target, url), request));
      let resolved = target.target;
      if (!response.ok && target.alt) {
        const altResponse = await env.ASSETS.fetch(new Request(new URL(target.alt, url), request));
        if (altResponse.ok) {
          response = altResponse;
          resolved = target.alt;
        }
      }
      if (response.ok) {
        const headers = new Headers(response.headers);
        headers.set('content-type', target.mediaType + '; charset=utf-8');
        headers.set('vary', 'accept');
        headers.set('x-aifeed-profile', target.profile);
        const signature = await env.ASSETS.fetch(new Request(new URL(resolved + '.sig', url), request));
        if (signature.ok) {
          headers.set('x-aifeed-signature', target.profile + '1:' + base64UrlEncode(await signature.text()));
        }
        return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
