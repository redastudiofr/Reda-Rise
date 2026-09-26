import { randomBytes } from 'crypto';
import { after } from 'next/server';
import { notifyNewMessage } from '@/lib/network/messaging';
import { blockedWith, fail, json, memberRoute, readBody, summaries } from '@/lib/network/server';
import { getDoc, hit, insertDoc, listDocs, patchIfAbove, putDoc } from '@/lib/network/store';
import type { ConvDoc, ConvMemberDoc, MemberDoc, MessageDoc, NetEventDoc } from '@/lib/network/types';
import { validateMessage } from '@/lib/network/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function membership(convId: string, me: string) {
  const [conv, mine] = await Promise.all([getDoc<ConvDoc>('convs', convId), getDoc<ConvMemberDoc>('convMembers', `${convId}:${me}`)]);
  return conv && mine ? { conv, mine } : null;
}

/** Why the caller cannot write here, if they cannot. */
async function writeBlocker(conv: ConvDoc, me: string, blocked: Set<string>): Promise<string | null> {
  if (conv.kind === 'dm') {
    const other = conv.members!.find((x) => x !== me)!;
    if (blocked.has(other)) return 'Vous ne pouvez plus vous écrire (blocage).';
    const m = await getDoc<MemberDoc>('members', other);
    if (!m || m.data.suspended) return 'Ce membre n’est plus sur le Network.';
    return null;
  }
  const ev = conv.eventId ? await getDoc<NetEventDoc>('events', conv.eventId) : null;
  return ev ? null : 'Cet événement a été supprimé.';
}

/**
 * Messages of a conversation. `after` returns only newer ones (polling),
 * `before` older ones (scrolling back); nothing returns the latest 50.
 */
export const GET = memberRoute<Ctx>(async (req, me, { params }) => {
  const { id } = await params;
  const m = await membership(id, me.id);
  if (!m) return fail('Conversation introuvable.', 404);
  const u = new URL(req.url);
  const after = Number(u.searchParams.get('after'));
  const before = Number(u.searchParams.get('before'));
  const blocked = await blockedWith(me.id);
  let docs;
  if (Number.isFinite(after) && after > 0) docs = await listDocs<MessageDoc>('messages', { part: id, after, limit: 200 });
  else docs = (await listDocs<MessageDoc>('messages', { part: id, before: before > 0 ? before : undefined, order: 'desc', limit: 50 })).reverse();
  // In a group, messages of members the caller blocked (or who blocked them) are not shown.
  const visible = docs.filter((d) => d.data.from === me.id || !blocked.has(d.data.from));
  const people = await summaries(visible.map((d) => d.data.from));
  const c = m.conv.data;
  let header: { title: string; photo: string | null; with: string | null; eventId: string | null };
  if (c.kind === 'dm') {
    const other = c.members!.find((x) => x !== me.id)!;
    const p = (await summaries([other])).get(other);
    header = { title: p?.pseudo ?? 'Compte supprimé', photo: p?.photo ?? null, with: other, eventId: null };
  } else {
    const ev = await getDoc<NetEventDoc>('events', c.eventId!);
    header = { title: ev?.data.title ?? 'Événement supprimé', photo: null, with: null, eventId: c.eventId! };
  }
  return json({
    conv: { id, kind: c.kind, ...header, muted: Boolean(m.mine.data.muted), lastSeq: c.lastSeq, canWrite: (await writeBlocker(c, me.id, blocked)) === null, blocker: await writeBlocker(c, me.id, blocked) },
    messages: visible.map((d) => ({
      id: d.id,
      seq: d.seq,
      from: d.data.from,
      mine: d.data.from === me.id,
      author: people.get(d.data.from) ?? null,
      text: d.data.text,
      at: d.data.at,
    })),
    hasMore: !(after > 0) && docs.length === 50,
  });
});

/** Sends a message. */
export const POST = memberRoute<Ctx>(async (req, me, { params }) => {
  const { id } = await params;
  const m = await membership(id, me.id);
  if (!m) return fail('Conversation introuvable.', 404);
  const blocker = await writeBlocker(m.conv.data, me.id, await blockedWith(me.id));
  if (blocker) return fail(blocker, 403);
  if (!(await hit(`msg-min:${me.id}`, 20, 60))) return fail('Tu écris trop vite. Patiente une minute.', 429);
  if (!(await hit(`msg-day:${me.id}`, 500, 86400))) return fail('Limite de messages atteinte pour aujourd’hui.', 429);
  const recent = (await listDocs<MessageDoc>('messages', { part: id, where: { field: 'from', value: me.id }, order: 'desc', limit: 3 })).map((d) => d.data.text).reverse();
  const v = validateMessage((await readBody(req, 20_000)).text, recent);
  if (!v.ok) return fail(v.error, 400);
  const at = new Date().toISOString();
  const msgId = `msg_${randomBytes(10).toString('base64url')}`;
  const seq = (await insertDoc<MessageDoc>('messages', msgId, id, { from: me.id, text: v.value, at }))!;
  await patchIfAbove('convs', id, 'lastSeq', seq, { lastSeq: seq, lastAt: at, lastFrom: me.id, lastPreview: v.value.slice(0, 90) });
  await putDoc<ConvMemberDoc>('convMembers', m.mine.id, me.id, { ...m.mine.data, lastRead: Math.max(seq, m.mine.data.lastRead) });
  // Notifications go out after the response, so sending never waits on push services.
  after(() => notifyNewMessage(id, m.conv.data, me.id).catch((err) => console.error('[network push]', err)));
  return json({ ok: true, message: { id: msgId, seq, from: me.id, mine: true, text: v.value, at } });
});

/** Marks as read up to a seq, or mutes/unmutes the conversation. */
export const PUT = memberRoute<Ctx>(async (req, me, { params }) => {
  const { id } = await params;
  const m = await membership(id, me.id);
  if (!m) return fail('Conversation introuvable.', 404);
  const body = await readBody(req, 2000);
  const next = { ...m.mine.data };
  if (typeof body.read === 'number' && Number.isFinite(body.read)) next.lastRead = Math.max(next.lastRead, Math.min(body.read, m.conv.data.lastSeq));
  if (typeof body.muted === 'boolean') next.muted = body.muted;
  await putDoc<ConvMemberDoc>('convMembers', m.mine.id, me.id, next);
  return json({ ok: true });
});
