/**
 * Network events: French local time to UTC, and the .ics file anyone can add
 * to their own calendar. Pure functions, shared by the server and the pages.
 */

export const EVENT_TZ = 'Europe/Paris';

/** Offset of a time zone at a given instant, in minutes (Paris: +60 or +120). */
function offsetMinutes(tz: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** The instant a Paris wall-clock date and time designate. */
export function parisToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let t = guess - offsetMinutes(EVENT_TZ, new Date(guess)) * 60000;
  // Second pass for the days the clocks change.
  t = guess - offsetMinutes(EVENT_TZ, new Date(t)) * 60000;
  return new Date(t);
}

export function eventEnd(date: string, time: string, duration: number): Date {
  return new Date(parisToUtc(date, time).getTime() + duration * 60000);
}

/** An event is over once it has ended. */
export function isOver(e: { date: string; time: string; duration: number }, now = new Date()): boolean {
  return eventEnd(e.date, e.time, e.duration).getTime() < now.getTime();
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** RFC 5545 text escaping, then folding at 75 octets. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, 'utf8') > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
    }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs(e: {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  duration: number;
  location: string;
  url: string;
  cancelled?: boolean;
  now?: Date;
}): string {
  const start = parisToUtc(e.date, e.time);
  const end = new Date(start.getTime() + e.duration * 60000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Telos//Network//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@telos-rs-network`,
    `DTSTAMP:${stamp(e.now ?? new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description ? `${e.description}\n\n${e.url}` : e.url)}`,
    `LOCATION:${esc(e.location)}`,
    `URL:${e.url}`,
    `STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
