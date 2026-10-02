import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, authEnabled, verifyToken } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  // No APP_PASSWORD configured: the app is open, nothing to guard.
  if (!authEnabled()) return NextResponse.next();

  const ok = await verifyToken(req.cookies.get(COOKIE_NAME)?.value);
  if (ok) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!login|offline|api/auth|api/cron|_next/static|_next/image|icons|manifest.webmanifest|sw.js|favicon.ico).*)',
  ],
};
