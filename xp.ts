import type { AppData, Category, DailyEntry, Difficulty, Objective, Reward } from './types';
import { shiftKey, todayKey, weekdayOf } from './logic';
import { financeActivityDates, financeXpOnDate } from './business';

/* ---------- niveaux ---------- */

/** XP required to go from `level` to the next one. Frequent early, slower later. */
export function xpForNext(level: number): number {
  return 100 + (level - 1) * 25;
}

export type LevelState = {
  level: number;
  intoLevel: number;
  needed: number;
  total: number;
  progress: number;
};

export function levelFromXp(total: number): LevelState {
  let level = 1;
  let remaining = Math.max(0, Math.round(total));
  while (remaining >= xpForNext(level)) {
    remaining -= xpForNext(level);
    level++;
  }
  const needed = xpForNext(level);
  return {
    level,
    intoLevel: remaining,
    needed,
    total: Math.max(0, Math.round(total)),
    progress: needed > 0 ? remaining / needed : 0,
  };
}

/* ---------- catégories et difficultés ---------- */

export const CATEGORIES: { id: Category; label: string; short: string }[] = [
  { id: 'sport', label: 'Sport', short: 'SPO' },
  { id: 'entrepreneuriat', label: 'Entrepreneuriat', short: 'ENT' },
  { id: 'travail', label: 'Travail', short: 'TRA' },
  { id: 'etudes', label: 'Études', short: 'ETU' },
  { id: 'discipline', label: 'Discipline', short: 'DIS' },
  { id: 'habitudes', label: 'Habitudes', short: 'HAB' },
  { id: 'personnel', label: 'Personnel', short: 'PER' },
  { id: 'autre', label: 'Autre', short: 'AUT' },
];

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Autre';
}

export const DIFFICULTIES: { id: Difficulty; label: string; xp: number }[] = [
  { id: 'facile', label: 'Facile', xp: 10 },
  { id: 'moyen', label: 'Moyen', xp: 25 },
  { id: 'difficile', label: 'Difficile', xp: 50 },
  { id: 'epique', label: 'Épique', xp: 100 },
];

export function difficultyLabel(id: Difficulty): string {
  return DIFFICULTIES.find((d) => d.id === id)?.label ?? 'Moyen';
}

export function defaultXp(difficulty: Difficulty): number {
  return DIFFICULTIES.find((d) => d.id === difficulty)?.xp ?? 25;
}

/* ---------- objectifs du jour ---------- */

