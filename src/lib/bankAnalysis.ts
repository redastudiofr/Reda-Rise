import type { BankTransaction } from './types';
import { monthKey, previousMonth } from './business';
import { shiftKey, weekdayOf } from './logic';
import type { MonthFlow } from './finance';

/**
 * Plain figures computed from the bank transactions (connected banks and CSV
 * imports). Savings transfers are counted apart: money set aside is neither
 * spending nor income. Nothing here gives advice — it only states numbers.
 */

/** All figures in integer cents. */
export type PeriodTotals = {
  spentCents: number;
  earnedCents: number;
  /** Transfers to savings over the period. */
  toSavingsCents: number;
  /** Income minus spending: what stayed, whatever it was then used for. */
  savedCents: number;
  count: number;
};

function totals(txs: BankTransaction[]): PeriodTotals {
  let spentCents = 0;
  let earnedCents = 0;
  let toSavingsCents = 0;
  for (const t of txs) {
    if (t.category === 'epargne') {
      if (t.amountCents < 0) toSavingsCents += -t.amountCents;
      continue;
    }
    if (t.amountCents < 0) spentCents += -t.amountCents;
    else earnedCents += t.amountCents;
  }
  return { spentCents, earnedCents, toSavingsCents, savedCents: earnedCents - spentCents, count: txs.length };
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

/** Income and spending per month, oldest first, in euros for the flow chart (display only). */
export function bankMonthlyFlows(txs: BankTransaction[], lastMonth: string, count: number): MonthFlow[] {
  const months = [lastMonth];
  while (months.length < count) months.unshift(previousMonth(months[0]));
  return months.map((m) => {
    const t = monthTotals(txs, m);
    return { month: m, revenus: t.earnedCents / 100, depenses: t.spentCents / 100 };
  });
}

/** Largest single expenses of the month (savings transfers excluded). */
export function topExpenses(txs: BankTransaction[], month: string, n = 5): BankTransaction[] {
  return txs
    .filter((t) => monthKey(t.date) === month && t.amountCents < 0 && t.category !== 'epargne')
    .sort((a, b) => a.amountCents - b.amountCents)
    .slice(0, n);
}

/** Share of the monthly savings target reached, 0 → 1+ (null without a target). Both in cents. */
export function savingsRatio(savedCents: number, targetCents: number): number | null {
  if (!(targetCents > 0)) return null;
  return Math.max(0, savedCents) / targetCents;
}
