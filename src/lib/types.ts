export type Unit = 'kg' | 'bw' | 'sec' | 'min';

export type MuscleGroup =
  | 'jambes'
  | 'dos'
  | 'pectoraux'
  | 'epaules'
  | 'bras'
  | 'abdos'
  | 'cardio'
  | 'autre';

export type Equipment = 'barre' | 'halteres' | 'poulie' | 'machine' | 'poids-du-corps' | 'aucun';

export type Exercise = {
  id: string;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  rpe: number;
  unit: Unit;
  defaultWeight: number;
  increment: number;
  group?: MuscleGroup;
  equipment?: Equipment;
  note?: string;
};

/** One day of the fixed weekly schedule. */
export type DayPlan = {
  id: string;
  weekday: number; // 0 = dimanche … 6 = samedi
  label: string;
  title: string;
  focus: string;
  rest: boolean;
  exercises: Exercise[];
};

export type SetEntry = { weight: number; reps: number };
export type LoggedExercise = { exerciseId: string; sets: SetEntry[] };
export type LoggedWorkout = {
  id: string;
  date: string;
  sessionId: string;
  exercises: LoggedExercise[];
};

/* ---------- objectifs ---------- */

export type Category =
  | 'sport'
  | 'entrepreneuriat'
  | 'travail'
  | 'etudes'
  | 'discipline'
  | 'habitudes'
  | 'personnel'
  | 'autre';

export type Difficulty = 'facile' | 'moyen' | 'difficile' | 'epique';

/** How often an objective comes back on the day list. */
export type Recurrence = 'once' | 'daily' | 'weekdays';

export type Objective = {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  xp: number;
  time?: string; // HH:MM
  recurrence: Recurrence;
  days?: number[]; // recurrence === 'weekdays'
  date?: string; // recurrence === 'once'
  createdAt: string;
  archived?: boolean;
  /** Set the day the user gave up on a one-off quest — kept, not deleted. */
  abandonedAt?: string;
  /** The quest only counts once a photo has been attached. */
  requiresProof?: boolean;
  /** Set when the objective came out of the random generator, to avoid repeats. */
  generated?: boolean;
};

/**
 * Photo attached to prove an objective was done. Stored per day so a recurring
 * objective can be proven again tomorrow without overwriting yesterday.
 */
export type ObjectiveProof = {
  objectiveId: string;
  /** Day key the proof belongs to. */
  date: string;
  /** Small JPEG data URL, resized on the device before it is stored. */
  photo: string;
  /** When the photo was attached, ISO — shown next to the proof. */
  takenAt: string;
};

/** Key used in AppData.proofs: one photo per objective and per day. */
export function proofKey(date: string, objectiveId: string): string {
  return `${date}|${objectiveId}`;
}

/** A day: checklist ticks, objectives completed, and whether it was closed. */
export type DailyEntry = {
  tasks: Record<string, boolean>;
  objectives?: string[];
  note?: string;
  closed?: boolean;
};

export type Measurement = {
  id: string;
  date: string;
  weightKg?: number;
  armCm?: number;
  chestCm?: number;
  waistCm?: number;
  thighCm?: number;
};

export type Reward = {
  id: string;
  level: number;
  label: string;
  custom: boolean;
};

export type Profile = {
  name: string;
  pseudo: string;
  email: string;
  /** Small square data URL, resized before storage. */
  avatar: string;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: string;
};

/* ---------- entrepreneuriat ---------- */

export type ProjectStage = 'idee' | 'construction' | 'lancement' | 'croissance' | 'expansion';

export type SubGoal = { id: string; label: string; done: boolean };

export type FinanceEntry = {
  id: string;
  date: string;
  kind: 'revenu' | 'depense';
  category: string;
  label?: string;
  amount: number;
};

export type Project = {
  id: string;
  name: string;
  type: string;
  description?: string;
  mainGoal?: string;
  subGoals: SubGoal[];
  createdAt: string;
  deadline?: string;
  stage: ProjectStage;
  archived?: boolean;
  entries: FinanceEntry[];
};

/** Amount can be negative to represent a withdrawal. */
export type SavingsEntry = { id: string; date: string; amount: number };

export type Savings = {
  target: number;
  entries: SavingsEntry[];
};

/* ---------- portefeuille d'investissement ---------- */

export type AssetType = 'action' | 'etf' | 'crypto' | 'immobilier' | 'obligation' | 'autre';

/**
 * One position in the portfolio. Everything is entered by hand: no price is
 * fetched unless a market-data provider is configured, and none is invented.
 */
