import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { COOKIE_NAME, appPassword, createToken } from '@/lib/auth';
import { clearFailedLogins, failedLogins, recordFailedLogin } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Per connection: 5 wrong passwords per 15 minutes. */
const PER_IP = { max: 5, windowSec: 15 * 60 };
/** All connections together: stops a guess spread over many addresses. */
const GLOBAL = { max: 30, windowSec: 60 * 60 };

const sha = (s: string) => createHash('sha256').update(s).digest();

/** Same time whatever the input: both sides are hashed to 32 bytes first. */
function samePassword(given: string, expected: string): boolean {
  return timingSafeEqual(sha(given), sha(expected));
}

/** The caller's IP, only ever stored hashed. On Vercel, x-forwarded-for is set by the platform. */
function ipKey(req: Request): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  return `ip:${sha(ip).toString('hex').slice(0, 32)}`;
}

function tooMany(resetAt: number) {
  const wait = Math.max(1, Math.ceil((resetAt - Date.now()) / 60_000));
  return NextResponse.json(
    { error: `Trop de tentatives. Réessaie dans ${wait} minute${wait > 1 ? 's' : ''}.` },
    { status: 429, headers: { 'Retry-After': String(wait * 60) } },
  );
}

export async function POST(req: Request) {
  const expected = appPassword();
  if (!expected) return NextResponse.json({ error: 'Aucun mot de passe configuré.' }, { status: 400 });

  const ip = ipKey(req);
  const [mine, all] = await Promise.all([failedLogins(ip), failedLogins('all')]);
  if (mine.count >= PER_IP.max) return tooMany(mine.resetAt);
  if (all.count >= GLOBAL.max) return tooMany(all.resetAt);

  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const given = typeof body.password === 'string' ? body.password.slice(0, 500) : '';
  if (!given || !samePassword(given, expected)) {
    await Promise.all([recordFailedLogin(ip, PER_IP.windowSec), recordFailedLogin('all', GLOBAL.windowSec)]);
    const left = PER_IP.max - mine.count - 1;
    return NextResponse.json(
      { error: left > 0 ? `Mot de passe incorrect. ${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}.` : 'Mot de passe incorrect.' },
      { status: 401 },
    );
  }

  await clearFailedLogins(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: await createToken(),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 365 * 24 * 3600,
  });
  return res;
}
