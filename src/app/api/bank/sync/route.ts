import { bankGate, bankJson } from '@/lib/bankServer';
import {
  ProviderError,
  getBalances,
  getTransactions,
  pickBalance,
  toTransaction,
} from '@/lib/bankProviders/enableBanking';
import { loadLinks, saveLink } from '@/lib/bankVault';
import type { BankAccount, BankConnection, BankTransaction } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Banks cap unattended reads (PSD2: 4 a day); a short cooldown protects that quota. */
const COOLDOWN_MS = Math.max(0, Number(process.env.BANK_SYNC_COOLDOWN_SECONDS ?? 120)) * 1000;
/** First sync reaches back this far; later ones overlap a week to catch late bookings. */
const FIRST_DAYS = 90;
const OVERLAP_DAYS = 7;

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Reads fresh balances and transactions for every stored connection and
 * hands them to the browser, which merges them into the user's data. Each
 * connection fails on its own: an expired consent marks that one only.
 */
export async function POST() {
  const gate = bankGate();
  if (gate) return bankJson(gate.body, gate.status);

  const { links, unreadable } = await loadLinks();
  const now = Date.now();
  const today = day(now);
  const connections: BankConnection[] = [];
  const accounts: BankAccount[] = [];
  const transactions: BankTransaction[] = [];

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
          const balance = pickBalance(await getBalances(acc.uid));
          accounts.push({
            id: acc.id,
            connectionId: link.id,
            name: acc.name,
            kind: acc.kind,
            iban4: acc.iban4,
            balance,
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

  return bankJson({ connections, accounts, transactions, unreadable: unreadable.length, syncedAt: new Date(now).toISOString() });
}
