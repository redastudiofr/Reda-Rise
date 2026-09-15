/**
 * Optional single-user auth.
 *
 * Auth is OFF unless the APP_PASSWORD env var is set. With it set, the app asks
 * for that password once and keeps an HMAC-signed cookie. Uses Web Crypto only
 * so it runs in the Edge middleware and in Node routes alike.
 */

export const COOKIE_NAME = 'muscu_session';
const DEFAULT_SECRET = 'aTNau--fShcJ1whzRdM_IUJpZPQvTvUojY6nxhkATlk';

export function appPassword(): string {
  return process.env.APP_PASSWORD ?? '';
}

/** No password configured means the app is open — no login screen at all. */
export function authEnabled(): boolean {
  return appPassword().length > 0;
}

function authSecret(): string {
  return process.env.AUTH_SECRET || DEFAULT_SECRET;
}

function b64url(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return b64url(sig);
}

/** Token valid for one year — this is a personal app on a personal phone. */
export async function createToken(): Promise<string> {
  const exp = String(Date.now() + 365 * 24 * 3600 * 1000);
  return `${exp}.${await sign(exp)}`;
}

export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = await sign(exp);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function cronSecret(): string {
  return process.env.CRON_SECRET || 'vejhEjq1NCHLlcS1NOVTATLH';
}
