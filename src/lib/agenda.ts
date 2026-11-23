import type {
  AgendaProject,
  AppData,
  CalEvent,
  CalTask,
  Category,
  EventKind,
  Objective,
  Repeat,
  TaskPriority,
  TaskStatus,
} from './types';
import { shiftKey, weekdayOf } from './logic';
import { categoryLabel, isDone, objectivesForDate } from './xp';
import { localNow, type DueNotification } from './schedule';

/* ---------- référentiels ---------- */

export const EVENT_KINDS: {
  id: EventKind;
  label: string;
  color: string;
  duration: number;
  repeat: Repeat;
  allDay?: boolean;
}[] = [
  { id: 'rdv', label: 'Rendez-vous', color: '#d64a62', duration: 60, repeat: 'none' },
  { id: 'cours', label: 'Cours', color: '#9a7cf0', duration: 90, repeat: 'weekly' },
  { id: 'reunion', label: 'Réunion', color: '#4bb3c4', duration: 60, repeat: 'none' },
  { id: 'evenement', label: 'Événement', color: '#d9a54a', duration: 120, repeat: 'none' },
  { id: 'anniversaire', label: 'Anniversaire', color: '#c47fb4', duration: 0, repeat: 'yearly', allDay: true },
];

export function kindOf(id: EventKind) {
  return EVENT_KINDS.find((k) => k.id === id) ?? EVENT_KINDS[0];
}

export const PRIORITIES: { id: TaskPriority; label: string; color: string; rank: number }[] = [
  { id: 'urgente', label: 'Urgente', color: '#e0806f', rank: 0 },
  { id: 'haute', label: 'Haute', color: '#e2a15a', rank: 1 },
  { id: 'normale', label: 'Normale', color: '#8a94a6', rank: 2 },
  { id: 'basse', label: 'Basse', color: '#5b626d', rank: 3 },
];

export function priorityOf(id: TaskPriority) {
  return PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[2];
}

export const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: 'a-faire', label: 'À faire' },
  { id: 'en-cours', label: 'En cours' },
  { id: 'termine', label: 'Terminé' },
];

export const REPEATS: { id: Repeat; label: string }[] = [
  { id: 'none', label: 'Jamais' },
  { id: 'daily', label: 'Chaque jour' },
  { id: 'weekdays', label: 'En semaine' },
  { id: 'weekly', label: 'Chaque semaine' },
  { id: 'monthly', label: 'Chaque mois' },
  { id: 'yearly', label: 'Chaque année' },
];

/** Minutes before the start. */
export const REMINDER_PRESETS = [5, 15, 30, 60, 1440];

export const PROJECT_COLORS = ['#d64a62', '#9a7cf0', '#4fb286', '#d9a54a', '#e0806f', '#4bb3c4', '#c47fb4'];

export const OBJECTIVE_COLOR = '#4fb286';

/** Untimed items (all-day events, tasks without a time) are reminded from this hour. */
export const ALL_DAY_REMINDER_AT = 9 * 60;

