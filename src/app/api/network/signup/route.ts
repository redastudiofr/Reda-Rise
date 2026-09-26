import { randomBytes, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import {
  clientKey,
  createSession,
  fail,
  hashPassword,
  inviteCode,
  json,
  networkBlockers,
  normalizeEmail,
  passwordProblem,
  readBody,
  sameOrigin,
  setSessionCookie,
  sha256,
} from '@/lib/network/server';
import { deleteDoc, hit, insertDoc } from '@/lib/network/store';
import type { MemberDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sameCode(a: string, b: string): boolean {
  const x = Buffer.from(sha256(a));
  const y = Buffer.from(sha256(b));
  return timingSafeEqual(x, y);
}

export async function POST(req: NextRequest) {
  if (networkBlockers().length > 0) return fail('Le Network n’est pas activé sur cette app.', 503);
  if (!sameOrigin(req)) return fail('Origine refusée.', 403);
  const body = await readBody(req, 5000).catch(() => ({}) as Record<string, unknown>);

  if (!(await hit(`signup:${clientKey(req)}`, 5, 3600))) return fail('Trop d’inscriptions depuis cette connexion. Réessaie dans une heure.', 429);

  const code = inviteCode();
  if (code && !sameCode(String(body.invite ?? '').trim(), code)) return fail('Code d’invitation incorrect.', 403);
  const email = normalizeEmail(body.email);
  if (!email) return fail('Adresse email invalide.', 400);
  const problem = passwordProblem(body.password);
  if (problem) return fail(problem, 400);
  if (body.accept !== true) return fail('Accepte les règles du Network pour continuer.', 400);

  const id = `m_${randomBytes(12).toString('base64url')}`;
  // The email index is claimed first: two signups with one address cannot both win.
  const claimed = await insertDoc('emails', sha256(email), '', { memberId: id });
  if (claimed === null) return fail('Un compte existe déjà avec cette adresse. Connecte-toi.', 409);
  try {
    await insertDoc<MemberDoc>('members', id, '', {
      email,
      passHash: await hashPassword(body.password as string),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    await deleteDoc('emails', sha256(email));
    throw err;
  }
  const res = json({ ok: true, member: { id, email, hasProfile: false } });
  setSessionCookie(res, await createSession(id));
  return res;
}
