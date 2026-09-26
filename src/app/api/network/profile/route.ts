import { fail, json, memberRoute, readBody } from '@/lib/network/server';
import { getDoc, hit, putDoc } from '@/lib/network/store';
import type { ProfileDoc } from '@/lib/network/types';
import { validateProfile } from '@/lib/network/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The caller's own profile, as stored. */
export const GET = memberRoute(async (_req, me) => {
  const p = await getDoc<ProfileDoc>('profiles', me.id);
  return json({ email: me.member.email, profile: p?.data ?? null });
});

export const PUT = memberRoute(async (req, me) => {
  if (!(await hit(`profile:${me.id}`, 40, 3600))) return fail('Trop de modifications, réessaie plus tard.', 429);
  const v = validateProfile(await readBody(req, 20_000));
  if (!v.ok) return fail(v.error, 400);
  const prev = await getDoc<ProfileDoc>('profiles', me.id);
  const doc: ProfileDoc = { ...v.value, photoV: prev?.data.photoV ?? 0, updatedAt: new Date().toISOString() };
  await putDoc('profiles', me.id, '', doc);
  return json({ ok: true, profile: doc });
});
