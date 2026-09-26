import type {
  Bank,
  BankAccount,
  BankProviderId,
  BankTransaction,
  SpendCategory,
} from './types';
import { shiftKey, weekDatesFrom } from './logic';

/**
 * Bank layer.
 *
 * Connecting a real bank goes through an aggregator: the user authenticates on
 * their bank's own page, and the aggregator hands back tokens and transactions.
 * The app therefore never sees — and never stores — a banking login or
 * password. Only the opaque ids returned by the aggregator are kept.
 *
 * No aggregator is wired up yet: `/api/bank/status` reports which one the
 * environment is configured for, and the UI says plainly when none is. Nothing
 * here invents a connection or a transaction.
 */

export type BankProviderInfo = {
  id: BankProviderId;
  label: string;
  /** Environment variables that must be set for this provider to go live. */
  envVars: string[];
  docs: string;
  note: string;
};

export const BANK_PROVIDERS: BankProviderInfo[] = [
  {
    id: 'powens',
    label: 'Powens (ex-Budget Insight)',
    envVars: ['POWENS_CLIENT_ID', 'POWENS_CLIENT_SECRET', 'POWENS_DOMAIN'],
    docs: 'https://docs.powens.com',
    note: 'Large couverture des banques françaises, agrégation et catégorisation.',
  },
  {
    id: 'bridge',
    label: 'Bridge by Bankin’',
    envVars: ['BRIDGE_CLIENT_ID', 'BRIDGE_CLIENT_SECRET'],
    docs: 'https://docs.bridgeapi.io',
    note: 'API française, agrément DSP2, parcours de connexion hébergé.',
  },
  {
    id: 'gocardless',
    label: 'GoCardless Bank Account Data',
    envVars: ['GOCARDLESS_SECRET_ID', 'GOCARDLESS_SECRET_KEY'],
    docs: 'https://developer.gocardless.com/bank-account-data',
    note: 'Gratuit jusqu’à un certain volume, couverture européenne.',
  },
  {
    id: 'tink',
    label: 'Tink (Visa)',
    envVars: ['TINK_CLIENT_ID', 'TINK_CLIENT_SECRET'],
    docs: 'https://docs.tink.com',
    note: 'Couverture européenne large.',
  },
  {
    id: 'plaid',
    label: 'Plaid',
    envVars: ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV'],
    docs: 'https://plaid.com/docs',
    note: 'Surtout US et UK, couverture française limitée.',
  },
];

/** What `/api/bank/status` answers. */
export type BankStatus = {
  configured: boolean;
  provider: BankProviderId | null;
  providers: BankProviderInfo[];
  /** Which variables are still missing for the closest-to-ready provider. */
  missing: string[];
};

/* ---------- classement automatique des dépenses ---------- */

export const SPEND_CATEGORIES: { id: SpendCategory; label: string; color: string }[] = [
  { id: 'alimentation', label: 'Alimentation', color: '#4ec38a' },
  { id: 'logement', label: 'Logement', color: '#4d86ea' },
  { id: 'transport', label: 'Transport', color: '#e0a06f' },
  { id: 'shopping', label: 'Shopping', color: '#b47fe0' },
  { id: 'abonnements', label: 'Abonnements', color: '#5ec8d8' },
  { id: 'loisirs', label: 'Loisirs', color: '#e0806f' },
  { id: 'sante', label: 'Santé', color: '#d8b45e' },
  { id: 'epargne', label: 'Épargne', color: '#7f9fe0' },
  { id: 'revenus', label: 'Revenus', color: '#4ec38a' },
  { id: 'autre', label: 'Autre', color: '#767f8c' },
];

export function categoryLabel(id: SpendCategory): string {
  return SPEND_CATEGORIES.find((c) => c.id === id)?.label ?? 'Autre';
}

export function categoryColor(id: SpendCategory): string {
  return SPEND_CATEGORIES.find((c) => c.id === id)?.color ?? '#767f8c';
}

/**
 * Keyword rules, checked in order. Deliberately plain and readable: the point
 * is that anyone can see why a transaction landed where it did, and correct it
 * in one tap when a rule gets it wrong.
 */