/** Objectives scheduled for a given date, in display order. */
export function objectivesForDate(objectives: Objective[], date: string): Objective[] {
  const weekday = weekdayOf(date);
  return objectives
    .filter((o) => {
      if (o.archived) return false;
      if (o.recurrence === 'daily') return true;
      if (o.recurrence === 'weekdays') return (o.days ?? []).includes(weekday);
      return o.date === date;
    })
    .sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export function isDone(entry: DailyEntry | undefined, id: string): boolean {
  return Boolean(entry?.objectives?.includes(id));
}

/* ---------- XP par jour ---------- */

/**
 * XP earned on a date: checklist ticks, every objective completed, and finance
 * activity (savings/investment contributions, goals reached, regularity). A
 * date needs no checklist entry to carry finance XP.
 */
export function xpOnDate(data: AppData, date: string, taskXp: (e?: DailyEntry) => number): number {
  const entry = data.daily[date];
  const done = entry?.objectives ?? [];
  const fromObjectives = done.reduce((sum, id) => {
    const o = data.objectives.find((x) => x.id === id);
    return sum + (o?.xp ?? 0);
  }, 0);
  const fromTasks = entry ? taskXp(entry) : 0;
  return fromTasks + fromObjectives + financeXpOnDate(data, date);
}

/** Every date checklist ticks, objectives, or finance activity could contribute XP on. */
function activityDates(data: AppData): string[] {
  return [...new Set([...Object.keys(data.daily), ...financeActivityDates(data)])];
}

export function totalXpOf(data: AppData, taskXp: (e?: DailyEntry) => number): number {
  return activityDates(data).reduce((sum, date) => sum + xpOnDate(data, date, taskXp), 0);
}

/* ---------- streak ---------- */

/** Consecutive days ending today (or yesterday) where at least some XP was earned. */
export function streakOf(data: AppData, tz: string, taskXp: (e?: DailyEntry) => number): number {
  const today = todayKey(tz);
  let cursor = xpOnDate(data, today, taskXp) > 0 ? today : shiftKey(today, -1);
  let streak = 0;
  while (xpOnDate(data, cursor, taskXp) > 0) {
    streak++;
    cursor = shiftKey(cursor, -1);
  }
  return streak;
}

/* ---------- série temporelle pour la courbe ---------- */

export type RangeId = '7j' | '30j' | '3m' | '6m' | '1an' | 'tout';

export const RANGES: { id: RangeId; label: string; days: number }[] = [
  { id: '7j', label: '7 j', days: 7 },
  { id: '30j', label: '30 j', days: 30 },
  { id: '3m', label: '3 mois', days: 90 },
  { id: '6m', label: '6 mois', days: 180 },
  { id: '1an', label: '1 an', days: 365 },
  { id: 'tout', label: 'Tout', days: 0 },
];

export type MetricId = 'xpCumule' | 'xpJour' | 'objectifs' | 'niveau';

export const METRICS: { id: MetricId; label: string }[] = [
  { id: 'xpCumule', label: 'XP cumulé' },
  { id: 'xpJour', label: 'XP par jour' },
  { id: 'objectifs', label: 'Objectifs' },
  { id: 'niveau', label: 'Niveau' },
];

export type Point = { date: string; value: number };

/**
 * Builds the curve for one metric over one range. Cumulative metrics count
 * everything before the window so the line starts at the right height.
 */
export function series(
  data: AppData,
  tz: string,
  metric: MetricId,
  range: RangeId,
  taskXp: (e?: DailyEntry) => number,
): Point[] {
  const today = todayKey(tz);
  const dates = activityDates(data).sort();
  const first = dates[0] ?? today;

  const cfg = RANGES.find((r) => r.id === range) ?? RANGES[0];
  let start: string;
  if (cfg.days === 0) {
    start = first < today ? first : shiftKey(today, -6);
  } else {
    start = shiftKey(today, -(cfg.days - 1));
    if (first > start && metric !== 'xpCumule' && metric !== 'niveau') start = first;
  }

  // Cap the number of plotted points so a year stays readable.
  const span = Math.max(1, daysBetween(start, today) + 1);
  const step = Math.max(1, Math.ceil(span / 90));

  let running = 0;
  if (metric === 'xpCumule' || metric === 'niveau') {
    for (const d of dates) if (d < start) running += xpOnDate(data, d, taskXp);
  }

  const points: Point[] = [];
  for (let i = 0; i < span; i++) {
    const date = shiftKey(start, i);
    const dayXpValue = xpOnDate(data, date, taskXp);
    running += dayXpValue;
    if (i % step !== 0 && i !== span - 1) continue;

    let value = 0;
    if (metric === 'xpCumule') value = running;
    else if (metric === 'niveau') value = levelFromXp(running).level;
    else if (metric === 'xpJour') value = dayXpValue;
    else value = data.daily[date]?.objectives?.length ?? 0;

    points.push({ date, value });
  }
  return points;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.round((db - da) / 86_400_000);
}

/* ---------- récompenses ---------- */

export function sortedRewards(rewards: Reward[]): Reward[] {
  return [...rewards].sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
}

/**
 * The first date each level was reached, replayed from the very first recorded
 * day. Nothing extra is stored: the dates come out of the XP history itself, so
 * a reward added today still shows when its level was actually passed.
 */
export function levelTimeline(
  data: AppData,
  taskXp: (e?: DailyEntry) => number,
): Map<number, string> {
  const reachedOn = new Map<number, string>();
  let running = 0;
  let level = 1;
  for (const date of activityDates(data).sort()) {
    running += xpOnDate(data, date, taskXp);
    const reached = levelFromXp(running).level;
    while (level < reached) {
      level += 1;
      reachedOn.set(level, date);
    }
  }
  return reachedOn;
}

export type RewardState = {
  reward: Reward;
  unlocked: boolean;
  /** The day the level was reached, when it happened on a recorded day. */
  unlockedAt?: string;
  levelsLeft: number;
  /** 0 → 1 towards the level that unlocks it, from the previous reward tier. */
  progress: number;
};

/**
 * Rewards in level order, each with whether it is unlocked, when, and how far
 * the user is from it. Progress is measured between the previous tier and this
 * one, so the bar fills steadily rather than jumping.
 */
export function rewardStates(
  data: AppData,
  taskXp: (e?: DailyEntry) => number,
): RewardState[] {
  const total = totalXpOf(data, taskXp);
  const current = levelFromXp(total);
  const timeline = levelTimeline(data, taskXp);
  const ordered = sortedRewards(data.rewards);

  let previousTier = 1;
  return ordered.map((reward) => {
    const unlocked = current.level >= reward.level;
    const from = Math.min(previousTier, reward.level);
    const span = Math.max(1, reward.level - from);
    const progress = unlocked ? 1 : Math.max(0, Math.min(1, (current.level - from) / span));
    previousTier = reward.level;
    return {
      reward,
      unlocked,
      unlockedAt: unlocked ? timeline.get(reward.level) : undefined,
      levelsLeft: Math.max(0, reward.level - current.level),
      progress,
    };
  });
}
