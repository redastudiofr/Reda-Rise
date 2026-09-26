import { fail, json, memberRoute, readBody } from '@/lib/network/server';
import { deleteDoc, getDoc, hit, putDoc } from '@/lib/network/store';
import type { ProfileDoc } from '@/lib/network/types';
import { validatePhoto } from '@/lib/network/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sets the caller's photo (already resized in the browser). The profile must exist first. */
export const PUT = memberRoute(async (req, me) => {
  if (!(await hit(`photo:${me.id}`, 20, 3600))) return fail('Trop de changements de photo, réessaie plus tard.', 429);
  const profile = await getDoc<ProfileDoc>('profiles', me.id);
  if (!profile) return fail('Crée d’abord ton profil.', 400);
  const v = validatePhoto((await readBody(req, 150_000)).photo);
  if (!v.ok) return fail(v.error, 400);
  await putDoc('photos', me.id, '', { type: v.value.type, b64: v.value.bytes.toString('base64') });
  const photoV = Date.now();
  await putDoc<ProfileDoc>('profiles', me.id, '', { ...profile.data, photoV });
  return json({ ok: true, photo: `/api/network/photo/${me.id}?v=${photoV}` });
});

export const DELETE = memberRoute(async (_req, me) => {
  const profile = await getDoc<ProfileDoc>('profiles', me.id);
  await deleteDoc('photos', me.id);
  if (profile) await putDoc<ProfileDoc>('profiles', me.id, '', { ...profile.data, photoV: 0 });
  return json({ ok: true });
});