const RULES: { category: SpendCategory; keywords: string[] }[] = [
  {
    category: 'epargne',
    keywords: ['livret a', 'livret jeune', 'ldds', 'epargne', 'pea', 'assurance vie', 'per '],
  },
  {
    category: 'abonnements',
    keywords: [
      'netflix', 'spotify', 'deezer', 'disney', 'prime video', 'canal+', 'canal plus',
      'apple.com/bill', 'itunes', 'icloud', 'google one', 'youtube premium', 'adobe',
      'microsoft', 'office 365', 'openai', 'dropbox', 'basic fit', 'basic-fit',
      'fitness park', 'neoness', 'salle de sport', 'orange', 'sfr', 'bouygues',
      'free mobile', 'free telecom', 'sosh', 'red by sfr', 'abonnement',
    ],
  },
  {
    category: 'logement',
    keywords: [
      'loyer', 'edf', 'engie', 'total energies', 'totalenergies', 'veolia', 'suez',
      'eau de paris', 'gaz', 'electricite', 'électricité', 'syndic', 'charges copro',
      'assurance habitation', 'credit immobilier', 'crédit immobilier', 'foncia',
      'nexity', 'taxe fonciere', 'taxe foncière', 'taxe habitation',
    ],
  },
  {
    category: 'transport',
    keywords: [
      'sncf', 'ratp', 'navigo', 'ter ', 'ouigo', 'trainline', 'blablacar', 'flixbus',
      'uber', 'bolt', 'freenow', 'taxi', 'total access', 'station service', 'esso',
      'shell', 'bp ', 'avia', 'carburant', 'peage', 'péage', 'vinci autoroute',
      'sanef', 'aprr', 'parking', 'indigo park', 'velib', 'vélib', 'lime', 'tisseo',
      'tcl ', 'keolis',
    ],
  },
  {
    category: 'loisirs',
    keywords: [
      'restaurant', 'brasserie', 'pizzeria', 'sushi', 'kebab', 'mcdonald', 'mcdo',
      'burger king', 'kfc', 'subway', 'starbucks', 'uber eats', 'ubereats',
      'deliveroo', 'just eat', 'bar ', 'pub ', 'cinema', 'cinéma', 'ugc', 'pathe',
      'pathé', 'gaumont', 'steam', 'playstation', 'xbox', 'nintendo', 'concert',
      'fnac spectacles', 'ticketmaster', 'billetterie', 'bowling', 'karting',
    ],
  },
  {
    category: 'alimentation',
    keywords: [
      'carrefour', 'leclerc', 'e.leclerc', 'lidl', 'aldi', 'auchan', 'intermarche',
      'intermarché', 'monoprix', 'franprix', 'casino', 'super u', 'hyper u', 'u express',
      'picard', 'grand frais', 'naturalia', 'biocoop', 'boulangerie', 'boucherie',
      'primeur', 'marche ', 'marché ', 'supermarche', 'supermarché', 'epicerie',
      'épicerie', 'cora', 'match ', 'netto', 'g20',
    ],
  },
  {
    category: 'sante',
    keywords: [
      'pharmacie', 'doctolib', 'medecin', 'médecin', 'dentiste', 'dr ', 'docteur',
      'mutuelle', 'harmonie mutuelle', 'opticien', 'optic', 'laboratoire', 'labo ',
      'hopital', 'hôpital', 'clinique', 'kine', 'kiné', 'cpam', 'ameli',
    ],
  },
  {
    category: 'shopping',
    keywords: [
      'amazon', 'zara', 'h&m', 'h et m', 'uniqlo', 'nike', 'adidas', 'jd sports',
      'courir', 'foot locker', 'decathlon', 'fnac', 'darty', 'boulanger', 'cdiscount',
      'zalando', 'vinted', 'shein', 'asos', 'ikea', 'action', 'gifi', 'leroy merlin',
      'castorama', 'bricorama', 'sephora', 'nocibe', 'nocibé', 'kiabi', 'primark',
    ],
  },
];

/**
 * Best-guess category for a transaction label. Savings transfers are caught
 * first, then the keyword rules; money coming in that matched nothing is
 * income, money going out that matched nothing stays "autre" rather than
 * being filed under a guess.
 */
export function classify(label: string, amount: number): SpendCategory {
  const text = ` ${label.toLowerCase()} `;
  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.category;
  }
  return amount > 0 ? 'revenus' : 'autre';
}

/* ---------- périodes ---------- */

