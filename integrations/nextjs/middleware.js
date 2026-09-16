// AIFeed for Next.js (App Router middleware). Works on Node and Edge runtimes.
//
// 1. Run `aifeed site build public --domain example.com --key aifeed-private.pem`
//    so the manifest, index, and *.aifeed.md files live under /public.
// 2. Copy this file to `middleware.js` and copy
//    `app/api/aifeed/route.js` into your app directory.
//
// Notes:
// - The route handler (Node runtime) sets the AIFeed Markdown/MAKO headers and the inline
//   signature from the generated *.sig sidecars.
// - With `output: "export"` (pure static hosting) middleware does not run: use the
//   explicit-endpoint pattern instead (`aifeed site build --inject` already emits
//   <link rel="alternate" ... href="/path.aifeed.md">).

import { NextResponse } from 'next/server';

const AIMD = 'text/aifeed+markdown';
const MAKO = 'text/mako+markdown';

export function middleware(request) {
  const accept = request.headers.get('accept') || '';
  const profile = accept.includes(AIMD) ? 'aimd' : accept.includes(MAKO) ? 'mako' : null;
  if (!profile) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const clean = pathname.replace(/^\/+/, '').replace(/\/+$/, '');

  const url = request.nextUrl.clone();
  url.pathname = '/api/aifeed';
  url.search = `?path=${encodeURIComponent(clean)}&profile=${profile}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|\\.well-known|api/aifeed|.*\\.aifeed\\.md$|.*\\.sig$).*)']
};
