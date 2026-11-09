import { gate } from '@/lib/jarvis/api';
import { exchangeCode } from '@/lib/jarvis/google';
import { ServiceError } from '@/lib/jarvis/http';
import { cookieValue, safeEqual } from '@/lib/jarvis/security';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'jarvis_google_state';

function back(req: Request, outcome: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(`/jarvis?google=${outcome}`, req.url).toString(),
      'Set-Cookie': `${STATE_COOKIE}=; Path=/api/jarvis/google/callback; Max-Age=0; HttpOnly; SameSite=Lax`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: Request) {
  const locked = gate();
  if (locked) return locked;
  const q = new URL(req.url).searchParams;
  const expected = cookieValue(req, STATE_COOKIE);
  const state = q.get('state') ?? '';
  if (!expected || !state || !safeEqual(expected, state)) return back(req, 'state');
  if (q.get('error')) return back(req, 'refused');
  const code = q.get('code');
  if (!code) return back(req, 'refused');
  try {
    await exchangeCode(req, code);
    return back(req, 'connected');
  } catch (e) {
    return back(req, e instanceof ServiceError && e.message.includes('incomplet') ? 'scopes' : 'error');
  }
}
