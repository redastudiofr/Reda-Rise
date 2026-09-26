import type { NextRequest } from 'next/server';
import {
  burnPasswordCheck,
  clientKey,
  createSession,
  fail,
  json,
  networkBlockers,
  normalizeEmail,
  readBody,
  sameOrigin,
  setSessionCookie,
  sha256,
  verifyPassword,
} from '@/lib/network/server';
import { getDoc, hit } from '@/lib/network/store';
import type { MemberDoc, ProfileDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WRONG = 'Email ou mot de passe incorrect.';

export async function POST(req: NextRequest) {
  if (networkBlockers().length > 0) return fail('Le Network n’est pas activé sur cette app.', 503);
  if (!sameOrigin(req)) return fail('Origine refusée.', 403);
  const body = await readBody(req, 5000).catch(() => ({}) as Record<string, unknown>);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';

  const okIp = await hit(`login-ip:${clientKey(req)}`, 30, 900);
  const okEmail = email ? await hit(`login-email:${sha256(email)}`, 8, 900) : true;
  if (!okIp || !okEmail) return fail('Trop de tentatives. Réessaie dans 15 minutes.', 429);
  if (!email || !password) return fail(WRONG, 401);

  const index = await getDoc<{ memberId: string }>('emails', sha256(email));
  const member = index ? await getDoc<MemberDoc>('members', index.data.memberId) : null;
  if (!member) {
    await burnPasswordCheck(password);
    return fail(WRONG, 401);
  }
  if (!(await verifyPassword(password, member.data.passHash))) return fail(WRONG, 401);
  if (member.data.suspended) return fail('Ce compte a été suspendu par la modération.', 403);

  const profile = await getDoc<ProfileDoc>('profiles', member.id);
  const res = json({ ok: true, member: { id: member.id, email, hasProfile: Boolean(profile) } });
  setSessionCookie(res, await createSession(member.id));
  return res;
}
