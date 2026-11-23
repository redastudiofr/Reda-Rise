import { createHash } from 'node:crypto';
import { accountKind, type RawAccount } from './bankProviders/enableBanking';
import type { BankLink, LinkAccount } from './bankVault';

function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 32);
}

/** Hashes of what identifies the account at the bank; the IBAN itself is never kept. */
export function accountRefs(raw: RawAccount): string[] {
  const refs: string[] = [];
  if (raw.identification_hash) refs.push(hash(`eb:${raw.identification_hash}`));
  const iban = (raw.account_id?.iban ?? raw.account_id?.other?.identification)?.replace(/\s/g, '').toUpperCase();
  if (iban) refs.push(hash(`iban:${iban}`));
  return refs;
}

export function linkAccount(raw: RawAccount, id: string): LinkAccount {
  return {
    id,
    uid: raw.uid,
    name: raw.name || raw.product || 'Compte',
    kind: accountKind(raw),
    iban4: (raw.account_id?.iban ?? raw.account_id?.other?.identification)?.replace(/\s/g, '').slice(-4),
    currency: raw.currency || 'EUR',
    refs: accountRefs(raw),
  };
}

const sameRef = (a: LinkAccount, b: LinkAccount) => (a.refs ?? []).some((r) => (b.refs ?? []).includes(r));

/**
 * Accounts of a renewed consent, carrying the ids they already had: their
 * transactions keep the same ids, so the history is neither lost nor doubled.
 * Matched by stable reference first; links made before references existed
 * fall back to last IBAN digits, then name — each only when unambiguous.
 * An account seen for the first time gets a new id.
 */
export function relinkAccounts(existing: LinkAccount[], incoming: LinkAccount[], newId: () => string): LinkAccount[] {
  const free = [...existing];
  const take = (acc: LinkAccount, same: (old: LinkAccount) => boolean): LinkAccount | undefined => {
    const hits = free.filter((old) => old.currency === acc.currency && same(old));
    if (hits.length !== 1) return undefined;
    free.splice(free.indexOf(hits[0]), 1);
    return hits[0];
  };
  const out: (LinkAccount | null)[] = incoming.map(() => null);
  const passes: ((acc: LinkAccount) => (old: LinkAccount) => boolean)[] = [
    (acc) => (old) => sameRef(old, acc),
    (acc) => (old) => !old.refs?.length && !!acc.iban4 && old.iban4 === acc.iban4 && old.kind === acc.kind,
    (acc) => (old) => !old.refs?.length && !old.iban4 && !acc.iban4 && old.name === acc.name && old.kind === acc.kind,
  ];
  for (const pass of passes) {
    incoming.forEach((acc, i) => {
      if (out[i]) return;
      const old = take(acc, pass(acc));
      if (old) out[i] = { ...acc, id: old.id };
    });
  }
  return incoming.map((acc, i) => out[i] ?? { ...acc, id: newId() });
}

/**
 * The link a new consent renews: the one asked for, or else a link to the
 * same bank holding one of the same accounts — so connecting a bank again
 * from the list cannot create a second copy of it.
 */
export function linkToRenew(
  links: BankLink[],
  pending: { institution: string; country: string; reconnect?: string },
  incoming: LinkAccount[],
): BankLink | undefined {
  if (pending.reconnect) {
    const asked = links.find((l) => l.id === pending.reconnect);
    if (asked) return asked;
  }
  return links.find(
    (l) =>
      l.institution === pending.institution &&
      l.country === pending.country &&
      l.accounts.some((old) => incoming.some((acc) => sameRef(old, acc))),
  );
}
