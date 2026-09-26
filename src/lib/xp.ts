import type { AppData, Category, DailyEntry, Difficulty, Objective, Reward } from './types';
import { TASKS, dayXp, shiftKey, todayKey, weekdayOf } from './logic';
import { financeActivityDates, financeXpOnDate } from './business';

/* ---------- niveaux ---------- */

/** XP required to go from `level` to the next one. Frequent early, slower later. */
export function xpForNext(level: number): number {
  return 100 + (level - 1) * 25;
}

/** Total XP at which `level` starts. Level 1 starts at 0. */
export function xpForLevel(level: number): number {
  const n = Math.max(0, Math.floor(level) - 1);
  // Sum of xpForNext(1..n) = 100n + 25·n(n−1)/2
  return 100 * n + (25 * n * (n - 1)) / 2;
}

/** Badge family, from the first steps to the long run. Drives the badge colour. */
export type Tier = 'bronze' | 'argent' | 'or' | 'platine' | 'diamant' | 'mythique';

export const TIERS: { id: Tier; label: string; from: number; color: string }[] = [
  { id: 'bronze', label: 'Bronze', from: 1, color: '#c8875a' },
  { id: 'argent', label: 'Argent', from: 5, color: '#b4bfcf' },
  { id: 'or', label: 'Or', from: 10, color: '#e3b64c' },
  { id: 'platine', label: 'Platine', from: 20, color: '#72d0c4' },
  { id: 'diamant', label: 'Diamant', from: 30, color: '#6fa6ff' },
  { id: 'mythique', label: 'Mythique', from: 50, color: '#b88cff' },
];

/** One name per early level: the first steps are the ones that need a push. */
const NAMED_LEVELS = [
  'Débutant',
  'Initié',
  'Régulier',
  'Discipliné',
  'Ambitieux',
  'Performant',
  'Déterminé',
  'Constant',
  'Stratège',
  'Expert',
];

/** Past level 10, each band repeats its name with a rank: Élite I, Élite II… */
const BANDS: { from: number; name: string }[] = [
  { from: 11, name: 'Élite' },
  { from: 15, name: 'Maître' },
  { from: 20, name: 'Champion' },
  { from: 30, name: 'Légende' },
  { from: 50, name: 'Mythe' },
  { from: 100, name: 'Immortel' },
];

