import { fail, json, memberRoute, readBody, summaries } from '@/lib/network/server';
import { deleteDoc, getDoc, hit, listDocs, putDoc } from '@/lib/network/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Members the caller blocked. */
export const GET = memberRoute(async (_req, me) => {
  const docs = await listDocs<{ blocked: string; at: string }>('blocks', { part: me.id, limit: 1000 });
  const people = await summaries(docs.map((d) => d.data.blocked));
  return json({ blocked: docs.map((d) => people.get(d.data.blocked) ?? { id: d.data.blocked, pseudo: 'Compte supprimé', photo: null }) });
});

/**
 * Blocks a member: neither sees the other in discovery, events or group
 * chats any more, and their private conversation is closed. Silent: the
 * blocked member is not told.
 */
export const POST = memberRoute(async (req, me) => {
  const id = (await readBody(req, 2000)).memberId;
  if (typeof id !== 'string' || !id || id === me.id) return fail('Membre invalide.', 400);
  if (!(await getDoc('members', id))) return fail('Membre introuvable.', 404);
  if (!(await hit(`block:${me.id}`, 50, 3600))) return fail('Trop de demandes.', 429);
  await putDoc('blocks', `${me.id}:${id}`, me.id, { blocked: id, at: new Date().toISOString() });
  return json({ ok: true });
});

export const DELETE = memberRoute(async (req, me) => {
  const id = (await readBody(req, 2000)).memberId;
  if (typeof id !== 'string' || !id) return fail('Membre invalide.', 400);
  await deleteDoc('blocks', `${me.id}:${id}`);
  return json({ ok: true });
});
