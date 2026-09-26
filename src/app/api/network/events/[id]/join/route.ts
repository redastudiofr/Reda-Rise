import { eventConvId } from '@/lib/network/account';
import { addParticipant } from '@/lib/network/eventsServer';
import { isOver } from '@/lib/network/events';
import { blockedWith, fail, json, memberRoute } from '@/lib/network/server';
import { countDocs, deleteDoc, getDoc, hit } from '@/lib/network/store';
import type { NetEventDoc, ProfileDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const POST = memberRoute<Ctx>(async (_req, me, { params }) => {
  const { id } = await params;
  if (!(await hit(`join:${me.id}`, 60, 3600))) return fail('Trop de demandes, réessaie plus tard.', 429);
  const doc = await getDoc<NetEventDoc>('events', id);
  if (!doc || (await blockedWith(me.id)).has(doc.data.organizer)) return fail('Événement introuvable.', 404);
  if (!(await getDoc<ProfileDoc>('profiles', me.id))) return fail('Crée d’abord ton profil.', 400);
  if (doc.data.cancelled) return fail('Cet événement est annulé.', 400);
  if (isOver(doc.data)) return fail('Cet événement est terminé.', 400);
  if (doc.data.capacity !== undefined && (await countDocs('eventMembers', id)) >= doc.data.capacity) return fail('Complet.', 409);
  await addParticipant(id, me.id);
  return json({ ok: true });
});

/** Leaves the event and its chat. The organiser cannot leave their own event (they cancel it). */
export const DELETE = memberRoute<Ctx>(async (_req, me, { params }) => {
  const { id } = await params;
  const doc = await getDoc<NetEventDoc>('events', id);
  if (!doc) return fail('Événement introuvable.', 404);
  if (doc.data.organizer === me.id) return fail('Tu organises cet événement : annule-le plutôt.', 400);
  await deleteDoc('eventMembers', `${id}:${me.id}`);
  await deleteDoc('convMembers', `${eventConvId(id)}:${me.id}`);
  return json({ ok: true });
});
