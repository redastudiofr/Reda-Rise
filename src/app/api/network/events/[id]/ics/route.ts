import { NextResponse } from 'next/server';
import { buildIcs } from '@/lib/network/events';
import { cityById } from '@/lib/network/places';
import { blockedWith, fail, memberRoute } from '@/lib/network/server';
import { getDoc } from '@/lib/network/store';
import type { NetEventDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The event as an .ics file, to add to any calendar (Apple, Google, Outlook). */
export const GET = memberRoute<{ params: Promise<{ id: string }> }>(async (req, me, { params }) => {
  const { id } = await params;
  const doc = await getDoc<NetEventDoc>('events', id);
  if (!doc || (await blockedWith(me.id)).has(doc.data.organizer)) return fail('Événement introuvable.', 404);
  const e = doc.data;
  const city = cityById(e.cityId)?.name ?? '';
  const ics = buildIcs({
    id,
    title: e.title,
    description: e.description,
    date: e.date,
    time: e.time,
    duration: e.duration,
    location: [city, e.placeHint].filter(Boolean).join(' — '),
    url: `${new URL(req.url).origin}/network/evenements/${id}`,
    cancelled: e.cancelled,
  });
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="evenement-${id}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
});