export type Holding = {
  id: string;
  name: string;
  type: AssetType;
  /** Ticker or pair, only useful once a quote provider is configured. */
  symbol?: string;
  quantity: number;
  /** Price paid per unit. For a property, quantity 1 and the whole price. */
  buyPrice: number;
  /** Left empty until the user (or a provider) sets it; falls back to buyPrice. */
  currentPrice?: number;
  priceUpdatedAt?: string;
  /** Fees and charges, counted in the invested capital. */
  fees?: number;
  date: string;
  note?: string;
};

/** A running tracked amount, add or withdraw — plus the detailed positions. */
export type Investments = {
  entries: SavingsEntry[];
  holdings: Holding[];
};

/* ---------- comptes bancaires ---------- */

/** Aggregators the app is wired for. Which one is live depends on the env vars. */
export type BankProviderId = 'powens' | 'bridge' | 'gocardless' | 'tink' | 'plaid';

/**
 * A link to one bank, established through an aggregator. Only the opaque ids
 * the aggregator hands back are stored — never a login, never a password.
 */
export type BankConnection = {
  id: string;
  provider: BankProviderId;
  institution: string;
  externalId: string;
  status: 'active' | 'needs_action' | 'revoked';
  connectedAt: string;
  lastSyncAt?: string;
  error?: string;
};

export type BankAccountKind = 'courant' | 'epargne' | 'carte' | 'titres' | 'autre';

export type BankAccount = {
  id: string;
  connectionId: string;
  name: string;
  kind: BankAccountKind;
  /** Last four characters of the IBAN, enough to tell two accounts apart. */
  iban4?: string;
  /** Absent when the aggregator does not expose it. */
  balance?: number;
  currency: string;
  updatedAt?: string;
};

export type SpendCategory =
  | 'alimentation'
  | 'logement'
  | 'transport'
  | 'shopping'
  | 'abonnements'
  | 'loisirs'
  | 'sante'
  | 'revenus'
  | 'epargne'
  | 'autre';

export type BankTransaction = {
  id: string;
  accountId: string;
  date: string;
  label: string;
  /** Negative for an expense, positive for money coming in. */
  amount: number;
  category: SpendCategory;
  /** True once the user has corrected the automatic classification. */
  manualCategory?: boolean;
};

export type Bank = {
  connections: BankConnection[];
  accounts: BankAccount[];
  transactions: BankTransaction[];
  lastSyncAt?: string;
};

/* ---------- identité de joueur ---------- */

/**
 * Identity used for the shared leaderboard. Nothing leaves the device until
 * the user turns sharing on.
 */
export type Player = {
  id: string;
  shareToLeaderboard: boolean;
};

/** A recurring monthly charge — Netflix, salle de sport, forfait téléphone… */
export type Subscription = {
  id: string;
  name: string;
  /** Charged every month. */
  amount: number;
  category?: string;
  /** Day of the month the payment is taken, 1–31. */
  dayOfMonth?: number;
  createdAt: string;
};

export type FinancialGoal = {
  id: string;
  label: string;
  target: number;
  xp: number;
  createdAt: string;
  /** Set once, the day the target was first reached — grants XP exactly once. */
  achievedAt?: string;
};

export type NotificationSettings = {
  creatine: { enabled: boolean; time: string };
  hydration: { enabled: boolean; start: string; end: string; everyHours: number };
  meals: { enabled: boolean; times: string[] };
  sleep: { enabled: boolean; time: string };
  workout: { enabled: boolean; time: string; days: number[] };
  objectives: { enabled: boolean; time: string };
  review: { enabled: boolean; time: string };
};

export type Settings = {
  profile: Profile;
  timezone: string;
  notifications: NotificationSettings;
};

export type AppData = {
  version: number;
  updatedAt: number;
  settings: Settings;
  loads: Record<string, number>;
  daily: Record<string, DailyEntry>;
  workouts: LoggedWorkout[];
  measurements: Measurement[];
  objectives: Objective[];
  rewards: Reward[];
  /** dayId -> ordered exercise ids. Absent = the default day is used. */
  plan: Record<string, string[]>;
  /** Exercises the user created, merged into the catalogue. */
  customExercises: Exercise[];
  projects: Project[];
  /** Personal ledger, outside any project. */
  finances: FinanceEntry[];
  savings: Savings;
  investments: Investments;
  financialGoals: FinancialGoal[];
  /** Recurring monthly charges, kept apart from the one-off ledger. */
  subscriptions: Subscription[];
  /** Bank links, accounts and transactions pulled from an aggregator. */
  bank: Bank;
  /** Photo proofs, keyed by `proofKey(date, objectiveId)`. */
  proofs: Record<string, ObjectiveProof>;
  player: Player;
};

export type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
