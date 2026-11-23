import { gate } from '@/lib/jarvis/api';
import { authUrl, googleConfigured } from '@/lib/jarvis/google';
import { isHttps, randomToken } from '@/lib/jarvis/security';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'jarvis_google_state';

/** Opens Google's consent screen. The state is bound to this browser by a cookie. */
export async function GET(req: Request) {
  const locked = gate();
  if (locked) return locked;
  if (!googleConfigured()) return Response.redirect(new URL('/jarvis/reglages?google=not_configured', req.url), 303);
  const state = randomToken();
  return new Response(null, {
    status: 303,
    headers: {
      Location: authUrl(req, state),
      'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/api/jarvis/google/callback; Max-Age=600; HttpOnly; SameSite=Lax${isHttps(req) ? '; Secure' : ''}`,
      'Cache-Control': 'no-store',
    },
  });
}
