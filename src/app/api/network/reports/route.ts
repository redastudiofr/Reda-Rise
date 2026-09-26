import { fail, json, memberRoute, readBody, sha256 } from '@/lib/network/server';
import { getDoc, hit, insertDoc } from '@/lib/network/store';
import type { ConvMemberDoc, MessageDoc, NetEventDoc, ProfileDoc, ReportDoc, ReportKind } from '@/lib/network/types';
import { LIMITS, REPORT_REASONS, clean } from '@/lib/network/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS: ReportKind[] = ['membre', 'message', 'evenement'];

/** Reports a member, a message or an event to the moderation (the app's owner). */
export const POST = memberRoute(async (req, me) => {
  const body = await readBody(req, 5000);
  const kind = KINDS.find((k) => k === body.kind);
  const targetId = typeof body.targetId === 'string' ? body.targetId : '';
  const reason = REPORT_REASONS.find((r) => r === body.reason);
  if (!kind || !targetId || !reason) return fail('Signalement incomplet.', 400);
  if (!(await hit(`report:${me.id}`, 10, 86400))) return fail('Tu as déjà envoyé beaucoup de signalements aujourd’hui.', 429);

  let memberId = '';
  let excerpt = '';
  if (kind === 'membre') {
    const p = await getDoc<ProfileDoc>('profiles', targetId);
    if (!p) return fail('Introuvable.', 404);
    memberId = targetId;
    excerpt = [[p.data.pseudo, p.data.company].filter(Boolean).join(' — '), p.data.bio].filter(Boolean).join('\n');
  } else if (kind === 'message') {
    const msg = await getDoc<MessageDoc>('messages', targetId);
    // Only someone who can read the message may report it.
    if (!msg || !(await getDoc<ConvMemberDoc>('convMembers', `${msg.part}:${me.id}`))) return fail('Introuvable.', 404);
    memberId = msg.data.from;
    excerpt = msg.data.text;
  } else {
    const ev = await getDoc<NetEventDoc>('events', targetId);
    if (!ev) return fail('Introuvable.', 404);
    memberId = ev.data.organizer;
    excerpt = [ev.data.title, ev.data.description].filter(Boolean).join('\n');
  }
  if (memberId === me.id) return fail('Tu ne peux pas te signaler toi-même.', 400);

  // One report per person and target: reporting again changes nothing.
  await insertDoc<ReportDoc>('reports', `r_${sha256(`${me.id}|${kind}|${targetId}`).slice(0, 24)}`, 'ouvert', {
    by: me.id,
    kind,
    targetId,
    memberId,
    reason,
    detail: clean(body.detail, LIMITS.reportDetail, true),
    excerpt: excerpt.slice(0, 1000),
    at: new Date().toISOString(),
    status: 'ouvert',
  });
  return json({ ok: true });
});
