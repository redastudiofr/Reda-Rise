import { deleteBankLink, listBankLinks, putBankLink } from './db';
import { seal, unseal } from './bankSecurity';
import type { BankAccountKind, BankProviderId } from './types';

/**
 * Server-side record of a bank connection. It holds the provider session id
 * and account uids — what grants access to the bank data — so it is sealed
 * (AES-256-GCM) before storage and never sent to the browser. The browser
 * only knows the link id, the bank's name and the accounts' display data.
 */
export type BankLink = {
  id: string;
  provider: BankProviderId;
  sessionId: string;
  institution: string;
  country: string;
  validUntil?: string;
  createdAt: string;
  lastSyncAt?: string;
  accounts: { id: string; uid: string; name: string; kind: BankAccountKind; iban4?: string; currency: string }[];
};

export async function saveLink(link: BankLink): Promise<void> {
  await putBankLink(link.id, seal(link));
}

/** Links that can be opened; one sealed with another key is reported, not thrown. */
export async function loadLinks(): Promise<{ links: BankLink[]; unreadable: string[] }> {
  const rows = await listBankLinks();
  const links: BankLink[] = [];
  const unreadable: string[] = [];
  for (const r of rows) {
    try {
      links.push(unseal<BankLink>(r.sealed));
    } catch {
      unreadable.push(r.id);
    }
  }
  return { links, unreadable };
}

export async function removeLink(id: string): Promise<void> {
  await deleteBankLink(id);
}
