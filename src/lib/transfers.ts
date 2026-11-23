import type { BankAccount, BankTransaction } from './types';

/**
 * Transfers between the user's own accounts. Money moving from the current
 * account to the savings account is neither spending nor income: both legs
 * are found and left out of the totals.
 *
 * A pair is two transactions with the same amount and opposite signs, on two
 * different accounts that both belong to the user, at most 3 days apart
 * (banks book the two sides on different days). Each transaction is used in
 * one pair at most; among candidates the closest date wins, so two transfers
 * of the same amount the same week are not crossed.
 */

export const TRANSFER_MAX_DAYS = 3;

const DAY = 86_400_000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;

/** For every transaction in a pair, the id of the other leg. */
export function internalTransfers(txs: BankTransaction[], accounts: BankAccount[]): Map<string, string> {
  const mine = new Set(accounts.map((a) => a.id));
  const outs = txs.filter((t) => t.amountCents < 0 && mine.has(t.accountId));
  const ins = txs.filter((t) => t.amountCents > 0 && mine.has(t.accountId));
  const byAmount = new Map<number, BankTransaction[]>();
  for (const t of ins) {
    const list = byAmount.get(t.amountCents);
    if (list) list.push(t);
    else byAmount.set(t.amountCents, [t]);
  }

  // Every possible pair, closest first, then matched greedily one-to-one.
  const candidates: { out: BankTransaction; in: BankTransaction; gap: number }[] = [];
  for (const out of outs) {
    for (const inc of byAmount.get(-out.amountCents) ?? []) {
      if (inc.accountId === out.accountId) continue;
      const gap = Math.abs(dayNumber(inc.date) - dayNumber(out.date));
      if (gap <= TRANSFER_MAX_DAYS) candidates.push({ out, in: inc, gap });
    }
  }
  candidates.sort((a, b) => a.gap - b.gap || a.out.date.localeCompare(b.out.date) || a.out.id.localeCompare(b.out.id));

  const pairs = new Map<string, string>();
  for (const c of candidates) {
    if (pairs.has(c.out.id) || pairs.has(c.in.id)) continue;
    pairs.set(c.out.id, c.in.id);
    pairs.set(c.in.id, c.out.id);
  }
  return pairs;
}

/** What the analyses need to know about transfers. */
export type TransferContext = {
  pairs: Map<string, string>;
  /** Account of each transaction id, and the kind of each account. */
  accountOf: Map<string, string>;
  kindOf: Map<string, BankAccount['kind']>;
};

export function transferContext(txs: BankTransaction[], accounts: BankAccount[]): TransferContext {
  return {
    pairs: internalTransfers(txs, accounts),
    accountOf: new Map(txs.map((t) => [t.id, t.accountId])),
    kindOf: new Map(accounts.map((a) => [a.id, a.kind])),
  };
}

/** True when this outgoing leg ends on a savings account. */
export function toSavingsAccount(t: BankTransaction, ctx: TransferContext): boolean {
  const other = ctx.pairs.get(t.id);
  if (!other || t.amountCents >= 0) return false;
  const acc = ctx.accountOf.get(other);
  return acc !== undefined && ctx.kindOf.get(acc) === 'epargne';
}
