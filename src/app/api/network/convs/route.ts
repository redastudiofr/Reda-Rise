import { dmId } from '@/lib/network/messaging';
import { blockedWith, fail, json, memberRoute, readBody, summaries } from '@/lib/network/server';
import { getDoc, getDocs, hit, insertDoc, listDocs, putDoc } from '@/lib/network/store';
import type { ConvDoc, ConvMemberDoc, MemberDoc, NetEventDoc, ProfileDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ConvSummary = {
  id: string;
  kind: 'dm' | 'event';
  title: string;
  photo: string | null;
  /** The other member of a private conversation. */
  with: string | null;
  lastAt: string;
  lastPreview: string;
  lastFromMe: boolean;
  unread: boolean;
  muted: boolean;
  blocked: boolean;
};

/** The caller's conversations, most recent first. */
export const GET = memberRoute(async (_req, me) => {
  const mine = await listDocs<ConvMemberDoc>('convMembers', { part: me.id, limit: 1000 });
  const convs = await getDocs<ConvDoc>('convs', mine.map((m) => m.data.convId));
  const byId = new Map(convs.map((c) => [c.id, c.data]));
  const others = convs.filter((c) => c.data.kind === 'dm').map((c) => c.data.members!.find((x) => x !== me.id)!);
  const events = await getDocs<NetEventDoc>('events', convs.filter((c) => c.data.eventId).map((c) => c.data.eventId!));
  const eventTitle = new Map(events.map((e) => [e.id, e.data.title]));
  const [people, blocked] = await Promise.all([summaries(others), blockedWith(me.id)]);
  const out: ConvSummary[] = [];
  for (const m of mine) {
    const c = byId.get(m.data.convId);
    if (!c) continue;
    // A private conversation with nothing in it yet stays out of the list.
    if (c.kind === 'dm' && c.lastSeq === 0) continue;
    const other = c.kind === 'dm' ? c.members!.find((x) => x !== me.id)! : null;
    const person = other ? people.get(other) : null;
    out.push({
      id: m.data.convId,
      kind: c.kind,
      title: c.kind === 'dm' ? person?.pseudo ?? 'Compte supprimé' : eventTitle.get(c.eventId!) ?? 'Événement supprimé',
      photo: person?.photo ?? null,
      with: other,
      lastAt: c.lastAt,
      lastPreview: c.lastPreview,
      lastFromMe: c.lastFrom === me.id,
      unread: c.lastSeq > m.data.lastRead && c.lastFrom !== me.id,
      muted: Boolean(m.data.muted),
      blocked: other ? blocked.has(other) : false,
    });
  }
  out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return json({ convs: out });
});

/** Opens (or finds) the private conversation with another member. */
export const POST = memberRoute(async (req, me) => {
  const body = await readBody(req, 2000);
  const to = typeof body.to === 'string' ? body.to : '';
  if (!to || to === me.id) return fail('Destinataire invalide.', 400);
  const id = dmId(me.id, to);
  const existing = await getDoc<ConvDoc>('convs', id);
  if (existing) {
    await putDoc<ConvMemberDoc>('convMembers', `${id}:${me.id}`, me.id, (await getDoc<ConvMemberDoc>('convMembers', `${id}:${me.id}`))?.data ?? { convId: id, lastRead: 0 });
    return json({ id });
  }
  if (!(await getDoc<ProfileDoc>('profiles', me.id))) return fail('Crée d’abord ton profil.', 400);
  const [target, member, blocked] = await Promise.all([getDoc<ProfileDoc>('profiles', to), getDoc<MemberDoc>('members', to), blockedWith(me.id)]);
  if (!target || !member || member.data.suspended || blocked.has(to)) return fail('Ce membre n’est pas joignable.', 404);
  if (!target.data.openToMessages) return fail('Ce membre ne reçoit pas de messages privés.', 403);
  // New accounts can open fewer conversations: the cheapest way to spam is a fresh account.
  const young = Date.now() - Date.parse(me.member.createdAt) < 86400_000;
  if (!(await hit(`dm-new:${me.id}`, young ? 3 : 15, 86400))) {
    return fail('Tu as ouvert beaucoup de nouvelles conversations aujourd’hui. Réessaie demain.', 429);
  }
  await insertDoc<ConvDoc>('convs', id, '', { kind: 'dm', members: [me.id, to], lastSeq: 0, lastAt: new Date().toISOString(), lastFrom: '', lastPreview: '' });
  await putDoc<ConvMemberDoc>('convMembers', `${id}:${me.id}`, me.id, { convId: id, lastRead: 0 });
  await putDoc<ConvMemberDoc>('convMembers', `${id}:${to}`, to, { convId: id, lastRead: 0 });
  return json({ id });
});
