import { createHash, createPrivateKey, createSign } from 'crypto';
import { classify } from '../bank';
import { toCents } from '../money';
import type { BankAccount, BankAccountKind, BankTransaction } from '../types';

/**
 * Enable Banking connector (PSD2 account information, European banks).
 *
 * The user authenticates on their own bank's page; this server only ever
 * receives an authorisation code, exchanges it for a session id, and reads
 * balances and transactions with it. Requests are signed with a short-lived
 * RS256 JWT built from the application's private key, which never leaves the
 * server. Docs: https://enablebanking.com/docs/api/reference/
 */

const API = () => (process.env.ENABLE_BANKING_API_URL || 'https://api.enablebanking.com').replace(/\/$/, '');
const TIMEOUT_MS = 20_000;
const MAX_PAGES = 25;

export class ProviderError extends Error {
  constructor(
    /** HTTP status from the provider, or 0 for a network failure/timeout. */
    public status: number,
    /** Stable code the UI can map to a message. */
    public code: 'network' | 'timeout' | 'unauthorized' | 'consent_expired' | 'rate_limited' | 'bad_request' | 'provider',
    message: string,
  ) {
    super(message);
  }
}

/* ---------- authentification de l'application ---------- */

/**
 * The application's private key, from ENABLE_BANKING_PRIVATE_KEY (the whole
 * .pem content — never a file path: on Vercel there is no file to read).
 * Accepted forms, as dashboards and .env files tend to mangle them:
 * - real line breaks (pasted as is in Vercel) or escaped \n / \r\n on one line;
 * - surrounded by single or double quotes;
 * - the .pem file encoded in base64 (no "-----BEGIN" in the value).
 * The key itself is never logged nor sent to the browser.
 */
export function normalizePem(raw: string | undefined): string {
  let v = (raw ?? '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1).trim();
  v = v.replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\r\n?/g, '\n');
  if (v && !v.includes('-----BEGIN')) {
    const decoded = Buffer.from(v.replace(/\s+/g, ''), 'base64').toString('utf8');
    if (decoded.includes('-----BEGIN')) v = decoded.replace(/\r\n?/g, '\n');
  }
  // Line breaks lost (pasted on one line with spaces): rebuild the PEM block.
  const flat = /^(-----BEGIN [A-Z ]+-----)\s*([A-Za-z0-9+/=\s]+?)\s*(-----END [A-Z ]+-----)$/.exec(v);
  if (flat && !v.includes('\n')) {
    const body = flat[2].replace(/\s+/g, '').match(/.{1,64}/g) ?? [];
    v = [flat[1], ...body, flat[3]].join('\n');
  }
  // Each line trimmed: stray spaces around lines break PEM parsing.
  return v
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, all) => l || (i > 0 && i < all.length - 1))
    .join('\n')
    .trim();
}

function privateKeyPem(): string {
  return normalizePem(process.env.ENABLE_BANKING_PRIVATE_KEY);
}

/** Throws when the configured key cannot be read — reported as a blocker, not at request time. */
export function checkKey(): string | null {
  if (!privateKeyPem()) return 'ENABLE_BANKING_PRIVATE_KEY est vide.';
  try {
    const key = createPrivateKey(privateKeyPem());
    if (key.asymmetricKeyType !== 'rsa') return 'La clé ENABLE_BANKING_PRIVATE_KEY doit être une clé RSA.';
    return null;
  } catch {
    return 'La clé ENABLE_BANKING_PRIVATE_KEY est illisible (format PEM attendu).';
  }
}

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');

