import type { Settings } from './settings';
import { parisParts, parisTime, weekdayOf, type DayKey } from './time';

/**
 * The planning itself is computed here, not by the model: the model only
 * turns what Monsieur said into tasks and durations. So a task can never land
 * on a course or an existing event, whatever the model answers.
 */
export type Interval = { start: number; end: number; label?: string }; // epoch ms

export type TaskRequest = {
  title: string;
  minutes: number;
  /** Optional window in minutes since midnight, e.g. "le soir" = 18:00–22:00. */
  earliest?: number;
  latest?: number;
  /** Fixed time asked for ("à 17 h"), minutes since midnight. */
  at?: number;
};

export type PlannedItem = { title: string; start: string; end: string };
export type Plan = { day: DayKey; items: PlannedItem[]; unplaced: { title: string; reason: string }[] };

const MIN = 60_000;

export function courseBlocks(day: DayKey, s: Settings): Interval[] {
  const wd = weekdayOf(day);
  return s.courses
    .filter((c) => c.weekday === wd)
    .map((c) => ({ start: at(day, c.start), end: at(day, c.end), label: c.label }));
}

const at = (day: DayKey, minutes: number) => parisTime(day, Math.floor(minutes / 60), minutes % 60).getTime();

/** Busy intervals merged and sorted. */
export function merge(busy: Interval[]): Interval[] {
  const sorted = busy.filter((b) => b.end > b.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
    else out.push({ ...b });
  }
  return out;
}

/** Free time of the day, from `now` (rounded up to the quarter hour) to the end of the window. */
export function freeSlots(day: DayKey, busy: Interval[], s: Settings, now: number, pad = 0): Interval[] {
  let from = at(day, s.dayStart);
  const to = at(day, s.dayEnd);
  if (now > from) from = Math.ceil(now / (15 * MIN)) * 15 * MIN;
  const slots: Interval[] = [];
  let cursor = from;
  const courses = courseBlocks(day, s).map((c) => ({ start: c.start - pad, end: c.end + pad }));
  for (const b of merge([...busy, ...courses])) {
    if (b.end <= cursor) continue;
    if (b.start >= to) break;
    if (b.start > cursor) slots.push({ start: cursor, end: Math.min(b.start, to) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < to) slots.push({ start: cursor, end: to });
  return slots.filter((x) => x.end - x.start >= 15 * MIN);
}

const iso = (ms: number) => new Date(ms).toISOString();

export function planDay(day: DayKey, tasks: TaskRequest[], busy: Interval[], s: Settings, now: number): Plan {
  const buffer = s.bufferMinutes * MIN;
  // Taken time grows as tasks are placed; a buffer is kept around each one.
  const taken: Interval[] = busy.map((b) => ({ start: b.start - buffer, end: b.end + buffer }));
  const items: PlannedItem[] = [];
  const unplaced: Plan['unplaced'] = [];
  // Fixed times first, then the longest tasks, so the big blocks find room.
  const order = tasks
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.at !== undefined ? -1 : 0) - (b.t.at !== undefined ? -1 : 0) || b.t.minutes - a.t.minutes);
  const placed: { i: number; item: PlannedItem }[] = [];

  for (const { t, i } of order) {
    const minutes = Math.max(5, Math.min(600, Math.round(t.minutes)));
    const len = minutes * MIN;
    const slots = freeSlots(day, taken, s, now, buffer);
    const lo = t.earliest !== undefined ? at(day, t.earliest) : -Infinity;
    const hi = t.latest !== undefined ? at(day, t.latest) : Infinity;
    let start: number | null = null;
    if (t.at !== undefined) {
      const want = at(day, t.at);
      if (slots.some((x) => want >= x.start && want + len <= x.end)) start = want;
      else {
        unplaced.push({ title: t.title, reason: `${fmt(want)} n’est pas libre` });
        continue;
      }
    } else {
      for (const x of slots) {
        const st = Math.max(x.start, lo);
        if (st + len <= Math.min(x.end, hi)) {
          start = st;
          break;
        }
      }
    }
    if (start === null) {
      unplaced.push({ title: t.title, reason: lo > -Infinity || hi < Infinity ? 'pas de créneau assez long dans la plage demandée' : 'pas de créneau assez long aujourd’hui' });
      continue;
    }
    taken.push({ start: start - buffer, end: start + len + buffer });
    placed.push({ i, item: { title: t.title.slice(0, 120), start: iso(start), end: iso(start + len) } });
  }
  items.push(...placed.sort((a, b) => a.item.start.localeCompare(b.item.start)).map((p) => p.item));
  return { day, items, unplaced };
}

function fmt(ms: number): string {
  const p = parisParts(new Date(ms));
  return `${p.hour} h${p.minute ? String(p.minute).padStart(2, '0') : ''}`;
}

/** True when the item still fits: nothing busy has appeared on it since. */
export function stillFree(item: PlannedItem, busy: Interval[], day: DayKey, s: Settings): boolean {
  const a = Date.parse(item.start);
  const b = Date.parse(item.end);
  if (!(b > a)) return false;
  return ![...busy, ...courseBlocks(day, s)].some((x) => x.start < b && x.end > a);
}
