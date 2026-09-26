import { fail, json, memberRoute } from '@/lib/network/server';
import { deleteDoc, getDoc, listDocs, putDoc } from '@/lib/network/store';
import type { ConvDoc, MessageDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Deletes one of the caller's own messages. */
export const DELETE = memberRoute<{ params: Promise<{ id: string }> }>(async (_req, me, { params }) => {
  const { id } = await params;
  const msg = await getDoc<MessageDoc>('messages', id);
  if (!msg || msg.data.from !== me.id) return fail('Message introuvable.', 404);
  await deleteDoc('messages', id);
  const conv = await getDoc<ConvDoc>('convs', msg.part);
  if (conv && conv.data.lastSeq === msg.seq) {
    const [prev] = await listDocs<MessageDoc>('messages', { part: msg.part, order: 'desc', limit: 1 });
    // The seq stays where it was so nobody gets a new "unread" for a deletion.
    await putDoc<ConvDoc>('convs', conv.id, conv.part, { ...conv.data, lastPreview: prev ? prev.data.text.slice(0, 90) : 'Message supprimé', lastFrom: prev?.data.from ?? '' });
  }
  return json({ ok: true });
});
