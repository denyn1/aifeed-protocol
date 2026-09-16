// AIFeed route handler for Next.js App Router (Node runtime).
// Place at app/api/aifeed/route.js and pair with ../middleware.js.

import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

const MEDIA = { aimd: 'text/aifeed+markdown', mako: 'text/mako+markdown' };
const PUBLIC_ROOT = path.join(process.cwd(), 'public');

function frontmatterField(text, key) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return '';
  for (const line of match[1].split('\n')) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (!kv || kv[1] !== key) continue;
    return kv[2].trim().replace(/\s+#.*$/, '').replace(/^"|"$/g, '');
  }
  return '';
}

function safeJoin(relative) {
  const target = path.resolve(PUBLIC_ROOT, relative);
  if (target !== PUBLIC_ROOT && !target.startsWith(PUBLIC_ROOT + path.sep)) return null;
  return target;
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const clean = (params.get('path') || '').replace(/^\/+/, '').replace(/\/+$/, '');
  const profile = params.get('profile') === 'mako' ? 'mako' : 'aimd';
  const suffix = profile === 'mako' ? '.mako.md' : '.aifeed.md';
  const candidates = clean === ''
    ? ['index' + suffix]
    : [`${clean}${suffix}`, `${clean}/index${suffix}`];

  let filePath = null;
  let body = null;
  for (const candidate of candidates) {
    const resolved = safeJoin(candidate);
    if (!resolved) continue;
    try {
      body = await fs.readFile(resolved);
      filePath = resolved;
      break;
    } catch (error) {
      // try the next candidate
    }
  }
  if (filePath === null) return new Response('not found', { status: 404 });
  const text = body.toString('utf8');
  const headers = {
    'Content-Type': `${MEDIA[profile]}; charset=utf-8`,
    Vary: 'Accept',
    'X-Mako-Version': '1.0',
    'X-Mako-Tokens': frontmatterField(text, 'tokens') || '0',
    'X-Mako-Type': frontmatterField(text, 'type') || 'custom',
    'X-Mako-Lang': frontmatterField(text, 'language'),
    'X-Aifeed-Profile': profile,
    'Cache-Control': 'public, max-age=3600, must-revalidate'
  };
  const signaturePath = `${filePath}.sig`;
  try {
    const container = (await fs.readFile(signaturePath, 'utf8')).trim();
    headers['X-Aifeed-Signature'] =
      (profile === 'mako' ? 'mako1:' : 'aimd1:') + Buffer.from(container, 'utf8').toString('base64url');
  } catch (error) {
    // unsigned documents are allowed; manifest policy decides trust
  }
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(body, { status: 200, headers });
}

export const HEAD = GET;
