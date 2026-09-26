import { eventConvId } from './account';
import { cityById, regionById } from './places';
import { summaries } from './server';
import { countByPart, getDoc, getDocs, insertDoc, putDoc } from './store';
import type { ConvDoc, ConvMemberDoc, NetEvent, NetEventDoc } from './types';

/** Server helpers for events: the view sent to members, and joining the event chat. */

export async function eventViews(docs: { id: string; data: NetEventDoc }[], me: string): Promise<NetEvent[]> {
  const ids = docs.map((d) => d.id);
  const [counts, mine, orgs] = await Promise.all([
    countByPart('eventMembers', ids),
    getDocs('eventMembers', ids.map((id) => `${id}:${me}`)),
    summaries(docs.map((d) => d.data.organizer)),
  ]);
  const joined = new Set(mine.map((m) => m.part));
  return docs.map(({ id, data }) => {
    const city = cityById(data.cityId);
    const { organizer, ...rest } = data;
    return {
      ...rest,
      id,
      organizer: orgs.get(organizer) ?? null,
      city: city?.name ?? '',
      region: regionById(city?.region)?.name ?? '',
      participants: counts.get(id) ?? 0,
      joined: joined.has(id),
      mine: organizer === me,
    };
  });
}

/** Adds a participant and gives them access to the event chat (from now on). */
export async function addParticipant(eventId: string, memberId: string): Promise<boolean> {
  const added = await insertDoc('eventMembers', `${eventId}:${memberId}`, eventId, { memberId, at: new Date().toISOString() });
  const convId = eventConvId(eventId);
  let conv = await getDoc<ConvDoc>('convs', convId);
  if (!conv) {
    await insertDoc<ConvDoc>('convs', convId, '', { kind: 'event', eventId, lastSeq: 0, lastAt: new Date().toISOString(), lastFrom: '', lastPreview: '' });
    conv = await getDoc<ConvDoc>('convs', convId);
  }
  await putDoc<ConvMemberDoc>('convMembers', `${convId}:${memberId}`, memberId, { convId, lastRead: conv?.data.lastSeq ?? 0 });
  return added !== null;
}
