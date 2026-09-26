import { sha256 } from './server';
import { deleteDoc, deleteWhere, getDoc, getDocs, listDocs, putDoc } from './store';
import type { ConvDoc, ConvMemberDoc, MemberDoc, NetEventDoc, ProfileDoc } from './types';

/**
 * Deletions that span several collections: an event with its participants
 * and chat, a whole member account.
 */

export const eventConvId = (eventId: string) => `ev_${eventId}`;

/** Removes an event, its participant list and its group chat. */
export async function deleteEventCascade(eventId: string): Promise<void> {
  const conv = eventConvId(eventId);
  await deleteWhere('messages', { part: conv });
  await deleteWhere('convMembers', { where: { field: 'convId', value: conv } });
  await deleteDoc('convs', conv);
  await deleteWhere('eventMembers', { part: eventId });
  await deleteDoc('events', eventId);
}

/**
 * Deletes a member and everything that is theirs: sessions, profile, photo,
 * blocks, push subscriptions, messages, the events they organise. The people
 * they talked to keep the conversation, without the deleted member's messages.
 */
export async function deleteMember(id: string): Promise<void> {
  const member = await getDoc<MemberDoc>('members', id);

  // Their messages go; conversation previews that quoted them are blanked.
  const memberships = await listDocs<ConvMemberDoc>('convMembers', { part: id, limit: 1000 });
  await deleteWhere('messages', { where: { field: 'from', value: id } });
  const convs = await getDocs<ConvDoc>('convs', memberships.map((m) => m.data.convId));
  for (const c of convs) {
    if (c.data.lastFrom === id) await putDoc<ConvDoc>('convs', c.id, c.part, { ...c.data, lastPreview: 'Message supprimé', lastFrom: '' });
  }
  await deleteWhere('convMembers', { part: id });

  const organised = await listDocs<NetEventDoc>('events', { where: { field: 'organizer', value: id }, limit: 1000 });
  for (const e of organised) await deleteEventCascade(e.id);
  await deleteWhere('eventMembers', { where: { field: 'memberId', value: id } });

  await deleteWhere('blocks', { part: id });
  await deleteWhere('blocks', { where: { field: 'blocked', value: id } });
  await deleteWhere('push', { part: id });
  await deleteWhere('sessions', { part: id });
  await deleteDoc('photos', id);
  await deleteDoc('profiles', id);
  if (member) await deleteDoc('emails', sha256(member.data.email));
  await deleteDoc('members', id);
}

/** Suspension by moderation: signed out everywhere, hidden from everyone. */
export async function suspendMember(id: string): Promise<void> {
  const member = await getDoc<MemberDoc>('members', id);
  if (!member) return;
  await putDoc<MemberDoc>('members', id, member.part, { ...member.data, suspended: true });
  await deleteWhere('sessions', { part: id });
  const profile = await getDoc<ProfileDoc>('profiles', id);
  if (profile) await putDoc<ProfileDoc>('profiles', id, profile.part, { ...profile.data, visible: false, openToMessages: false });
  const organised = await listDocs<NetEventDoc>('events', { where: { field: 'organizer', value: id }, limit: 1000 });
  for (const e of organised) await putDoc<NetEventDoc>('events', e.id, e.part, { ...e.data, cancelled: true });
}
