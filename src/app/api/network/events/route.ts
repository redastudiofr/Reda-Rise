import { randomBytes } from 'crypto';
import { todayKey } from '@/lib/logic';
import { addParticipant, eventViews } from '@/lib/network/eventsServer';
import { EVENT_TZ, isOver } from '@/lib/network/events';
import { blockedWith, fail, json, memberRoute, readBody } from '@/lib/network/server';
import { getDoc, hit, insertDoc, listDocs } from '@/lib/network/store';
import type { NetEventDoc, ProfileDoc } from '@/lib/network/types';
import { validateEvent } from '@/lib/network/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Upcoming events (optionally in one city or region), or the caller's own:
 * the ones they organise or joined, past ones included.
 */
export const GET = memberRoute(async (req, me) => {
  const u = new URL(req.url);
  const scope = u.searchParams.get('scope') === 'mine' ? 'mine' : 'upcoming';
  const city = u.searchParams.get('city') ?? '';
  const blocked = await blockedWith(me.id);
  let docs = (await listDocs<NetEventDoc>('events', { order: 'desc', limit: 1000 })).filter((d) => !blocked.has(d.data.organizer));
  if (scope === 'mine') {
    const joined = new Set((await listDocs<{ memberId: string }>('eventMembers', { where: { field: 'memberId', value: me.id }, limit: 1000 })).map((m) => m.part));
    docs = docs.filter((d) => d.data.organizer === me.id || joined.has(d.id));
  } else {
    docs = docs.filter((d) => !d.data.cancelled && !isOver(d.data) && (!city || d.data.cityId === city));
  }
  docs.sort((a, b) => `${a.data.date} ${a.data.time}`.localeCompare(`${b.data.date} ${b.data.time}`));
  if (scope === 'mine') {
    // Upcoming first, then the past ones, most recent first.
    const next = docs.filter((d) => !isOver(d.data));
    const past = docs.filter((d) => isOver(d.data)).reverse();
    docs = [...next, ...past];
  }
  return json({ events: await eventViews(docs.slice(0, 200), me.id) });
});

export const POST = memberRoute(async (req, me) => {
  if (!(await getDoc<ProfileDoc>('profiles', me.id))) return fail('Crée d’abord ton profil.', 400);
  if (!(await hit(`event-create:${me.id}`, 5, 86400))) return fail('Tu as déjà créé 5 événements aujourd’hui.', 429);
  const v = validateEvent(await readBody(req, 20_000), todayKey(EVENT_TZ));
  if (!v.ok) return fail(v.error, 400);
  if (isOver({ ...v.value })) return fail('Cet horaire est déjà passé.', 400);
  const id = `e_${randomBytes(10).toString('base64url')}`;
  await insertDoc<NetEventDoc>('events', id, v.value.cityId, { ...v.value, organizer: me.id, createdAt: new Date().toISOString() });
  await addParticipant(id, me.id);
  return json({ ok: true, id });
});
