import type {
  Agenda,
  AppData,
  Bank,
  Investments,
  Objective,
  Player,
  Reward,
  Savings,
  Settings,
} from './types';
import { DEFAULT_DISCIPLINE, normalizeDiscipline } from './logic';

/** Milestone rewards everyone starts with. The user can add their own. */
export const DEFAULT_REWARDS: Reward[] = [
  { id: 'r-5', level: 5, label: 'Premier pas', custom: false },
  { id: 'r-10', level: 10, label: 'Discipline', custom: false },
  { id: 'r-20', level: 20, label: 'Régularité', custom: false },
  { id: 'r-50', level: 50, label: 'Machine', custom: false },
  { id: 'r-100', level: 100, label: 'Elite', custom: false },
];

export const DEFAULT_SETTINGS: Settings = {
  profile: {
    name: 'Reda',
    pseudo: 'Reda',
    email: '',
    avatar: '',
    age: 17,
    heightCm: 185,
    weightKg: 71,
    goal: 'Physique musclé, sec et proportionné — progression saine sur le long terme',
  },
  timezone: 'Europe/Paris',
  discipline: DEFAULT_DISCIPLINE,
  cosmetics: {},
  notifications: {
    creatine: { enabled: true, time: '09:00' },
    hydration: { enabled: true, start: '08:00', end: '22:00', everyHours: 2 },
    meals: { enabled: true, times: ['08:00', '12:30', '19:30'] },
    sleep: { enabled: true, time: '22:30' },
    objectives: { enabled: true, time: '18:00' },
    dayCheck: { enabled: true, times: ['20:00', '22:00'] },
    review: { enabled: true, time: '21:30' },
  },
};

export function defaultData(): AppData {
  return {
    version: 5,
    updatedAt: Date.now(),
    settings: DEFAULT_SETTINGS,
    daily: {},
    workouts: [],
    measurements: [],
    objectives: [],
    projects: [],
    finances: [],
    savings: { target: 0, entries: [] },
    investments: { entries: [], holdings: [] },
    financialGoals: [],
    accounts: [],
    savingsGoals: [],
    monthlySavingsTarget: 0,
    subscriptions: [],
    bank: { connections: [], accounts: [], transactions: [] },
    agenda: { events: [], tasks: [], projects: [] },
    proofs: {},
    player: { id: newPlayerId(), shareToLeaderboard: false },
    rewards: DEFAULT_REWARDS,
    wardrobe: { items: [], orders: [] },
  };
}

/** Random, opaque, and generated on the device — it identifies a board entry, not a person. */
function newPlayerId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Objectives used to be simple "goals". Carry them over rather than lose them. */
type LegacyGoal = { id?: string; title?: string; createdAt?: string; done?: boolean };

function migrateGoals(raw: unknown): Objective[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g): g is LegacyGoal => Boolean(g) && typeof g === 'object')
    .filter((g) => typeof g.title === 'string' && g.title.length > 0)
    .map((g) => ({
      id: g.id ?? Math.random().toString(36).slice(2, 10),
      title: g.title as string,
      category: 'personnel' as const,
      difficulty: 'moyen' as const,
      xp: 25,
      recurrence: 'once' as const,
      date: g.createdAt,
      createdAt: g.createdAt ?? new Date().toISOString().slice(0, 10),
      archived: g.done === true,
    }));
}

/** Merge stored data with defaults so a new field never breaks an old payload. */
export function normalizeData(raw: unknown): AppData {
  const base = defaultData();
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Partial<AppData> & {
    savings?: Partial<Savings>;
    investments?: Partial<Investments>;
    bank?: Partial<Bank>;
    player?: Partial<Player>;
    agenda?: Partial<Agenda>;
  };
  const s = (d.settings ?? {}) as Partial<Settings>;
  const n = (s.notifications ?? {}) as Partial<Settings['notifications']>;
  const legacy = (raw as { goals?: unknown }).goals;
  const objectives = Array.isArray(d.objectives) ? d.objectives : migrateGoals(legacy);
  const rewards = Array.isArray(d.rewards) && d.rewards.length > 0 ? d.rewards : DEFAULT_REWARDS;

  return {
    version: 5,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
    settings: {
      profile: { ...base.settings.profile, ...(s.profile ?? {}) },
      timezone: s.timezone || base.settings.timezone,
      discipline: normalizeDiscipline(s.discipline),
      cosmetics: s.cosmetics && typeof s.cosmetics === 'object' ? s.cosmetics : {},
      notifications: {
        creatine: { ...base.settings.notifications.creatine, ...(n.creatine ?? {}) },
        hydration: { ...base.settings.notifications.hydration, ...(n.hydration ?? {}) },
        meals: { ...base.settings.notifications.meals, ...(n.meals ?? {}) },
        sleep: { ...base.settings.notifications.sleep, ...(n.sleep ?? {}) },
        objectives: { ...base.settings.notifications.objectives, ...(n.objectives ?? {}) },
        dayCheck: { ...base.settings.notifications.dayCheck, ...(n.dayCheck ?? {}) },
        review: { ...base.settings.notifications.review, ...(n.review ?? {}) },
      },
    },
    daily: d.daily ?? {},
    workouts: Array.isArray(d.workouts) ? d.workouts : [],
    measurements: Array.isArray(d.measurements) ? d.measurements : [],
    objectives,
    projects: Array.isArray(d.projects) ? d.projects : [],
    finances: Array.isArray(d.finances) ? d.finances : [],
    savings: {
      target: typeof d.savings?.target === 'number' ? d.savings.target : 0,
      entries: Array.isArray(d.savings?.entries) ? d.savings.entries : [],
    },
    investments: {
      entries: Array.isArray(d.investments?.entries) ? d.investments.entries : [],
      holdings: Array.isArray(d.investments?.holdings) ? d.investments.holdings : [],
    },
    financialGoals: Array.isArray(d.financialGoals) ? d.financialGoals : [],
    accounts: Array.isArray(d.accounts) ? d.accounts : [],
    savingsGoals: Array.isArray(d.savingsGoals) ? d.savingsGoals : [],
    monthlySavingsTarget:
      typeof d.monthlySavingsTarget === 'number' && d.monthlySavingsTarget > 0 ? d.monthlySavingsTarget : 0,
    subscriptions: Array.isArray(d.subscriptions) ? d.subscriptions : [],
    bank: {
      connections: Array.isArray(d.bank?.connections) ? d.bank.connections : [],
      accounts: Array.isArray(d.bank?.accounts) ? d.bank.accounts : [],
      transactions: Array.isArray(d.bank?.transactions) ? d.bank.transactions : [],
      lastSyncAt: typeof d.bank?.lastSyncAt === 'string' ? d.bank.lastSyncAt : undefined,
    },
    agenda: {
      events: Array.isArray(d.agenda?.events) ? d.agenda.events : [],
      tasks: Array.isArray(d.agenda?.tasks) ? d.agenda.tasks : [],
      projects: Array.isArray(d.agenda?.projects) ? d.agenda.projects : [],
    },
    proofs: d.proofs && typeof d.proofs === 'object' ? d.proofs : {},
    player: {
      id: typeof d.player?.id === 'string' && d.player.id ? d.player.id : newPlayerId(),
      shareToLeaderboard: d.player?.shareToLeaderboard === true,
    },
    rewards,
    wardrobe: {
      items: Array.isArray(d.wardrobe?.items) ? d.wardrobe.items : [],
      orders: Array.isArray(d.wardrobe?.orders) ? d.wardrobe.orders : [],
    },
  };
}
