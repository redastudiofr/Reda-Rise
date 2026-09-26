import { NextResponse } from 'next/server';
import { blockedWith, fail, memberRoute } from '@/lib/network/server';
import { getDoc } from '@/lib/network/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A member's photo, for signed-in members only. The URL is versioned, so it can be cached. */
export const GET = memberRoute<{ params: Promise<{ id: string }> }>(async (_req, me, { params }) => {
  const { id } = await params;
  if (id !== me.id && (await blockedWith(me.id)).has(id)) return fail('Introuvable.', 404);
  const photo = await getDoc<{ type: string; b64: string }>('photos', id);
  if (!photo) return fail('Introuvable.', 404);
  return new NextResponse(Buffer.from(photo.data.b64, 'base64'), {
    headers: {
      'Content-Type': photo.data.type,
      'Cache-Control': 'private, max-age=604800, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
});
