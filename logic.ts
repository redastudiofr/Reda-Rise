import type { AppData, DailyEntry, DayPlan, LoggedWorkout } from './types';
import { dayForWeekday, findExercise, WEEK } from './program';

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

export function planForDate(key: string): DayPlan {
  return dayForWeekday(weekdayOf(key));
}

export function todayPlan(tz: string): DayPlan {
  return planForDate(todayKey(tz));
}

/** Week order used everywhere in the UI: Monday → Sunday. */
export const WEEK_ORDERED: DayPlan[] = [...WEEK.slice(1), WEEK[0]];

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

export type Level = { name: string; min: number };

export const LEVELS: Level[] = [
  { name: 'Fondation', min: 0 },
  { name: 'Régularité', min: 600 },
  { name: 'Discipline', min: 1800 },
  { name: 'Performance', min: 4000 },
  { name: 'Elite', min: 8000 },
];

export function dayXp(entry?: DailyEntry): number {
  if (!entry) return 0;
  return TASKS.reduce((a, t) => a + (entry.tasks?.[t.id] ? t.xp : 0), 0);
}

export function totalXp(daily: Record<string, DailyEntry>): number {
  return Object.values(daily).reduce((a, e) => a + dayXp(e), 0);
}

export function levelInfo(xp: number) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].min) index = i;
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(1, (xp - current.min) / span) : 1;
  return {
    index,
    current,
    next,
    progress,
    remaining: next ? Math.max(0, next.min - xp) : 0,
  };
}

/** A day counts for the streak when at least 60 % of the checklist XP is earned. */
export function isDaySuccessful(entry?: DailyEntry): boolean {
  return dayXp(entry) >= MAX_DAY_XP * 0.6;
}

export function currentStreak(daily: Record<string, DailyEntry>, tz: string): number {
  const today = todayKey(tz);
  let streak = 0;
  let cursor = isDaySuccessful(daily[today]) ? today : shiftKey(today, -1);
  while (isDaySuccessful(daily[cursor])) {
    streak++;
    cursor = shiftKey(cursor, -1);
  }
  return streak;
}

export function last7Rate(daily: Record<string, DailyEntry>, tz: string): number {
  const today = todayKey(tz);
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += dayXp(daily[shiftKey(today, -i)]);
  return Math.round((sum / (MAX_DAY_XP * 7)) * 100);
}

/* ---------- workouts ---------- */

export function workoutOn(workouts: LoggedWorkout[], date: string): LoggedWorkout | null {
  return workouts.find((w) => w.date === date) ?? null;
}

export type Suggestion = { weight: number; raise: boolean; reason: string };

/**
 * Suggest the load for the next session: once every working set reaches the top
 * of the rep range, add one increment.
 */
export function suggestLoad(
  exerciseId: string,
  currentWeight: number,
  workouts: LoggedWorkout[],
): Suggestion {
  const ex = findExercise(exerciseId);
  if (!ex || ex.increment === 0 || ex.unit === 'sec' || ex.unit === 'min') {
    return { weight: currentWeight, raise: false, reason: 'Progression sur la durée' };
  }
  const history = [...workouts].sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = history.find((w) => w.exercises.some((e) => e.exerciseId === exerciseId));
  const entry = last?.exercises.find((e) => e.exerciseId === exerciseId);
  const sets = entry?.sets.filter((s) => s.reps > 0) ?? [];
  if (sets.length === 0) {
    return { weight: currentWeight, raise: false, reason: 'Aucune donnée — garder la charge' };
  }
  const allTop = sets.length >= ex.sets && sets.every((s) => s.reps >= ex.repMax);
  if (allTop) {
    return {
      weight: Math.round((currentWeight + ex.increment) * 100) / 100,
      raise: true,
      reason: `${ex.repMax} reps sur toutes les séries — passe à`,
    };
  }
  const belowMin = sets.some((s) => s.reps < ex.repMin);
  return {
    weight: currentWeight,
    raise: false,
    reason: belowMin
      ? 'Fourchette basse non atteinte — consolider'
      : `Viser ${ex.repMax} reps sur toutes les séries`,
  };
}

/* ---------- records ---------- */

export type PersonalRecord = {
  exerciseId: string;
  name: string;
  dayTitle: string;
  unit: string;
  weight: number;
  reps: number;
  date: string;
  previous: { weight: number; reps: number; date: string } | null;
};

function score(weight: number, reps: number) {
  // Epley estimated 1RM, keeps bodyweight moves comparable via added load.
  return (weight + 1) * (1 + reps / 30);
}

export function computeRecords(workouts: LoggedWorkout[]): PersonalRecord[] {
  const byExercise = new Map<string, { weight: number; reps: number; date: string }[]>();
  for (const w of [...workouts].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const e of w.exercises) {
      const best = e.sets
        .filter((s) => s.reps > 0)
        .sort((a, b) => score(b.weight, b.reps) - score(a.weight, a.reps))[0];
      if (!best) continue;
      const arr = byExercise.get(e.exerciseId) ?? [];
      arr.push({ weight: best.weight, reps: best.reps, date: w.date });
      byExercise.set(e.exerciseId, arr);
    }
  }

  const out: PersonalRecord[] = [];
  for (const [exerciseId, entries] of byExercise) {
    const ex = findExercise(exerciseId);
    if (!ex) continue;
    let best: { weight: number; reps: number; date: string } | null = null;
    let previous: { weight: number; reps: number; date: string } | null = null;
    for (const e of entries) {
      if (!best || score(e.weight, e.reps) > score(best.weight, best.reps)) {
        if (best) previous = best;
        best = e;
      }
    }
    if (!best) continue;
    out.push({
      exerciseId,
      name: ex.name,
      dayTitle: ex.dayTitle,
      unit: ex.unit,
      weight: best.weight,
      reps: best.reps,
      date: best.date,
      previous,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ---------- misc ---------- */

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
