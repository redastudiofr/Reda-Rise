import { NextResponse, type NextRequest } from 'next/server';
import { securityProblems } from './lib/env';
import { SESSION_COOKIE, validSession } from './lib/security';

/** Open without a session: the login page and the login call. */
const PUBLIC = ['/login', '/api/auth/login'];

/**
 * Every page and API needs the session cookie. Without JARVIS_PASSWORD or a
 * long enough SESSION_SECRET, nothing opens at all (fail closed).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  if (securityProblems().length > 0) {
    if (isApi) return NextResponse.json({ error: 'not_configured', message: 'Configuration incomplète.' }, { status: 503 });
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (validSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (isApi) return NextResponse.json({ error: 'unauthorized', message: 'Session expirée.' }, { status: 401 });
  const login = new URL('/login', req.url);
  if (pathname !== '/') login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)'],
};