/** RS256 JWT, 1 hour (the API accepts up to 24 h). */
export function appJwt(now = Math.floor(Date.now() / 1000)): string {
  const header = { typ: 'JWT', alg: 'RS256', kid: process.env.ENABLE_BANKING_APP_ID ?? '' };
  const body = { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 };
  const unsigned = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(body))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  return `${unsigned}.${signer.sign(privateKeyPem()).toString('base64url')}`;
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${appJwt()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch (err) {
    const aborted = (err as { name?: string }).name === 'AbortError';
    throw new ProviderError(0, aborted ? 'timeout' : 'network', aborted ? 'La banque ne répond pas.' : 'Réseau indisponible.');
  } finally {
    clearTimeout(timer);
  }
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  // Only a short, known message leaves this function: never the raw provider body.
  let detail = '';
  try {
    const j = (await res.json()) as { error?: string; message?: string; code?: string };
    detail = `${j.error ?? j.code ?? ''} ${j.message ?? ''}`.toLowerCase();
  } catch {
    /* body is not JSON */
  }
  if (res.status === 429) throw new ProviderError(429, 'rate_limited', 'Trop de demandes à la banque, réessaie plus tard.');
  if (/expired|revoked|invalid session|session.*(closed|not found)|consent/.test(detail)) {
    throw new ProviderError(res.status, 'consent_expired', 'L’autorisation donnée à la banque a expiré ou a été retirée.');
  }
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(res.status, 'unauthorized', 'Le fournisseur a refusé l’accès (application ou session).');
  }
  if (res.status >= 400 && res.status < 500) throw new ProviderError(res.status, 'bad_request', 'Demande refusée par le fournisseur.');
  throw new ProviderError(res.status, 'provider', 'Le fournisseur bancaire rencontre un problème.');
}

/* ---------- API ---------- */

export type Institution = { name: string; country: string; logo?: string };

