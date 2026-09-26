import { blockedWith, fail, json, memberRoute, toPublic } from '@/lib/network/server';
import { getDoc } from '@/lib/network/store';
import type { ProfileDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = memberRoute<{ params: Promise<{ id: string }> }>(async (_req, me, { params }) => {
  const { id } = await params;
  const p = await getDoc<ProfileDoc>('profiles', id);
  const blocked = await blockedWith(me.id);
  // A hidden profile is still shown to itself; a blocked one to nobody on the other side.
  if (!p || (id !== me.id && (!p.data.visible || blocked.has(id)))) return fail('Profil introuvable.', 404);
  const iBlocked = id !== me.id && Boolean(await getDoc('blocks', `${me.id}:${id}`));
  return json({ profile: toPublic(id, p.data, p.createdAt), self: id === me.id, blocked: iBlocked });
});
