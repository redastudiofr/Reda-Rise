import { ownerRoute } from '@/lib/network/admin';
import { json, summaries } from '@/lib/network/server';
import { getDocs, listDocs } from '@/lib/network/store';
import type { MemberDoc, ReportDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Open reports (and the latest handled ones), with how many distinct people reported each member. */
export const GET = ownerRoute(async (req) => {
  const status = new URL(req.url).searchParams.get('status') === 'traite' ? 'traite' : 'ouvert';
  const docs = await listDocs<ReportDoc>('reports', { part: status, order: 'desc', limit: 200 });
  const open = status === 'ouvert' ? docs : await listDocs<ReportDoc>('reports', { part: 'ouvert', limit: 1000 });
  const reporters = new Map<string, Set<string>>();
  for (const r of open) (reporters.get(r.data.memberId) ?? reporters.set(r.data.memberId, new Set()).get(r.data.memberId)!).add(r.data.by);
  const ids = docs.flatMap((d) => [d.data.by, d.data.memberId]);
  const [people, members] = await Promise.all([summaries(ids), getDocs<MemberDoc>('members', docs.map((d) => d.data.memberId))]);
  const suspended = new Set(members.filter((m) => m.data.suspended).map((m) => m.id));
  const exists = new Set(members.map((m) => m.id));
  return json({
    reports: docs.map((d) => ({
      id: d.id,
      ...d.data,
      by: people.get(d.data.by) ?? { id: d.data.by, pseudo: 'Compte supprimé', photo: null },
      member: people.get(d.data.memberId) ?? { id: d.data.memberId, pseudo: 'Compte supprimé', photo: null },
      memberState: !exists.has(d.data.memberId) ? 'supprime' : suspended.has(d.data.memberId) ? 'suspendu' : 'actif',
      reportersOfMember: reporters.get(d.data.memberId)?.size ?? 0,
    })),
  });
});
