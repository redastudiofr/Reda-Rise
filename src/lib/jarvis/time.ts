/** Dates in Europe/Paris, without a library: Intl gives the offset of any instant. */
export const TZ = 'Europe/Paris';

export type DayKey = string; // YYYY-MM-DD in Paris

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

export function parisParts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return {
    day: `${p.year}-${p.month}-${p.day}` as DayKey,
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: wd, // 0 = dimanche
  };
}

export const parisDay = (d = new Date()): DayKey => parisParts(d).day;

/** The instant that is `hh:mm` on `day` in Paris (handles the DST switch). */
export function parisTime(day: DayKey, hh: number, mm = 0): Date {
  const [y, m, d] = day.split('-').map(Number);
  // First guess as if Paris were UTC, then correct by the real offset, twice.
  let t = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    const p = parisParts(new Date(t));
    const shownAsUtc = Date.UTC(Number(p.day.slice(0, 4)), Number(p.day.slice(5, 7)) - 1, Number(p.day.slice(8, 10)), p.hour, p.minute);
    t += Date.UTC(y, m - 1, d, hh, mm) - shownAsUtc;
  }
  return new Date(t);
}

export function addDays(day: DayKey, n: number): DayKey {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function weekdayOf(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** [start, end) of a Paris calendar day, as instants. */
export function dayRange(day: DayKey): { start: Date; end: Date } {
  return { start: parisTime(day, 0), end: parisTime(addDays(day, 1), 0) };
}

/** "14 h 30", the way it is said aloud. */
export function spokenTime(d: Date): string {
  const p = parisParts(d);
  return p.minute === 0 ? `${p.hour} h` : `${p.hour} h ${String(p.minute).padStart(2, '0')}`;
}

export function hhmm(d: Date): string {
  const p = parisParts(d);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function longDay(day: DayKey): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

/** RFC 3339 with the Paris offset, as the Calendar API likes it. */
export function parisIso(d: Date): string {
  const p = parisParts(d);
  const local = Date.UTC(Number(p.day.slice(0, 4)), Number(p.day.slice(5, 7)) - 1, Number(p.day.slice(8, 10)), p.hour, p.minute, p.second);
  const off = Math.round((local - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${p.day}T${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}:${String(p.second).padStart(2, '0')}${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}
