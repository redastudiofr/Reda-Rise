import { todayKey } from '@/lib/logic';
import { eventViews } from '@/lib/network/eventsServer';
import { EVENT_TZ } from '@/lib/network/events';
import { blockedWith, fail, json, memberRoute, readBody, summaries } from '@/lib/network/server';
import { getDoc, listDocs, putDoc } from '@/lib/network/store';
import type { NetEventDoc } from '@/lib/network/types';
import { validateEvent } from '@/lib/network/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** One event with its participants (pseudo and photo only). */
export const GET = memberRoute<Ctx>(async (_req, me, { params }) => {
  const { id } = await params;
  const doc = await getDoc<NetEventDoc>('events', id);
  const blocked = await blockedWith(me.id);
  if (!doc || blocked.has(doc.data.organizer)) return fail('Événement introuvable.', 404);
  const [view] = await eventViews([doc], me.id);
  const members = await listDocs<{ memberId: string }>('eventMembers', { part: id, limit: 1000 });
  const people = await summaries(members.map((m) => m.data.memberId));
  const participants = members
    .map((m) => people.get(m.data.memberId))
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && !blocked.has(p!.id));
  return json({ event: view, participants, hiddenParticipants: view.participants - participants.length });
});

/** The organiser edits the event. */
export const PUT = memberRoute<Ctx>(async (req, me, { params }) => {
  const { id } = await params;
  const doc = await getDoc<NetEventDoc>('events', id);
  if (!doc) return fail('Événement introuvable.', 404);
  if (doc.data.organizer !== me.id) return fail('Seul l’organisateur peut modifier l’événement.', 403);
  if (doc.data.cancelled) return fail('Événement annulé.', 400);
  const v = validateEvent(await readBody(req, 20_000), todayKey(EVENT_TZ));
  if (!v.ok) return fail(v.error, 400);
  const count = (await listDocs('eventMembers', { part: id, limit: 1000 })).length;
  if (v.value.capacity !== undefined && v.value.capacity < count) return fail(`Il y a déjà ${count} participants.`, 400);
  await putDoc<NetEventDoc>('events', id, v.value.cityId, { ...doc.data, ...v.value });
  return json({ ok: true });
});

/** The organiser cancels: the event stays visible to its participants, marked cancelled. */
export const DELETE = memberRoute<Ctx>(async (_req, me, { params }) => {
  const { id } = await params;
  const doc = await getDoc<NetEventDoc>('events', id);
  if (!doc) return fail('Événement introuvable.', 404);
  if (doc.data.organizer !== me.id) return fail('Seul l’organisateur peut annuler l’événement.', 403);
  await putDoc<NetEventDoc>('events', id, doc.part, { ...doc.data, cancelled: true });
  return json({ ok: true });
});
