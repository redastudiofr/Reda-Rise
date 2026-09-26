import { json, memberRoute } from '@/lib/network/server';
import { getDocs, listDocs } from '@/lib/network/store';
import type { ConvDoc, ConvMemberDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Number of conversations with a message the caller has not read yet. */
export const GET = memberRoute(async (_req, me) => {
  const mine = await listDocs<ConvMemberDoc>('convMembers', { part: me.id, limit: 1000 });
  const convs = new Map((await getDocs<ConvDoc>('convs', mine.map((m) => m.data.convId))).map((c) => [c.id, c.data]));
  const unread = mine.filter((m) => {
    const c = convs.get(m.data.convId);
    return c && !m.data.muted && c.lastSeq > m.data.lastRead && c.lastFrom !== me.id;
  }).length;
  return json({ unread });
});
