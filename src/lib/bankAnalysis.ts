import type { BankTransaction } from './types';
import { toSavingsAccount, type TransferContext } from './transfers';
import { monthKey, previousMonth } from './business';
import { shiftKey, weekdayOf } from './logic';
import type { MonthFlow } from './finance';

/**
 * Plain figures computed from the bank transactions (connected banks and CSV
 * imports). Transfers between the user's own accounts (lib/transfers.ts) are
 * neither spending nor income; those landing on a savings account, and lines
 * the user filed under "Épargne", are counted apart as money set aside.
 * Nothing here gives advice — it only states numbers.
 */

/** All figures in integer cents. */
export type PeriodTotals = {
  spentCents: number;
  earnedCents: number;
  /** Money set aside over the period: transfers to a savings account, lines filed under Épargne. */
  toSavingsCents: number;
  /** Transfers between own accounts left out of the totals (both legs counted). */
  transfers: number;
  /** Income minus spending: what stayed, whatever it was then used for. */
  savedCents: number;
  count: number;
};

function totals(txs: BankTransaction[], ctx?: TransferContext): PeriodTotals {
  let spentCents = 0;
  let earnedCents = 0;
  let toSavingsCents = 0;
  let transfers = 0;
  for (const t of txs) {
    if (ctx?.pairs.has(t.id)) {
      transfers++;
      if (toSavingsAccount(t, ctx)) toSavingsCents += -t.amountCents;
      continue;
    }
    if (t.category === 'epargne') {
      if (t.amountCents < 0) toSavingsCents += -t.amountCents;
      continue;
    }
    if (t.amountCents < 0) spentCents += -t.amountCents;
    else earnedCents += t.amountCents;
  }
  return { spentCents, earnedCents, toSavingsCents, transfers, savedCents: earnedCents - spentCents, count: txs.length };
}

export function monthTotals(txs: BankTransaction[], month: string, ctx?: TransferContext): PeriodTotals {
  return totals(txs.filter((t) => monthKey(t.date) === month), ctx);
}

/** Monday to `today` included. */
export function weekTotals(txs: BankTransaction[], today: string, ctx?: TransferContext): PeriodTotals & { from: string } {
  const wd = weekdayOf(today);
  const from = shiftKey(today, wd === 0 ? -6 : 1 - wd);
  return { ...totals(txs.filter((t) => t.date >= from && t.date <= today), ctx), from };
}

/** Income and spending per month, oldest first, in euros for the flow chart (display only). */
export function bankMonthlyFlows(txs: BankTransaction[], lastMonth: string, count: number, ctx?: TransferContext): MonthFlow[] {
  const months = [lastMonth];
  while (months.length < count) months.unshift(previousMonth(months[0]));
  return months.map((m) => {
    const t = monthTotals(txs, m, ctx);
    return { month: m, revenus: t.earnedCents / 100, depenses: t.spentCents / 100 };
  });
}

/** Largest single expenses of the month (transfers and savings excluded). */
export function topExpenses(txs: BankTransaction[], month: string, n = 5, ctx?: TransferContext): BankTransaction[] {
  return txs
    .filter((t) => monthKey(t.date) === month && t.amountCents < 0 && t.category !== 'epargne' && !ctx?.pairs.has(t.id))
    .sort((a, b) => a.amountCents - b.amountCents)
    .slice(0, n);
}

/** Share of the monthly savings target reached, 0 → 1+ (null without a target). Both in cents. */
export function savingsRatio(savedCents: number, targetCents: number): number | null {
  if (!(targetCents > 0)) return null;
  return Math.max(0, savedCents) / targetCents;
}
