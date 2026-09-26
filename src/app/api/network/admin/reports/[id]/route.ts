import { deleteEventCascade, suspendMember } from '@/lib/network/account';
import { ownerRoute } from '@/lib/network/admin';
import { fail, json, readBody } from '@/lib/network/server';
import { deleteDoc, getDoc, listDocs, putDoc } from '@/lib/network/store';
import type { ReportDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS = {
  dismiss: 'Classé sans suite',
  'delete-content': 'Contenu supprimé',
  suspend: 'Compte suspendu',
} as const;

/** Handles a report: dismiss it, delete the reported content, or suspend the member. */
export const POST = ownerRoute<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const action = (await readBody(req, 2000)).action as keyof typeof ACTIONS;
  if (!(action in ACTIONS)) return fail('Action inconnue.', 400);
  const report = await getDoc<ReportDoc>('reports', id);
  if (!report) return fail('Signalement introuvable.', 404);
  const r = report.data;
  if (action === 'delete-content') {
    if (r.kind === 'message') await deleteDoc('messages', r.targetId);
    else if (r.kind === 'evenement') await deleteEventCascade(r.targetId);
    else return fail('Pour un profil, suspends le compte.', 400);
  }
  if (action === 'suspend') await suspendMember(r.memberId);
  // Every open report on the same target is settled together.
  const siblings = (await listDocs<ReportDoc>('reports', { part: 'ouvert', where: { field: 'targetId', value: r.targetId }, limit: 1000 }))
    .concat(action === 'suspend' ? await listDocs<ReportDoc>('reports', { part: 'ouvert', where: { field: 'memberId', value: r.memberId }, limit: 1000 }) : []);
  const all = new Map([[report.id, report], ...siblings.map((s) => [s.id, s] as const)]);
  for (const doc of all.values()) {
    await putDoc<ReportDoc>('reports', doc.id, 'traite', { ...doc.data, status: 'traite', resolution: ACTIONS[action] });
  }
  return json({ ok: true, handled: all.size });
});
