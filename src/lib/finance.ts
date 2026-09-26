import type {
  AccountType,
  AppData,
  FinanceEntry,
  MoneyAccount,
  SavingsGoal,
  SubFrequency,
  SubImportance,
  SubUsage,
  Subscription,
} from './types';
import { formatMoneyExact, monthKey, previousMonth } from './business';

/* ---------- comptes ---------- */

export const ACCOUNT_TYPES: { id: AccountType; label: string; color: string }[] = [
  { id: 'courant', label: 'Compte bancaire', color: '#4d86ea' },
  { id: 'epargne', label: 'Épargne', color: '#4fb286' },
  { id: 'especes', label: 'Espèces', color: '#d9a54a' },
  { id: 'autre', label: 'Autre', color: '#9a7cf0' },
];

export function accountType(id: AccountType) {
  return ACCOUNT_TYPES.find((t) => t.id === id) ?? ACCOUNT_TYPES[3];
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Everything held on the accounts that are still open. */
export function availableTotal(accounts: MoneyAccount[]): number {
  return round2(accounts.filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0));
}

export function totalsByType(accounts: MoneyAccount[]): { type: AccountType; amount: number }[] {
  return ACCOUNT_TYPES.map((t) => ({
    type: t.id,
    amount: round2(accounts.filter((a) => !a.archived && a.type === t.id).reduce((s, a) => s + a.balance, 0)),
  })).filter((r) => r.amount !== 0);
}

/** Signed effect of an entry on its account: income adds, spending removes. */
export function entryDelta(e: Pick<FinanceEntry, 'kind' | 'amount'>): number {
  return e.kind === 'revenu' ? e.amount : -e.amount;
}

/**
 * Applies an entry change to the account balances: the old version is undone,
 * the new one applied. Pass null for a creation (old) or a deletion (next).
 */
export function applyEntryToAccounts(
  accounts: MoneyAccount[],
  old: FinanceEntry | null,
  next: FinanceEntry | null,
  today: string,
): MoneyAccount[] {
  const deltas = new Map<string, number>();
  if (old?.accountId) deltas.set(old.accountId, (deltas.get(old.accountId) ?? 0) - entryDelta(old));
  if (next?.accountId) deltas.set(next.accountId, (deltas.get(next.accountId) ?? 0) + entryDelta(next));
  if (deltas.size === 0) return accounts;
  return accounts.map((a) =>
    deltas.has(a.id) && deltas.get(a.id) !== 0
      ? { ...a, balance: round2(a.balance + deltas.get(a.id)!), updatedAt: today }
      : a,
  );
}

/* ---------- abonnements ---------- */

export const FREQUENCIES: { id: SubFrequency; label: string; perMonth: number; short: string }[] = [
  { id: 'hebdomadaire', label: 'Chaque semaine', perMonth: 52 / 12, short: '/sem.' },
  { id: 'mensuel', label: 'Chaque mois', perMonth: 1, short: '/mois' },
  { id: 'trimestriel', label: 'Chaque trimestre', perMonth: 1 / 3, short: '/trim.' },
  { id: 'annuel', label: 'Chaque année', perMonth: 1 / 12, short: '/an' },
];

export function frequencyOf(s: Subscription): SubFrequency {
  return s.frequency ?? 'mensuel';
}

/** Price per period; older entries only had a monthly amount. */
export function priceOf(s: Subscription): number {
  return s.price ?? s.amount;
}

export function monthlyEquivalent(price: number, frequency: SubFrequency): number {
  const f = FREQUENCIES.find((x) => x.id === frequency)!;
  return round2(price * f.perMonth);
}

export function subMonthly(s: Subscription): number {
  return s.price !== undefined ? monthlyEquivalent(s.price, frequencyOf(s)) : s.amount;
}

export function subsMonthlyTotal(subs: Subscription[]): number {
  return round2(subs.reduce((a, s) => a + subMonthly(s), 0));
}

/** Yearly cost from the real price and frequency (a yearly plan counts once). */
export function subsYearlyTotal(subs: Subscription[]): number {
  return round2(
    subs.reduce((a, s) => {
      if (s.price === undefined) return a + s.amount * 12;
      const f = frequencyOf(s);
      return a + s.price * (f === 'hebdomadaire' ? 52 : f === 'mensuel' ? 12 : f === 'trimestriel' ? 4 : 1);
    }, 0),
  );
}

