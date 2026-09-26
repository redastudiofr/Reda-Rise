import { dmId } from '@/lib/network/messaging';
import { fail, json, memberRoute, toPublic } from '@/lib/network/server';
import { getDoc } from '@/lib/network/store';
import type { ProfileDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One profile. A hidden profile is shown only to itself and to members it
 * already talks with; someone who blocked the caller is not shown at all.
 * A profile the caller blocked stays reachable, so they can unblock it.
 */
export const GET = memberRoute<{ params: Promise<{ id: string }> }>(async (_req, me, { params }) => {
  const { id } = await params;
  const p = await getDoc<ProfileDoc>('profiles', id);
  if (!p) return fail('Profil introuvable.', 404);
  if (id === me.id) return json({ profile: toPublic(id, p.data, p.createdAt), self: true, blocked: false });
  const [iBlocked, theyBlocked, talking] = await Promise.all([
    getDoc('blocks', `${me.id}:${id}`),
    getDoc('blocks', `${id}:${me.id}`),
    getDoc('convMembers', `${dmId(me.id, id)}:${me.id}`),
  ]);
  if (theyBlocked || (!p.data.visible && !talking && !iBlocked)) return fail('Profil introuvable.', 404);
  const profile = toPublic(id, p.data, p.createdAt);
  // The photo route hides blocked members' photos: no broken image here.
  if (iBlocked) profile.photo = null;
  return json({ profile, self: false, blocked: Boolean(iBlocked) });
});
