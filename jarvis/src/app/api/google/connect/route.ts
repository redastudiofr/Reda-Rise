import { authUrl, googleConfigured } from '@/lib/google';
import { isHttps, randomToken } from '@/lib/security';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'jarvis_google_state';

/** Opens Google's consent screen. The state is bound to this browser by a cookie. */
export async function GET(req: Request) {
  if (!googleConfigured()) return Response.redirect(new URL('/reglages?google=not_configured', req.url), 303);
  const state = randomToken();
  return new Response(null, {
    status: 303,
    headers: {
      Location: authUrl(req, state),
      'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/api/google/callback; Max-Age=600; HttpOnly; SameSite=Lax${isHttps(req) ? '; Secure' : ''}`,
      'Cache-Control': 'no-store',
    },
  });
}
