import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from 'crypto';
import { authEnabled } from './auth';
import { hasDatabase } from './db';

/**
 * Server-only security for the bank connection.
 *
 * - Connecting is refused until the app is behind a password and signs its
 *   cookies with a secret of its own: bank data must never sit behind an open
 *   URL or a secret that is public in the source code.
 * - What grants access to the bank (the provider session) is encrypted at
 *   rest with AES-256-GCM before it reaches the database.
 * - The redirect back from the bank carries a random `state` that must match
 *   a sealed, short-lived, httpOnly cookie — a forged callback is rejected.
 */

/** The fallback in auth.ts is public in the repository, so it does not count. */
const PUBLIC_DEFAULT_SECRET = 'aTNau--fShcJ1whzRdM_IUJpZPQvTvUojY6nxhkATlk';

export type Blocker = { id: string; message: string };

function customAuthSecret(): string | null {
  const s = (process.env.AUTH_SECRET ?? '').trim();
  if (s.length < 32 || s === PUBLIC_DEFAULT_SECRET || s === 'change-moi') return null;
  return s;
}

function explicitKey(): Buffer | null {
  const raw = (process.env.BANK_ENCRYPTION_KEY ?? '').trim();
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  return buf.length === 32 ? buf : null;
}

/** Everything that must hold before a bank may be connected or synced. */
export function securityBlockers(): Blocker[] {
  const out: Blocker[] = [];
  if (!authEnabled()) {
    out.push({
      id: 'password',
      message: 'L’app n’est pas protégée par un mot de passe (APP_PASSWORD). Sans lui, n’importe qui ayant l’adresse verrait tes comptes.',
    });
  }
  if (!customAuthSecret()) {
    out.push({
      id: 'auth_secret',
      message: 'AUTH_SECRET doit être défini avec au moins 32 caractères aléatoires (la valeur par défaut est publique).',
    });
  }
  if ((process.env.BANK_ENCRYPTION_KEY ?? '').trim() && !explicitKey()) {
    out.push({ id: 'encryption_key', message: 'BANK_ENCRYPTION_KEY doit être une clé de 32 octets encodée en base64.' });
  }
  return out;
}

export function storageDurable(): boolean {
  return hasDatabase();
}

/** The key sealing bank links: BANK_ENCRYPTION_KEY, or one derived from AUTH_SECRET. */
function vaultKey(): Buffer {
  const k = explicitKey();
  if (k) return k;
  const secret = customAuthSecret();
  if (!secret) throw new Error('bank_security_not_ready');
  return Buffer.from(hkdfSync('sha256', secret, 'telos-bank-vault', 'aes-256-gcm v1', 32));
}

const b64u = (b: Buffer) => b.toString('base64url');

/** Encrypts a value for storage: "v1.<iv>.<tag>.<ciphertext>". */
export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', vaultKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', b64u(iv), b64u(cipher.getAuthTag()), b64u(body)].join('.');
}

/** Decrypts a sealed value; throws when it was tampered with or the key changed. */
export function unseal<T>(sealed: string): T {
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !body) throw new Error('sealed_format');
  const decipher = createDecipheriv('aes-256-gcm', vaultKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const text = Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  return JSON.parse(text) as T;
}

/* ---------- état anti-falsification du retour de la banque ---------- */

export const STATE_COOKIE = 'telos_bank_state';
export const STATE_TTL_SECONDS = 15 * 60;

export type PendingAuth = { state: string; exp: number; institution: string; country: string };

export function newPendingAuth(institution: string, country: string): { pending: PendingAuth; cookie: string } {
  const pending: PendingAuth = {
    state: b64u(randomBytes(24)),
    exp: Date.now() + STATE_TTL_SECONDS * 1000,
    institution,
    country,
  };
  return { pending, cookie: seal(pending) };
}

/** The pending authorisation, if the cookie is genuine, fresh and matches `state`. */
export function checkPendingAuth(cookie: string | undefined, state: string | null): PendingAuth | null {
  if (!cookie || !state) return null;
  let pending: PendingAuth;
  try {
    pending = unseal<PendingAuth>(cookie);
  } catch {
    return null;
  }
  if (pending.exp < Date.now()) return null;
  const a = Buffer.from(pending.state);
  const b = Buffer.from(state);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return pending;
}

export function randomId(prefix: string): string {
  return `${prefix}_${b64u(randomBytes(12))}`;
}
