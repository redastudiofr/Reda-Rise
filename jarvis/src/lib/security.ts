import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

export const SESSION_COOKIE = 'jarvis_session';
export const SESSION_DAYS = 30;

const b64u = (b: Buffer) => b.toString('base64url');

function key(purpose: string): Buffer {
  return createHash('sha256').update(`${purpose}:${env.sessionSecret()}`).digest();
}

/** Equal strings, compared in constant time whatever their length. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Session cookie: expiry + HMAC. Nothing else is needed for a single owner. */
export function newSession(now = Date.now()): string {
  const exp = now + SESSION_DAYS * 86_400_000;
  const body = `v1.${exp}`;
  return `${body}.${b64u(createHmac('sha256', key('session')).update(body).digest())}`;
}

export function validSession(value: string | undefined, now = Date.now()): boolean {
  if (!value || env.sessionSecret().length < 32) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < now) return false;
  const expected = b64u(createHmac('sha256', key('session')).update(`v1.${parts[1]}`).digest());
  return safeEqual(expected, parts[2]);
}

/** AES-256-GCM, for what is stored at rest (the Google refresh token). */
export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key('seal'), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return `g1.${b64u(iv)}.${b64u(c.getAuthTag())}.${b64u(data)}`;
}

export function unseal<T>(sealed: string): T {
  const [v, iv, tag, data] = sealed.split('.');
  if (v !== 'g1' || !iv || !tag || !data) throw new Error('format');
  const d = createDecipheriv('aes-256-gcm', key('seal'), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8')) as T;
}

export function randomToken(bytes = 24): string {
  return b64u(randomBytes(bytes));
}

/** Rejects a state-changing request sent from another site. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function cookieValue(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function isHttps(req: Request): boolean {
  const proto = req.headers.get('x-forwarded-proto');
  return proto ? proto.split(',')[0].trim() === 'https' : new URL(req.url).protocol === 'https:';
}
