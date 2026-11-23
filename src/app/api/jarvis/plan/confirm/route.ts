import { bad, failed, gate, jsonBody, noStore } from '@/lib/jarvis/api';
import { busyOf } from '@/lib/jarvis/assistant';
import { createEvent, eventsBetween } from '@/lib/jarvis/google';
import { stillFree, type PlannedItem } from '@/lib/jarvis/planner';
import { loadSettings } from '@/lib/jarvis/serverSettings';
import { dayRange, parisDay, type DayKey } from '@/lib/jarvis/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Creates the confirmed plan in Google Calendar, and nowhere else. Each slot
 * is checked again against the calendar as it is now: anything that became
 * busy meanwhile is skipped, never double-booked.
 */
export async function POST(req: Request) {
  const locked = gate();
  if (locked) return locked;
  const body = await jsonBody<{ day?: unknown; items?: unknown }>(req);
  if (!body || typeof body.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.day) || !Array.isArray(body.items)) return bad('Planning invalide.');
  const day = body.day as DayKey;
  if (day < parisDay()) return bad('Ce jour est passé.');
  const items = (body.items as PlannedItem[])
    .filter((i) => i && typeof i.title === 'string' && typeof i.start === 'string' && typeof i.end === 'string')
    .slice(0, 15)
    .map((i) => ({ title: i.title.trim().slice(0, 120), start: i.start, end: i.end }));
  if (items.length === 0) return bad('Rien à créer.');
  try {
    const settings = await loadSettings();
    const { start, end } = dayRange(day);
    const busy = busyOf(await eventsBetween(start, end));
    const created: PlannedItem[] = [];
    const skipped: { title: string; reason: string }[] = [];
    for (const it of items) {
      const a = Date.parse(it.start);
      const b = Date.parse(it.end);
      if (!(a >= start.getTime() && b <= end.getTime() && b > a && b - a <= 10 * 3600_000)) {
        skipped.push({ title: it.title, reason: 'horaire invalide' });
        continue;
      }
      if (!stillFree(it, busy, day, settings)) {
        skipped.push({ title: it.title, reason: 'créneau plus libre' });
        continue;
      }
      await createEvent({ title: it.title, start: new Date(a), end: new Date(b) });
      busy.push({ start: a, end: b });
      created.push(it);
    }
    return Response.json({ created, skipped }, { headers: noStore });
  } catch (e) {
    return failed(e, 'Google Agenda');
  }
}