export function reminderLabel(min: number): string {
  if (min % 10080 === 0) return `${min / 10080} sem.`;
  if (min % 1440 === 0) return min === 1440 ? '1 jour' : `${min / 1440} jours`;
  if (min % 60 === 0) return `${min / 60} h`;
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60}`;
  return `${min} min`;
}

/* ---------- heures ---------- */

export function toMin(t?: string): number | null {
  const m = t ? /^(\d{1,2}):(\d{2})$/.exec(t) : null;
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v < 1440 ? v : null;
}

export function fromMin(v: number): string {
  const c = Math.max(0, Math.min(1439, Math.round(v)));
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}

/** Days since 1970-01-01 for a YYYY-MM-DD key — lets dates be compared and subtracted. */
export function dayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}

/* ---------- répétitions ---------- */

function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Whether a (possibly repeating) event happens on `date`. */
export function occursOn(e: CalEvent, date: string): boolean {
  if (date < e.date) return false;
  if (e.until && date > e.until) return false;
  if (e.exceptions?.includes(date)) return false;
  switch (e.repeat) {
    case 'none':
      return date === e.date;
    case 'daily':
      return true;
    case 'weekdays': {
      const wd = weekdayOf(date);
      return wd >= 1 && wd <= 5;
    }
    case 'weekly':
      return (dayIndex(date) - dayIndex(e.date)) % 7 === 0;
    case 'monthly':
      return date.slice(8) === e.date.slice(8);
    case 'yearly': {
      const md = e.date.slice(5);
      // 29 February only comes back on leap years.
      if (md === '02-29' && !isLeap(Number(date.slice(0, 4)))) return false;
      return date.slice(5) === md;
    }
  }
}

/** Every date in [from, to] on which the event happens. */
export function occurrencesBetween(e: CalEvent, from: string, to: string): string[] {
  const out: string[] = [];
  const start = from > e.date ? from : e.date;
  const span = dayIndex(to) - dayIndex(start);
  for (let i = 0; i <= span; i++) {
    const d = shiftKey(start, i);
    if (occursOn(e, d)) out.push(d);
  }
  return out;
}

/* ---------- éléments affichés ---------- */

export type ItemType = 'event' | 'task' | 'objective';

export type AgendaItem = {
  /** Unique per occurrence: type, id and date. */
  key: string;
  type: ItemType;
  id: string;
  date: string;
  title: string;
  /** Minutes from midnight; null for an all-day / untimed item. */
  start: number | null;
  end: number | null;
  color: string;
  label: string;
  done?: boolean;
  priority?: TaskPriority;
  repeat?: Repeat;
  event?: CalEvent;
  task?: CalTask;
  objective?: Objective;
  project?: AgendaProject;
};

export type AgendaFilters = {
  events: boolean;
  tasks: boolean;
  objectives: boolean;
  showDone: boolean;
  /** Empty = every priority. */
  priorities: TaskPriority[];
};

export const DEFAULT_FILTERS: AgendaFilters = {
  events: true,
  tasks: true,
  objectives: true,
  showDone: true,
  priorities: [],
};

const OBJECTIVE_BLOCK = 30;

export function eventItem(e: CalEvent, date: string): AgendaItem {
  const k = kindOf(e.kind);
  const start = toMin(e.time);
  return {
    key: `event:${e.id}:${date}`,
    type: 'event',
    id: e.id,
    date,
    title: e.title,
    start,
    end: start === null ? null : Math.min(1440, start + Math.max(15, e.duration)),
    color: k.color,
    label: k.label,
    repeat: e.repeat,
    event: e,
  };
}

export function taskItem(t: CalTask, projects: AgendaProject[]): AgendaItem {
  const start = toMin(t.time);
  const project = t.projectId ? projects.find((p) => p.id === t.projectId) : undefined;
  return {
    key: `task:${t.id}`,
    type: 'task',
    id: t.id,
    date: t.date ?? '',
    title: t.title,
    start,
    end: start === null ? null : Math.min(1440, start + Math.max(15, t.duration ?? 30)),
    color: priorityOf(t.priority).color,
    label: project ? project.title : categoryLabel(t.category),
    done: t.status === 'termine',
    priority: t.priority,
    task: t,
    project,
  };
}

export function objectiveItem(o: Objective, date: string, done: boolean): AgendaItem {
  const start = toMin(o.time);
  return {
    key: `objective:${o.id}:${date}`,
    type: 'objective',
    id: o.id,
    date,
    title: o.title,
    start,
    end: start === null ? null : start + OBJECTIVE_BLOCK,
    color: OBJECTIVE_COLOR,
    label: 'Objectif',
    done,
    objective: o,
  };
}

function passes(item: AgendaItem, f: AgendaFilters): boolean {
  if (item.type === 'event' && !f.events) return false;
  if (item.type === 'task') {
    if (!f.tasks) return false;
    if (f.priorities.length > 0 && item.priority && !f.priorities.includes(item.priority)) return false;
  }
  if (item.type === 'objective' && !f.objectives) return false;
  if (!f.showDone && item.done) return false;
  return true;
}

/** Everything on a day, timed items by start time, untimed ones first. */
export function itemsForDay(data: AppData, date: string, filters: AgendaFilters = DEFAULT_FILTERS): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const e of data.agenda.events) if (occursOn(e, date)) out.push(eventItem(e, date));
  for (const t of data.agenda.tasks) if (t.date === date) out.push(taskItem(t, data.agenda.projects));
  const entry = data.daily[date];
  for (const o of objectivesForDate(data.objectives, date)) out.push(objectiveItem(o, date, isDone(entry, o.id)));
  return out.filter((i) => passes(i, filters)).sort(compareItems);
}

export function compareItems(a: AgendaItem, b: AgendaItem): number {
  if (a.start === null && b.start !== null) return -1;
  if (b.start === null && a.start !== null) return 1;
  if (a.start !== null && b.start !== null && a.start !== b.start) return a.start - b.start;
  if (a.type !== b.type) return a.type === 'event' ? -1 : b.type === 'event' ? 1 : a.type === 'task' ? -1 : 1;
  if (a.priority && b.priority) return priorityOf(a.priority).rank - priorityOf(b.priority).rank;
  return a.title.localeCompare(b.title, 'fr');
}

/** Items overlapping in time sit side by side: each gets a lane and the lane count of its cluster. */
export type Placed = AgendaItem & { lane: number; lanes: number };

export function layoutDay(items: AgendaItem[]): Placed[] {
  const timed = items
    .filter((i) => i.start !== null && i.end !== null)
    .sort((a, b) => a.start! - b.start! || b.end! - a.end!);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const flush = () => {
    const lanes = laneEnds.length || 1;
    for (const p of cluster) p.lanes = lanes;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const it of timed) {
    if (it.start! >= clusterEnd && cluster.length > 0) flush();
    let lane = laneEnds.findIndex((end) => end <= it.start!);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end!);
    } else laneEnds[lane] = it.end!;
    cluster.push({ ...it, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, it.end!);
  }
  if (cluster.length > 0) flush();
  return out;
}

/* ---------- projets ---------- */

export function projectTasks(data: AppData, projectId: string): CalTask[] {
  return data.agenda.tasks
    .filter((t) => t.projectId === projectId)
    .sort(
      (a, b) =>
        Number(a.status === 'termine') - Number(b.status === 'termine') ||
        priorityOf(a.priority).rank - priorityOf(b.priority).rank ||
        (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

export function projectProgress(data: AppData, projectId: string) {
  const tasks = data.agenda.tasks.filter((t) => t.projectId === projectId);
  const done = tasks.filter((t) => t.status === 'termine').length;
  return { done, total: tasks.length, ratio: tasks.length ? done / tasks.length : 0 };
}

/* ---------- recherche ---------- */

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export type SearchHit = {
  type: ItemType | 'project';
  id: string;
  title: string;
  detail: string;
  /** Where to jump; the next occurrence for a repeating event. */
  date?: string;
};

/** Titles, descriptions, notes and labels, accent-insensitive. */
export function searchAgenda(data: AppData, query: string, today: string): SearchHit[] {
  const q = norm(query.trim());
  if (!q) return [];
  const hits: SearchHit[] = [];
  const has = (...parts: (string | undefined)[]) => parts.some((p) => p && norm(p).includes(q));

  for (const e of data.agenda.events) {
    if (!has(e.title, e.description, kindOf(e.kind).label)) continue;
    const next =
      e.repeat === 'none' ? e.date : (occurrencesBetween(e, today, shiftKey(today, 400))[0] ?? e.date);
    hits.push({ type: 'event', id: e.id, title: e.title, detail: kindOf(e.kind).label, date: next });
  }
  for (const t of data.agenda.tasks) {
    const project = data.agenda.projects.find((p) => p.id === t.projectId);
    if (!has(t.title, t.notes, project?.title, categoryLabel(t.category))) continue;
    hits.push({
      type: 'task',
      id: t.id,
      title: t.title,
      detail: `Tâche · ${priorityOf(t.priority).label}${project ? ` · ${project.title}` : ''}`,
      date: t.date,
    });
  }
  for (const p of data.agenda.projects) {
    if (!p.archived && has(p.title, p.description)) {
      hits.push({ type: 'project', id: p.id, title: p.title, detail: 'Projet' });
    }
  }
  for (const o of data.objectives) {
    if (!o.archived && has(o.title)) {
      hits.push({
        type: 'objective',
        id: o.id,
        title: o.title,
        detail: 'Objectif',
        date: o.recurrence === 'once' ? o.date : today,
      });
    }
  }
  return hits.slice(0, 30);
}

/* ---------- rappels (serveur) ---------- */

/** A reminder is still sent this long after its moment, to absorb a late cron. */
const REMINDER_WINDOW = 30;

function whenLabel(startIdx: number, startMin: number | null, nowIdx: number): string {
  const days = startIdx - nowIdx;
  const day = days === 0 ? 'Aujourd’hui' : days === 1 ? 'Demain' : days === -1 ? 'Hier' : `Dans ${days} jours`;
  return startMin === null ? day : `${day} à ${fromMin(startMin)}`;
}

/**
 * Reminders due now for events and open tasks. Each (item, occurrence,
 * offset) has its own key, so the cron can call this as often as it wants.
 */
export function agendaReminders(data: AppData, now = new Date()): DueNotification[] {
  const { dateKey, minutes } = localNow(data.settings.timezone, now);
  const nowIdx = dayIndex(dateKey);
  const nowTs = nowIdx * 1440 + minutes;
  const out: DueNotification[] = [];

  const consider = (
    key: string,
    date: string,
    time: string | undefined,
    offsets: number[],
    title: string,
    kindLabel: string,
  ) => {
    const startMin = toMin(time);
    const startIdx = dayIndex(date);
    const startTs = startIdx * 1440 + (startMin ?? ALL_DAY_REMINDER_AT);
    // Only the latest reminder that is due, so a late run never stacks several.
    const due = offsets
      .filter((off) => off >= 0)
      .map((off) => ({ off, at: startTs - off }))
      .filter(({ at }) => nowTs >= at && nowTs - at < REMINDER_WINDOW)
      .sort((a, b) => b.at - a.at)[0];
    if (!due) return;
    out.push({
      key: `${key}:${date}:${due.off}`,
      title: `${kindLabel} — ${title}`,
      body: whenLabel(startIdx, startMin, nowIdx),
      tag: `agenda-${key}`,
      url: `/calendrier?d=${date}`,
    });
  };

  const maxOffset = Math.min(
    60 * 1440,
    Math.max(0, ...data.agenda.events.flatMap((e) => e.reminders), ...data.agenda.tasks.flatMap((t) => t.reminders)),
  );
  const from = shiftKey(dateKey, -1);
  const to = shiftKey(dateKey, Math.ceil(maxOffset / 1440) + 1);

  for (const e of data.agenda.events) {
    if (e.reminders.length === 0) continue;
    for (const d of occurrencesBetween(e, from, to)) {
      consider(`event:${e.id}`, d, e.time, e.reminders, e.title, kindOf(e.kind).label);
    }
  }
  for (const t of data.agenda.tasks) {
    if (!t.date || t.status === 'termine' || t.reminders.length === 0) continue;
    if (t.date < from || t.date > to) continue;
    consider(`task:${t.id}`, t.date, t.time, t.reminders, t.title, 'Tâche');
  }
  return out;
}

/* ---------- valeurs par défaut ---------- */

export function newEvent(partial: Partial<CalEvent> & { date: string; createdAt: string; id: string }): CalEvent {
  const kind = partial.kind ?? 'rdv';
  const k = kindOf(kind);
  return {
    kind,
    title: '',
    duration: k.duration,
    repeat: k.repeat,
    reminders: [k.allDay ? 1440 : 15],
    ...partial,
  };
}

export function newTask(partial: Partial<CalTask> & { createdAt: string; id: string }): CalTask {
  return {
    title: '',
    priority: 'normale',
    status: 'a-faire',
    category: 'personnel' as Category,
    reminders: [],
    ...partial,
  };
}
