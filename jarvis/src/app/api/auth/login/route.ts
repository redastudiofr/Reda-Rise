import { createHash } from 'node:crypto';
import { env, securityProblems } from '@/lib/env';
import { clear, fail, tooMany } from '@/lib/ratelimit';
import { SESSION_COOKIE, SESSION_DAYS, isHttps, newSession, safeEqual, sameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';

const PER_IP = 5; // per 15 minutes
const GLOBAL = 30; // per hour, whatever the address

function ipKey(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  return `ip:${createHash('sha256').update(ip).digest('hex').slice(0, 16)}`;
}

export async function POST(req: Request) {
  const problems = securityProblems();
  if (problems.length > 0) return Response.json({ error: 'not_configured', message: problems.join(' ') }, { status: 503 });
  if (!sameOrigin(req)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const ip = ipKey(req);
  const wait = (await tooMany(ip, PER_IP)) ?? (await tooMany('all', GLOBAL));
  if (wait) {
    return Response.json(
      { error: 'rate_limited', message: `Trop d’essais. Réessayez dans ${Math.ceil(wait / 60)} min.` },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    );
  }

  let password = '';
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    /* empty password below */
  }
  if (!password || !safeEqual(password, env.password())) {
    await fail(ip, 15 * 60);
    await fail('all', 60 * 60);
    return Response.json({ error: 'bad_password', message: 'Mot de passe incorrect.' }, { status: 401 });
  }
  await clear(ip);
  const secure = isHttps(req) ? '; Secure' : '';
  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': `${SESSION_COOKIE}=${newSession()}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; SameSite=Lax${secure}`,
        'Cache-Control': 'no-store',
      },
    },
  );
}

/** Tells the login page whether the server is set up, without saying more. */
export async function GET() {
  return Response.json({ configured: securityProblems().length === 0, problems: securityProblems() });
}