export async function listInstitutions(country: string): Promise<Institution[]> {
  const r = await call<{ aspsps?: { name: string; country: string; logo?: string; psu_types?: string[] }[] }>(
    'GET',
    `/aspsps?country=${encodeURIComponent(country)}&psu_type=personal`,
  );
  return (r.aspsps ?? [])
    .filter((a) => !a.psu_types || a.psu_types.includes('personal'))
    .map((a) => ({ name: a.name, country: a.country, logo: a.logo }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Starts the bank login. Returns the URL of the bank's own authentication page. */
export async function startAuthorization(opts: {
  institution: string;
  country: string;
  redirectUrl: string;
  state: string;
  validUntil: string;
}): Promise<{ url: string }> {
  const r = await call<{ url?: string }>('POST', '/auth', {
    access: { valid_until: opts.validUntil },
    aspsp: { name: opts.institution, country: opts.country },
    state: opts.state,
    redirect_url: opts.redirectUrl,
    psu_type: 'personal',
  });
  if (!r.url || !/^https:\/\//.test(r.url)) throw new ProviderError(502, 'provider', 'Lien d’authentification invalide.');
  return { url: r.url };
}

export type RawAccount = {
  uid: string;
  /** Same account, same hash, whatever the session: Enable Banking's stable identity. */
  identification_hash?: string;
  name?: string;
  account_id?: { iban?: string; other?: { identification?: string } };
  currency?: string;
  cash_account_type?: string;
  product?: string;
};

export async function createSession(code: string): Promise<{
  sessionId: string;
  accounts: RawAccount[];
  validUntil?: string;
}> {
  const r = await call<{ session_id?: string; accounts?: RawAccount[]; access?: { valid_until?: string } }>(
    'POST',
    '/sessions',
    { code },
  );
  if (!r.session_id) throw new ProviderError(502, 'provider', 'Session bancaire non créée.');
  return { sessionId: r.session_id, accounts: r.accounts ?? [], validUntil: r.access?.valid_until };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await call('DELETE', `/sessions/${encodeURIComponent(sessionId)}`);
}

export type RawBalance = { balance_amount?: { amount?: string; currency?: string }; balance_type?: string };

export async function getBalances(uid: string): Promise<RawBalance[]> {
  const r = await call<{ balances?: RawBalance[] }>('GET', `/accounts/${encodeURIComponent(uid)}/balances`);
  return r.balances ?? [];
}

export type RawTransaction = {
  entry_reference?: string;
  transaction_id?: string;
  transaction_amount?: { amount?: string; currency?: string };
  credit_debit_indicator?: 'CRDT' | 'DBIT';
  status?: string;
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  remittance_information?: string[];
  creditor?: { name?: string };
  debtor?: { name?: string };
};

/** Every transaction since `dateFrom`, following the continuation keys. */
export async function getTransactions(uid: string, dateFrom: string): Promise<RawTransaction[]> {
  const out: RawTransaction[] = [];
  let key: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({ date_from: dateFrom });
    if (key) q.set('continuation_key', key);
    const r = await call<{ transactions?: RawTransaction[]; continuation_key?: string | null }>(
      'GET',
      `/accounts/${encodeURIComponent(uid)}/transactions?${q}`,
    );
    out.push(...(r.transactions ?? []));
    key = r.continuation_key ?? undefined;
    if (!key) break;
  }
  return out;
}

/* ---------- conversion vers le format de l'app ---------- */

const BALANCE_PREFERENCE = ['ITAV', 'CLAV', 'ITBD', 'CLBD', 'XPCD', 'OTHR'];

/** The most "available now" balance the bank reports, in cents. */
export function pickBalance(balances: RawBalance[]): number | undefined {
  const sorted = [...balances].sort(
    (a, b) =>
      (BALANCE_PREFERENCE.indexOf(a.balance_type ?? 'OTHR') + 99) % 99 -
      (BALANCE_PREFERENCE.indexOf(b.balance_type ?? 'OTHR') + 99) % 99,
  );
  for (const b of sorted) {
    const cents = toCents(String(b.balance_amount?.amount ?? ''));
    if (cents !== null) return cents;
  }
  return undefined;
}

export function accountKind(raw: RawAccount): BankAccountKind {
  switch (raw.cash_account_type) {
    case 'CACC':
    case 'TRAN':
      return 'courant';
    case 'SVGS':
    case 'MOMA':
      return 'epargne';
    case 'CARD':
      return 'carte';
    default:
      return 'autre';
  }
}

export function toAccount(
  raw: RawAccount,
  ids: { id: string; connectionId: string },
  balanceCents: number | undefined,
  today: string,
): BankAccount {
  const iban = raw.account_id?.iban ?? raw.account_id?.other?.identification;
  return {
    id: ids.id,
    connectionId: ids.connectionId,
    name: raw.name || raw.product || 'Compte',
    kind: accountKind(raw),
    // Only the last four characters: enough to tell accounts apart.
    iban4: iban ? iban.replace(/\s/g, '').slice(-4) : undefined,
    balanceCents,
    currency: raw.currency || 'EUR',
    updatedAt: today,
  };
}

/**
 * The bank's own reference when it gives one. Otherwise a fingerprint of
 * date + amount + label; identical operations the same day (two coffees)
 * are told apart by their rank, so neither is lost nor counted twice.
 */
function stableId(accountId: string, t: RawTransaction, amount: number, label: string, date: string, occurrence: number): string {
  const fingerprint = `${date}|${amount}|${label}${occurrence > 1 ? `|#${occurrence}` : ''}`;
  const basis = t.entry_reference || t.transaction_id || fingerprint;
  return `eb_${createHash('sha256').update(`${accountId}|${basis}`).digest('hex').slice(0, 24)}`;
}

/** Signed amount in cents (debit negative), booking date, readable label, automatic category. */
export function toTransaction(t: RawTransaction, accountId: string, occurrence = 1): BankTransaction | null {
  const raw = toCents(String(t.transaction_amount?.amount ?? ''));
  const date = t.booking_date || t.value_date || t.transaction_date;
  if (raw === null || !date) return null;
  const amountCents = t.credit_debit_indicator === 'DBIT' ? -Math.abs(raw) : t.credit_debit_indicator === 'CRDT' ? Math.abs(raw) : raw;
  // Ids made before the switch to cents used the euro value: kept identical so nothing doubles.
  const amount = amountCents / 100;
  const label =
    (t.remittance_information ?? []).join(' ').replace(/\s+/g, ' ').trim() ||
    (amount < 0 ? t.creditor?.name : t.debtor?.name) ||
    'Opération';
  return {
    id: stableId(accountId, t, amount, label, date, occurrence),
    accountId,
    date: date.slice(0, 10),
    label: label.slice(0, 140),
    amountCents,
    category: classify(label, amount),
    pending: t.status === 'PDNG' || undefined,
  };
}
