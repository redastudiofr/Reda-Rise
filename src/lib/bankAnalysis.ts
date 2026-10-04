import type { BankTransaction } from './types';
import { monthKey, previousMonth } from './business';
import { shiftKey, weekdayOf } from './logic';
import type { MonthFlow } from './finance';

/**
 * Plain figures computed from the bank transactions (connected banks and CSV
 * imports). Savings transfers are counted apart: money set aside is neither
 * spending nor income. Nothing here gives advice — it only states numbers.
 */

const round2 = (v: number) => Math.round(v * 100) / 100;

export type PeriodTotals = {
  spent: number;
  earned: number;
  /** Transfers to savings over the period. */
  toSavings: number;
  /** Income minus spending: what stayed, whatever it was then used for. */
  saved: number;
  count: number;
};

function totals(txs: BankTransaction[]): PeriodTotals {
  let spent = 0;
  let earned = 0;
  let toSavings = 0;
  for (const t of txs) {
    if (t.category === 'epargne') {
      if (t.amount < 0) toSavings += -t.amount;
      continue;
    }
    if (t.amount < 0) spent += -t.amount;
    else earned += t.amount;
  }
  return { spent: round2(spent), earned: round2(earned), toSavings: round2(toSavings), saved: round2(earned - spent), count: txs.length };
}

export function monthTotals(txs: BankTransaction[], month: string): PeriodTotals {
  return totals(txs.filter((t) => monthKey(t.date) === month));
}

/** Monday to `today` included. */
export function weekTotals(txs: BankTransaction[], today: string): PeriodTotals & { from: string } {
  const wd = weekdayOf(today);
  const from = shiftKey(today, wd === 0 ? -6 : 1 - wd);
  return { ...totals(txs.filter((t) => t.date >= from && t.date <= today)), from };
}

/** Income and spending per month, oldest first, for the flow chart. */
export function bankMonthlyFlows(txs: BankTransaction[], lastMonth: string, count: number): MonthFlow[] {
  const months = [lastMonth];
  while (months.length < count) months.unshift(previousMonth(months[0]));
  return months.map((m) => {
    const t = monthTotals(txs, m);
    return { month: m, revenus: t.earned, depenses: t.spent };
  });
}

/** Largest single expenses of the month (savings transfers excluded). */
export function topExpenses(txs: BankTransaction[], month: string, n = 5): BankTransaction[] {
  return txs
    .filter((t) => monthKey(t.date) === month && t.amount < 0 && t.category !== 'epargne')
    .sort((a, b) => a.amount - b.amount)
    .slice(0, n);
}

/** Share of the monthly savings target reached, 0 → 1+ (null without a target). */
export function savingsRatio(saved: number, target: number): number | null {
  if (!(target > 0)) return null;
  return Math.max(0, saved) / target;
}
