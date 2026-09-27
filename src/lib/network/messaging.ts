import { sendTo } from '../push';
import type { PushSub } from '../types';
import { sha256 } from './server';
import { deleteDoc, getDoc, hit, listDocs } from './store';
import type { ConvDoc, ConvMemberDoc, NetEventDoc, ProfileDoc } from './types';

/** Private conversations have a fixed id per pair of members, so there is never two. */
export function dmId(a: string, b: string): string {
  return `dm_${sha256([a, b].sort().join('|')).slice(0, 24)}`;
}

/** Push services browsers actually use. Anything else is refused: the server must not post to arbitrary URLs. */
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com', 'notify.windows.com'];

export function validPushSub(v: unknown): PushSub | null {
  const s = v as PushSub | undefined;
  if (!s || typeof s.endpoint !== 'string' || s.endpoint.length > 1000) return null;
  if (typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string' || s.keys.p256dh.length > 200 || s.keys.auth.length > 100) return null;
  let url: URL;
  try {
    url = new URL(s.endpoint);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (url.protocol !== 'https:' || !PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}

/**
 * Tells the other members of a conversation that a message arrived, on the
 * devices where they turned notifications on. Only the sender's pseudo is
 * sent, never the text. At most one notification per conversation per minute.
 */
export async function notifyNewMessage(convId: string, conv: ConvDoc, fromId: string): Promise<void> {
  const [from, members] = await Promise.all([
    getDoc<ProfileDoc>('profiles', fromId),
    listDocs<ConvMemberDoc>('convMembers', { where: { field: 'convId', value: convId }, limit: 1000 }),
  ]);
  const pseudo = from?.data.pseudo ?? 'Quelqu’un';
  let body = `${pseudo} t’a envoyé un message.`;
  if (conv.kind === 'event' && conv.eventId) {
    const ev = await getDoc<NetEventDoc>('events', conv.eventId);
    body = `${pseudo} a écrit dans « ${ev?.data.title ?? 'un événement'} ».`;
  }
  for (const m of members) {
    const to = m.part;
    if (to === fromId || m.data.muted) continue;
    if (await getDoc('blocks', `${to}:${fromId}`)) continue;
    if (!(await hit(`push:${to}:${convId}`, 1, 60))) continue;
    const subs = await listDocs<PushSub>('push', { part: to, limit: 20 });
    for (const s of subs) {
      await sendTo(s.data, { title: 'Telos · Network', body, tag: convId, url: `/network/messages/${convId}` }, async () => {
        await deleteDoc('push', s.id);
      });
    }
  }
}