function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function clampDay(month: string, day: number): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/** The next charge on or after `today`, or null when no date was given. */
export function nextCharge(s: Subscription, today: string): string | null {
  if (s.billingDate) {
    const f = frequencyOf(s);
    const months = f === 'mensuel' ? 1 : f === 'trimestriel' ? 3 : 12;
    const origin = s.billingDate;
    if (origin >= today) return origin;
    if (f === 'hebdomadaire') {
      const [y, m, d] = origin.split('-').map(Number);
      const [ty, tm, td] = today.split('-').map(Number);
      const gap = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86_400_000);
      return addDays(origin, Math.ceil(gap / 7) * 7);
    }
    // Count periods from the original date, so the 31st stays the 31st when it exists.
    let n = 1;
    while (addMonths(origin, n * months) < today) n++;
    return addMonths(origin, n * months);
  }
  if (s.dayOfMonth) {
    const month = today.slice(0, 7);
    const candidate = clampDay(month, s.dayOfMonth);
    if (candidate >= today) return candidate;
    return clampDay(addMonths(`${month}-01`, 1).slice(0, 7), s.dayOfMonth);
  }
  return null;
}

export const USAGES: { id: SubUsage; label: string; perMonth: number; score: number }[] = [
  { id: 'quotidienne', label: 'Tous les jours', perMonth: 30, score: 3 },
  { id: 'hebdomadaire', label: 'Chaque semaine', perMonth: 4.3, score: 2 },
  { id: 'mensuelle', label: 'Quelques fois par mois', perMonth: 2, score: 1 },
  { id: 'rare', label: 'Rarement', perMonth: 0.3, score: 0 },
  { id: 'jamais', label: 'Jamais', perMonth: 0, score: -1 },
];

export const IMPORTANCES: { id: SubImportance; label: string; score: number }[] = [
  { id: 'essentiel', label: 'Essentiel', score: 2 },
  { id: 'utile', label: 'Utile', score: 1 },
  { id: 'accessoire', label: 'Accessoire', score: 0 },
];

export type SubVerdict = 'conserver' | 'reevaluer' | 'envisager-resiliation';

export const VERDICT_LABEL: Record<SubVerdict, string> = {
  conserver: 'Conserver',
  reevaluer: 'À réévaluer',
  'envisager-resiliation': 'Envisager de résilier',
};

export type SubAnalysis = {
  /** Neutral one-liner, e.g. "Utilisation faible — 12,99 €/mois." */
  headline: string;
  verdict: SubVerdict | null;
  /** Plain reasons behind the suggestion. */
  reasons: string[];
  /** Estimated cost of one use, when the usage is known and not zero. */
  costPerUse: number | null;
};

/**
 * A neutral reading of a subscription from what the user says about it. It
 * only ever suggests; the decision field stays the user's.
 */
export function analyseSubscription(s: Subscription): SubAnalysis {
  const monthly = subMonthly(s);
  const cost = `${formatMoneyExact(monthly)}/mois`;
  if (!s.usage) {
    return {
      headline: `${cost} — indique ton utilisation pour obtenir une analyse.`,
      verdict: null,
      reasons: [],
      costPerUse: null,
    };
  }
  const usage = USAGES.find((u) => u.id === s.usage)!;
  const importance = IMPORTANCES.find((i) => i.id === (s.importance ?? 'utile'))!;
  const level = usage.score >= 2 ? 'forte' : usage.score === 1 ? 'moyenne' : usage.score === 0 ? 'faible' : 'nulle';

  let score = usage.score + importance.score;
  const reasons: string[] = [`Utilisation : ${usage.label.toLowerCase()}.`, `Importance : ${importance.label.toLowerCase()}.`];
  if (monthly > 30) {
    score -= 1.5;
    reasons.push('Coût mensuel élevé.');
  } else if (monthly > 15) {
    score -= 1;
    reasons.push('Coût mensuel moyen.');
  } else if (monthly > 5) {
    score -= 0.5;
  }
  if (s.alternative?.trim() && s.importance !== 'essentiel') {
    score -= 0.5;
    reasons.push(`Alternative possible : ${s.alternative.trim()}.`);
  }
  const verdict: SubVerdict = score >= 2.5 ? 'conserver' : score >= 1 ? 'reevaluer' : 'envisager-resiliation';
  const costPerUse = usage.perMonth > 0 ? round2(monthly / usage.perMonth) : null;
  return {
    headline: `Utilisation ${level} — ${cost}.`,
    verdict,
    reasons,
    costPerUse,
  };
}

/* ---------- revenus et dépenses ---------- */

