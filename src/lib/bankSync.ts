import {
  ProviderError,
  getBalances,
  getTransactions,
  pickBalance,
  toTransaction,
} from './bankProviders/enableBanking';
import { loadLinks, saveLink } from './bankVault';
import type { BankAccount, BankConnection, BankTransaction } from './types';
import type { SyncPayload } from './bank';

/**
 * Reads fresh balances and transactions for every stored bank link. Used by
 * the "Synchroniser" button (/api/bank/sync, merged in the browser) and by
 * the daily job (/api/cron/bank-sync, merged on the server). Each link fails
 * on its own: an expired consent marks that one only.
 */

/** Banks cap unattended reads (PSD2: 4 a day); a short cooldown protects that quota. */
export const COOLDOWN_MS = Math.max(0, Number(process.env.BANK_SYNC_COOLDOWN_SECONDS ?? 120)) * 1000;
/** First sync reaches back this far; later ones overlap a week to catch late bookings. */
const FIRST_DAYS = 90;
const OVERLAP_DAYS = 7;

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export type FetchResult = SyncPayload & { unreadable: number; errors: number };

export async function fetchAllLinks(now = Date.now()): Promise<FetchResult> {
  const { links, unreadable } = await loadLinks();
  const today = day(now);
  const connections: BankConnection[] = [];
  const accounts: BankAccount[] = [];
  const transactions: BankTransaction[] = [];
  let errors = 0;
  for (const link of links) {
    const connection: BankConnection = {
      id: link.id,
      provider: link.provider,
      institution: link.institution,
      externalId: link.id,
      status: link.validUntil && link.validUntil < today ? 'needs_action' : 'active',
      connectedAt: link.createdAt.slice(0, 10),
      lastSyncAt: link.lastSyncAt,
      validUntil: link.validUntil,
    };
    const recent = link.lastSyncAt && now - Date.parse(link.lastSyncAt) < COOLDOWN_MS;
    if (connection.status === 'needs_action') {
      connection.error = 'L’autorisation a expiré : reconnecte la banque.';
    } else if (!recent) {
      const since = link.lastSyncAt
        ? day(Date.parse(link.lastSyncAt) - OVERLAP_DAYS * 86_400_000)
        : day(now - FIRST_DAYS * 86_400_000);
      try {
        for (const acc of link.accounts) {
          const balanceCents = pickBalance(await getBalances(acc.uid));
          accounts.push({
            id: acc.id,
            connectionId: link.id,
            name: acc.name,
            kind: acc.kind,
            iban4: acc.iban4,
            balanceCents,
            currency: acc.currency,
            updatedAt: today,
          });
          for (const raw of await getTransactions(acc.uid, since)) {
            const t = toTransaction(raw, acc.id);
            if (t) transactions.push(t);
          }
        }
        link.lastSyncAt = new Date(now).toISOString();
        connection.lastSyncAt = link.lastSyncAt;
        await saveLink(link);
      } catch (err) {
        const e = err instanceof ProviderError ? err : new ProviderError(0, 'network', 'Erreur inattendue.');
        if (e.code === 'consent_expired' || e.code === 'unauthorized') connection.status = 'needs_action';
        connection.error = e.message;
        errors++;
      }
    }
    if (recent || connection.error) {
      // Nothing fresh: still describe the accounts so the page stays complete.
      for (const acc of link.accounts) {
        accounts.push({ id: acc.id, connectionId: link.id, name: acc.name, kind: acc.kind, iban4: acc.iban4, currency: acc.currency });
      }
    }
    connections.push(connection);
  }

  return { connections, accounts, transactions, unreadable: unreadable.length, errors, syncedAt: new Date(now).toISOString() };
}