export type PeriodId = 'jour' | 'semaine' | 'mois' | 'annee';

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'jour', label: 'Jour' },
  { id: 'semaine', label: 'Semaine' },
  { id: 'mois', label: 'Mois' },
  { id: 'annee', label: 'Année' },
];

export type Range = { from: string; to: string; label: string };

/** The window covered by a period, ending today. Both bounds are inclusive. */
export function periodRange(period: PeriodId, today: string): Range {
  if (period === 'jour') {
    return { from: today, to: today, label: 'Aujourd’hui' };
  }
  if (period === 'semaine') {
    const week = weekDatesFrom(today);
    return { from: week[0], to: week[6], label: 'Cette semaine' };
  }
  if (period === 'mois') {
    const [y, m] = today.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}`, label: 'Ce mois' };
  }
  const year = today.slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31`, label: 'Cette année' };
}

/** The same window, shifted one step back — used to compare with the period before. */
export function previousRange(period: PeriodId, today: string): Range {
  if (period === 'jour') return periodRange('jour', shiftKey(today, -1));
  if (period === 'semaine') return periodRange('semaine', shiftKey(today, -7));
  if (period === 'mois') {
    const [y, m] = today.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 2, 1));
    return periodRange('mois', prev.toISOString().slice(0, 10));
  }
  const year = Number(today.slice(0, 4)) - 1;
  return periodRange('annee', `${year}-06-15`);
}

export function inRange(date: string, range: Range): boolean {
  return date >= range.from && date <= range.to;
}

/* ---------- agrégats ---------- */

export type BankSummary = {
  spent: number;
  earned: number;
  saved: number;
  net: number;
  count: number;
};

/**
 * Totals over a window. Savings transfers are counted apart so they never look
 * like spending — money set aside is not money gone.
 */
export function summarize(transactions: BankTransaction[], range: Range): BankSummary {
  let spent = 0;
  let earned = 0;
  let saved = 0;
  let count = 0;

  for (const t of transactions) {
    if (!inRange(t.date, range)) continue;
    count += 1;
    if (t.category === 'epargne') saved += Math.abs(t.amount);
    else if (t.amount > 0) earned += t.amount;
    else spent += -t.amount;
  }

  return {
    spent: round2(spent),
    earned: round2(earned),
    saved: round2(saved),
    net: round2(earned - spent),
    count,
  };
}

export type CategorySlice = {
  category: SpendCategory;
  amount: number;
  share: number;
  count: number;
};

/** Where the money went over a window, biggest slice first. */
export function spendByCategory(
  transactions: BankTransaction[],
  range: Range,
): CategorySlice[] {
  const totals = new Map<SpendCategory, { amount: number; count: number }>();
  let total = 0;

  for (const t of transactions) {
    if (!inRange(t.date, range)) continue;
    if (t.amount >= 0 || t.category === 'epargne') continue;
    const row = totals.get(t.category) ?? { amount: 0, count: 0 };
    row.amount += -t.amount;
    row.count += 1;
    totals.set(t.category, row);
    total += -t.amount;
  }

  return [...totals.entries()]
    .map(([category, row]) => ({
      category,
      amount: round2(row.amount),
      share: total > 0 ? row.amount / total : 0,
      count: row.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Running balance day by day over a window, for the curve. */
export function balanceSeries(
  transactions: BankTransaction[],
  range: Range,
): { date: string; value: number }[] {
  const deltas = new Map<string, number>();
  for (const t of transactions) {
    if (!inRange(t.date, range)) continue;
    deltas.set(t.date, (deltas.get(t.date) ?? 0) + t.amount);
  }

  const points: { date: string; value: number }[] = [];
  let running = 0;
  let cursor = range.from;
  let guard = 0;
  while (cursor <= range.to && guard < 400) {
    running += deltas.get(cursor) ?? 0;
    points.push({ date: cursor, value: round2(running) });
    cursor = shiftKey(cursor, 1);
    guard += 1;
  }
  return points;
}

export function accountsTotal(accounts: BankAccount[]): number | null {
  const known = accounts.filter((a) => typeof a.balance === 'number');
  if (known.length === 0) return null;
  return round2(known.reduce((a, x) => a + (x.balance ?? 0), 0));
}

export function transactionsOf(bank: Bank, accountId: string | null): BankTransaction[] {
  const rows = accountId
    ? bank.transactions.filter((t) => t.accountId === accountId)
    : bank.transactions;
  return [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