export type MonthFlow = { month: string; revenus: number; depenses: number };

/** Income and spending for the last `count` months, oldest first, empty months included. */
export function monthlyFlows(entries: FinanceEntry[], lastMonth: string, count: number): MonthFlow[] {
  const months: string[] = [lastMonth];
  while (months.length < count) months.unshift(previousMonth(months[0]));
  return months.map((month) => {
    let revenus = 0;
    let depenses = 0;
    for (const e of entries) {
      if (monthKey(e.date) !== month) continue;
      if (e.kind === 'revenu') revenus += e.amount;
      else depenses += e.amount;
    }
    return { month, revenus: round2(revenus), depenses: round2(depenses) };
  });
}

/**
 * Income and spending in charts: blue and orange stay apart for every common
 * colour-vision deficiency (checked with the palette validator on the dark surface).
 */
export const FLOW_COLORS = { revenus: '#4d86ea', depenses: '#c47a36' } as const;

/* ---------- objectifs d'épargne ---------- */

export const GOAL_COLORS = ['#4fb286', '#4d86ea', '#d9a54a', '#9a7cf0', '#c47fb4', '#4bb3c4'];

export function goalProgress(g: SavingsGoal): number {
  return g.target > 0 ? Math.max(0, Math.min(1, g.current / g.target)) : 0;
}

/** Months left before the deadline (at least 1), or null without one. */
export function monthsLeft(g: SavingsGoal, today: string): number | null {
  if (!g.deadline) return null;
  const [ty, tm] = today.split('-').map(Number);
  const [dy, dm] = g.deadline.split('-').map(Number);
  return Math.max(1, (dy - ty) * 12 + (dm - tm));
}

/** What to set aside each month to reach the goal on time. */
export function monthlyNeeded(g: SavingsGoal, today: string): number | null {
  const m = monthsLeft(g, today);
  if (m === null || g.current >= g.target) return null;
  return round2((g.target - g.current) / m);
}

/** Records a contribution (or a withdrawal when negative); marks the goal reached once. */
export function contribute(g: SavingsGoal, amount: number, today: string): SavingsGoal {
  const current = round2(Math.max(0, g.current + amount));
  return {
    ...g,
    current,
    achievedAt: g.achievedAt ?? (current >= g.target && g.target > 0 ? today : undefined),
  };
}

/* ---------- pistes d'épargne ---------- */

export type Tip = { id: string; text: string };

/**
 * General ideas to help saving, some computed from the user's own figures.
 * Deliberately generic: not personalised financial advice.
 */
export function savingsTips(data: AppData, month: string): Tip[] {
  const tips: Tip[] = [];
  const flows = monthlyFlows(data.finances, month, 1)[0];
  const subsM = subsMonthlyTotal(data.subscriptions);

  if (flows.revenus > 0) {
    tips.push({
      id: 'dix',
      text: `Mettre 10 % des revenus de côté dès leur arrivée représenterait ${formatMoneyExact(round2(flows.revenus * 0.1))} ce mois-ci.`,
    });
  }
  const toReview = data.subscriptions.filter((s) => {
    const a = analyseSubscription(s);
    return a.verdict === 'envisager-resiliation' && s.decision !== 'conserver';
  });
  if (toReview.length > 0) {
    const yearly = subsYearlyTotal(toReview);
    tips.push({
      id: 'abos',
      text: `${toReview.length} abonnement${toReview.length > 1 ? 's' : ''} peu utilisé${toReview.length > 1 ? 's' : ''} : ${formatMoneyExact(yearly)} par an au total.`,
    });
  } else if (subsM > 0 && flows.depenses > 0) {
    tips.push({
      id: 'part',
      text: `Les abonnements pèsent ${formatMoneyExact(subsM)} par mois — les passer en revue une fois par trimestre évite les oublis.`,
    });
  }
  if (flows.depenses > flows.revenus && flows.revenus > 0) {
    tips.push({ id: 'solde', text: 'Les dépenses du mois dépassent les revenus : regarder les deux plus grosses catégories est un bon point de départ.' });
  }
  tips.push(
    { id: 'auto', text: 'Programmer un virement automatique vers l’épargne le jour de la paie rend l’effort invisible.' },
    { id: 'attente', text: 'Attendre 48 h avant un achat non prévu permet de trier l’envie du besoin.' },
    { id: 'coussin', text: 'Un matelas de sécurité de quelques mois de dépenses est un repère souvent cité.' },
  );
  return tips.slice(0, 5);
}