function roman(n: number): string {
  const table: [number, string][] = [
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rest = n;
  for (const [v, sym] of table) {
    while (rest >= v) {
      out += sym;
      rest -= v;
    }
  }
  return out;
}

export function levelTitle(level: number): string {
  const l = Math.max(1, Math.floor(level));
  if (l <= NAMED_LEVELS.length) return NAMED_LEVELS[l - 1];
  const band = [...BANDS].reverse().find((b) => l >= b.from)!;
  const rank = l - band.from + 1;
  return rank > 50 ? `${band.name} ${rank}` : `${band.name} ${roman(rank)}`;
}

export function tierOf(level: number): (typeof TIERS)[number] {
  return [...TIERS].reverse().find((t) => level >= t.from) ?? TIERS[0];
}

export type LevelState = {
  level: number;
  /** Name shown next to the number, e.g. "Ambitieux". */
  title: string;
  tier: Tier;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP the current level is worth, start to next. */
  needed: number;
  /** XP still missing to reach the next level. */
  toNext: number;
  total: number;
  /** Total XP at which the current and the next level start. */
  floor: number;
  nextAt: number;
  nextTitle: string;
  /** 0 → 1 inside the current level. */
  progress: number;
};

export function levelFromXp(total: number): LevelState {
  let level = 1;
  const clean = Math.max(0, Math.round(total));
  let remaining = clean;
  while (remaining >= xpForNext(level)) {
    remaining -= xpForNext(level);
    level++;
  }
  const needed = xpForNext(level);
  return {
    level,
    title: levelTitle(level),
    tier: tierOf(level).id,
    intoLevel: remaining,
    needed,
    toNext: needed - remaining,
    total: clean,
    floor: clean - remaining,
    nextAt: clean - remaining + needed,
    nextTitle: levelTitle(level + 1),
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

/** Bonus XP for the actions that matter beyond a single tick. */
export const BONUS_XP = {
  /** Every objective planned for the day is done (at least one planned). */
  allObjectives: 20,
  /** The whole Discipline checklist is ticked. */
  perfectChecklist: 25,
  /**
   * A workout was logged. The Musculation tab is gone, but workouts logged
   * before keep their XP so nobody loses a level.
   */
  workout: 20,
  /** The day was closed with "Terminer ma journée". */
  closedDay: 10,
} as const;

/** Streak lengths that pay a one-off bonus the day they are reached. */
export const STREAK_MILESTONES: { days: number; xp: number }[] = [
  { days: 3, xp: 15 },
  { days: 7, xp: 50 },
  { days: 14, xp: 75 },
  { days: 30, xp: 150 },
  { days: 60, xp: 250 },
  { days: 100, xp: 400 },
  { days: 180, xp: 600 },
  { days: 365, xp: 1000 },
];

export type XpSource = 'objectif' | 'tache' | 'bonus' | 'finance';

export type XpItem = { source: XpSource; label: string; xp: number };

export type DayXp = {
  date: string;
  total: number;
  items: XpItem[];
  /** Consecutive active days ending on this date. */
  streak: number;
};

type Ledger = { days: Map<string, DayXp>; dates: string[] };

type TaskXp = (e?: DailyEntry) => number;

/**
 * Every date that carries XP, with the detail of where it came from. Nothing
 * is stored apart: it is replayed from the saved ticks, objectives, workouts
 * and finance entries, so it can never drift from them. Computed once per
 * version of the data — every update produces a new object.
 */
const ledgers = new WeakMap<AppData, Map<TaskXp, Ledger>>();

function ledgerOf(data: AppData, taskXp: TaskXp): Ledger {
  let byFn = ledgers.get(data);
  if (!byFn) {
    byFn = new Map();
    ledgers.set(data, byFn);
  }
  const cached = byFn.get(taskXp);
  if (cached) return cached;

  const workoutDates = new Set(data.workouts.map((w) => w.date));
  const dates = [
    ...new Set([...Object.keys(data.daily), ...financeActivityDates(data), ...workoutDates]),
  ].sort();
  const byId = new Map(data.objectives.map((o) => [o.id, o]));
  const maxChecklist = taskXp({ tasks: Object.fromEntries(TASKS.map((t) => [t.id, true])) });

  const days = new Map<string, DayXp>();
  let previous: string | null = null;
  let streak = 0;
  for (const date of dates) {
    const entry = data.daily[date];
    const items: XpItem[] = [];

    const done = entry?.objectives ?? [];
    for (const id of done) {
      const o = byId.get(id);
      if (o && o.xp > 0) items.push({ source: 'objectif', label: o.title, xp: o.xp });
    }
    if (entry) {
      for (const t of TASKS) {
        if (!entry.tasks?.[t.id]) continue;
        const one = taskXp({ tasks: { [t.id]: true } });
        if (one > 0) items.push({ source: 'tache', label: t.label, xp: one });
      }
    }
    const finance = financeXpOnDate(data, date);
    if (finance > 0) items.push({ source: 'finance', label: 'Épargne et investissement', xp: finance });

    const planned = objectivesForDate(data.objectives, date);
    if (planned.length > 0 && planned.every((o) => done.includes(o.id))) {
      items.push({ source: 'bonus', label: 'Tous les objectifs du jour', xp: BONUS_XP.allObjectives });
    }
    if (entry && maxChecklist > 0 && taskXp(entry) >= maxChecklist) {
      items.push({ source: 'bonus', label: 'Discipline au complet', xp: BONUS_XP.perfectChecklist });
    }
    if (workoutDates.has(date)) {
      items.push({ source: 'bonus', label: 'Séance enregistrée', xp: BONUS_XP.workout });
    }

    const active = items.length > 0;
    if (entry?.closed && active) {
      items.push({ source: 'bonus', label: 'Journée bouclée', xp: BONUS_XP.closedDay });
    }

    streak = active ? (previous !== null && shiftKey(previous, 1) === date ? streak + 1 : 1) : 0;
    previous = active ? date : null;
    const milestone = active ? STREAK_MILESTONES.find((m) => m.days === streak) : undefined;
    if (milestone) {
      items.push({ source: 'bonus', label: `Série de ${milestone.days} jours`, xp: milestone.xp });
    }

    const total = items.reduce((a, i) => a + i.xp, 0);
    if (total > 0) days.set(date, { date, total, items, streak });
  }

  const ledger = { days, dates: [...days.keys()] };
  byFn.set(taskXp, ledger);
  return ledger;
}

/** Where the XP of a date came from. Empty when nothing was earned. */
export function dayBreakdown(data: AppData, date: string, taskXp: TaskXp): DayXp {
  return ledgerOf(data, taskXp).days.get(date) ?? { date, total: 0, items: [], streak: 0 };
}

/**
 * XP earned on a date: objectives completed, checklist ticks, finance activity
 * and the bonuses for the actions that matter (full day, workout logged, day
 * closed, streak milestones).
 */
export function xpOnDate(data: AppData, date: string, taskXp: TaskXp): number {
  return ledgerOf(data, taskXp).days.get(date)?.total ?? 0;
}

/** Every date that carries XP, oldest first. */
function activityDates(data: AppData, taskXp: TaskXp = dayXp): string[] {
  return ledgerOf(data, taskXp).dates;
}

export function totalXpOf(data: AppData, taskXp: TaskXp): number {
  let sum = 0;
  for (const d of ledgerOf(data, taskXp).days.values()) sum += d.total;
  return sum;
}

/* ---------- streak ---------- */

/** Consecutive days ending today (or yesterday) where at least some XP was earned. */
export function streakOf(data: AppData, tz: string, taskXp: TaskXp): number {
  const days = ledgerOf(data, taskXp).days;
  const today = todayKey(tz);
  return days.get(today)?.streak ?? days.get(shiftKey(today, -1))?.streak ?? 0;
}

export function bestStreakOf(data: AppData, taskXp: TaskXp): number {
  let best = 0;
  for (const d of ledgerOf(data, taskXp).days.values()) best = Math.max(best, d.streak);
  return best;
}

/* ---------- statistiques de progression ---------- */

export type ProgressStats = {
  level: LevelState;
  streak: number;
  bestStreak: number;
  today: number;
  last7: number;
  /** XP of the seven days before the last seven, for the trend. */
  previous7: number;
  /** Average XP per day over the last 30 days, idle days included. */
  avg30: number;
  activeDays: number;
  objectivesDone: number;
  bestDay: { date: string; xp: number } | null;
  /** Days to the next level at the 30-day pace; null without a pace yet. */
  daysToNext: number | null;
  /** The last days that earned XP, newest first, with their detail. */
  recentDays: DayXp[];
};

export function progressStats(data: AppData, tz: string, taskXp: TaskXp, recentCount = 5): ProgressStats {
  const ledger = ledgerOf(data, taskXp);
  const today = todayKey(tz);
  const level = levelFromXp(totalXpOf(data, taskXp));

  const sumRange = (from: number, to: number) => {
    let s = 0;
    for (let i = from; i < to; i++) s += ledger.days.get(shiftKey(today, -i))?.total ?? 0;
    return s;
  };
  const last30 = sumRange(0, 30);
  const avg30 = Math.round(last30 / 30);

  let bestDay: ProgressStats['bestDay'] = null;
  for (const d of ledger.days.values()) {
    if (!bestDay || d.total > bestDay.xp) bestDay = { date: d.date, xp: d.total };
  }

  const recentDays = ledger.dates
    .slice(-recentCount)
    .reverse()
    .map((d) => ledger.days.get(d)!);

  return {
    level,
    streak: streakOf(data, tz, taskXp),
    bestStreak: bestStreakOf(data, taskXp),
    today: ledger.days.get(today)?.total ?? 0,
    last7: sumRange(0, 7),
    previous7: sumRange(7, 14),
    avg30,
    activeDays: ledger.dates.length,
    objectivesDone: Object.values(data.daily).reduce((a, e) => a + (e.objectives?.length ?? 0), 0),
    bestDay,
    daysToNext: avg30 > 0 ? Math.ceil(level.toNext / avg30) : null,
    recentDays,
  };
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
  const dates = activityDates(data, taskXp);
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
  for (const date of activityDates(data, taskXp)) {
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
