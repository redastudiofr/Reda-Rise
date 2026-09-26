import type { AppData, DailyEntry } from './types';

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

export const TASKS: Task[] = [
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

export const MAX_DAY_XP = TASKS.reduce((a, t) => a + t.xp, 0);

export function dayXp(entry?: DailyEntry): number {
  if (!entry) return 0;
  return TASKS.reduce((a, t) => a + (entry.tasks?.[t.id] ? t.xp : 0), 0);
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
