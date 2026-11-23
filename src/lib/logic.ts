import type { AppData, DailyEntry, DisciplineTask } from './types';

/* ---------- dates ---------- */

export function todayKey(tz = 'Europe/Paris', d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function shiftKey(key: string, days: number): string {
  const [y, m, dd] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, dd));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function formatShort(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** The seven date keys of the week containing `dateKey`, Monday first. */
export function weekDatesFrom(dateKey: string): string[] {
  const wd = weekdayOf(dateKey);
  const monday = shiftKey(dateKey, wd === 0 ? -6 : 1 - wd);
  return Array.from({ length: 7 }, (_, i) => shiftKey(monday, i));
}

/** The seven date keys of the current week, Monday first. */
export function weekDates(tz: string): string[] {
  return weekDatesFrom(todayKey(tz));
}

/* ---------- weekly plan ---------- */


/* ---------- checklist / XP ---------- */

export type Task = { id: string; label: string; hint: string; xp: number };

/**
 * The fixed checklist used before it became customisable. Kept so that days
 * recorded back then keep exactly the XP they earned.
 */
export const LEGACY_TASKS: Task[] = [
  { id: 'seance', label: 'Séance effectuée', hint: 'Entraînement du jour terminé', xp: 30 },
  { id: 'creatine', label: 'Créatine', hint: '3 à 5 g, tous les jours', xp: 10 },
  { id: 'repas', label: '3 repas complets', hint: 'Matin, midi, soir', xp: 15 },
  { id: 'proteines', label: 'Apport protéines', hint: 'Environ 2 g par kg', xp: 15 },
  { id: 'hydratation', label: 'Hydratation', hint: '2,5 à 3 L sur la journée', xp: 10 },
  { id: 'fruits', label: 'Fruits et légumes', hint: 'À chaque repas', xp: 10 },
  { id: 'activite', label: 'Marche', hint: 'La marche du jour est faite', xp: 10 },
  { id: 'sommeil', label: 'Sommeil', hint: '8 heures minimum', xp: 15 },
  { id: 'alimentation', label: 'Alimentation respectée', hint: 'Pas d’écart majeur', xp: 10 },
  { id: 'journal', label: 'Journal rempli', hint: 'Séance et ressenti notés', xp: 5 },
];

export const DISCIPLINE_LIMITS = { min: 1, max: 15, xpMin: 1, xpMax: 20, label: 60, hint: 80 } as const;

/** Starting list: the former checklist, XP capped to the 1–20 range. The user edits it freely. */
export const DEFAULT_DISCIPLINE: DisciplineTask[] = LEGACY_TASKS.map((t) => ({
  id: t.id,
  label: t.label,
  hint: t.hint,
  xp: Math.min(t.xp, DISCIPLINE_LIMITS.xpMax),
}));

export function clampTaskXp(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 10;
  return Math.min(DISCIPLINE_LIMITS.xpMax, Math.max(DISCIPLINE_LIMITS.xpMin, n));
}

/** A valid checklist: 1 to 15 named items, unique ids, XP between 1 and 20. */
export function normalizeDiscipline(list: unknown): DisciplineTask[] {
  if (!Array.isArray(list)) return DEFAULT_DISCIPLINE.map((t) => ({ ...t }));
  const seen = new Set<string>();
  const out: DisciplineTask[] = [];
  for (const raw of list as Partial<DisciplineTask>[]) {
    const label = typeof raw?.label === 'string' ? raw.label.trim().slice(0, DISCIPLINE_LIMITS.label) : '';
    const id = typeof raw?.id === 'string' && raw.id ? raw.id : '';
    if (!label || !id || seen.has(id)) continue;
    seen.add(id);
    const hint = typeof raw.hint === 'string' ? raw.hint.trim().slice(0, DISCIPLINE_LIMITS.hint) : '';
    out.push({ id, label, ...(hint ? { hint } : {}), xp: clampTaskXp(raw.xp) });
    if (out.length >= DISCIPLINE_LIMITS.max) break;
  }
  return out.length >= DISCIPLINE_LIMITS.min ? out : DEFAULT_DISCIPLINE.map((t) => ({ ...t }));
}

/** The checklist that applied on a day: its own saved copy, or the former fixed list. */
export function entryChecklist(entry?: DailyEntry): { id: string; label: string; xp: number }[] {
  return entry?.checklist ?? LEGACY_TASKS;
}

export function checklistMax(list: { xp: number }[]): number {
  return list.reduce((a, t) => a + t.xp, 0);
}

/** XP from the Discipline checklist on a day. */
export function dayXp(entry?: DailyEntry): number {
  if (!entry) return 0;
  return entryChecklist(entry).reduce((a, t) => a + (entry.tasks?.[t.id] ? t.xp : 0), 0);
}

/** Every item of that day's checklist is ticked. */
export function checklistComplete(entry?: DailyEntry): boolean {
  if (!entry) return false;
  const list = entryChecklist(entry);
  return list.length > 0 && list.every((t) => entry.tasks?.[t.id]);
}


export function latestMeasurement(data: AppData) {
  return [...data.measurements].sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Short axis-friendly number: 940, 12k, 1,4M. Keeps chart gutters narrow. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(Math.round(value / 100_000) / 10).toLocaleString('fr-FR')}M`;
  if (abs >= 10_000) return `${Math.round(value / 1000)}k`;
  return Math.round(value).toLocaleString('fr-FR');
}
