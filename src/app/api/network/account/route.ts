import { deleteMember } from '@/lib/network/account';
import { clearSessionCookie, fail, json, memberRoute, readBody, verifyPassword } from '@/lib/network/server';
import { hit } from '@/lib/network/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Deletes the caller's account and everything attached to it. The password is asked again. */
export const DELETE = memberRoute(async (req, me) => {
  if (!(await hit(`delete:${me.id}`, 5, 900))) return fail('Trop de tentatives.', 429);
  const body = await readBody(req, 2000);
  const ok = typeof body.password === 'string' && (await verifyPassword(body.password, me.member.passHash));
  if (!ok) return fail('Mot de passe incorrect.', 401);
  await deleteMember(me.id);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
});
