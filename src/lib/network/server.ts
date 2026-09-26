import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME, authEnabled, verifyToken } from '../auth';
import { customAuthSecret } from '../bankSecurity';
import { hasDatabase } from '../db';
import { cityById, regionById } from './places';
import { deleteDoc, getDoc, getDocs, listDocs, putDoc } from './store';
import type { MemberDoc, ProfileDoc, PublicProfile, SessionDoc } from './types';

/**
 * Server side of the Network: who is calling, and whether the Network may run
 * at all on this deployment.
 *
 * Members have their own accounts, separate from the owner's password. A
 * session is a random token in an httpOnly cookie; the database only keeps
 * its SHA-256, so a leaked table does not log anyone in. Passwords are hashed
 * with scrypt.
 */

export const NET_COOKIE = 'telos_net';
const SESSION_DAYS = 30;
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export type NetBlocker = { id: string; message: string };

/** Everything that must hold before strangers can sign up. */
export function networkBlockers(): NetBlocker[] {
  const out: NetBlocker[] = [];
  if (!authEnabled()) {
    out.push({
      id: 'password',
      message: 'L’app doit être protégée par un mot de passe (APP_PASSWORD) : sinon les membres du Network verraient tes données personnelles.',
    });
  }
  if (!customAuthSecret()) {
    out.push({ id: 'auth_secret', message: 'AUTH_SECRET doit être défini avec au moins 32 caractères aléatoires (la valeur par défaut est publique).' });
  }
  if (!hasDatabase()) {
    out.push({ id: 'database', message: 'Une base Postgres (POSTGRES_URL) est nécessaire : les profils, événements et messages sont partagés entre plusieurs personnes.' });
  }
  return out;
}

export function inviteCode(): string {
  return (process.env.NETWORK_INVITE_CODE ?? '').trim();
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/* ---------- mots de passe ---------- */

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const got = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Spends the same time as a real check, so an unknown email is not faster to reject. */
let dummy: string | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummy ??= await hashPassword(randomBytes(12).toString('hex'));
  await verifyPassword(password, dummy);
}

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 10) return 'Mot de passe : 10 caractères minimum.';
  if (password.length > 200) return 'Mot de passe trop long.';
  return null;
}

export function normalizeEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/* ---------- sessions ---------- */

export async function createSession(memberId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await putDoc<SessionDoc>('sessions', sha256(token), memberId, { exp: Date.now() + SESSION_DAYS * 86400_000 });
  return token;
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set({
    name: NET_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({ name: NET_COOKIE, value: '', path: '/', maxAge: 0 });
}

export type Me = { id: string; member: MemberDoc };

export async function currentMember(req: NextRequest): Promise<Me | null> {
  const token = req.cookies.get(NET_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const s = await getDoc<SessionDoc>('sessions', sha256(token));
  if (!s) return null;
  if (s.data.exp < Date.now()) {
    await deleteDoc('sessions', s.id);
    return null;
  }
  const m = await getDoc<MemberDoc>('members', s.part);
  if (!m || m.data.suspended) return null;
  return { id: m.id, member: m.data };
}

export async function endSession(req: NextRequest): Promise<void> {
  const token = req.cookies.get(NET_COOKIE)?.value;
  if (token) await deleteDoc('sessions', sha256(token));
}

/** The owner of the app (their own password cookie), who moderates the Network. */
export async function isOwner(req: NextRequest): Promise<boolean> {
  return authEnabled() && (await verifyToken(req.cookies.get(COOKIE_NAME)?.value));
}

/* ---------- réponses ---------- */

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export const fail = (error: string, status: number) => json({ error }, status);

/** The caller's IP, only ever used hashed, as a rate-limit key. */
export function clientKey(req: NextRequest): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  return sha256(`ip:${ip}`).slice(0, 32);
}

/** Writes must come from this site's own pages (on top of the SameSite cookie). */
export function sameOrigin(req: NextRequest): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origin = req.headers.get('origin');
  if (origin) {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return req.headers.get('sec-fetch-site') !== 'cross-site';
}

type Handler<C> = (req: NextRequest, me: Me, ctx: C) => Promise<NextResponse>;

/**
 * Wraps a member-only route: the Network must be enabled, the request must
 * come from this site, and the caller must be signed in with an active account.
 */
export function memberRoute<C = unknown>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    if (networkBlockers().length > 0) return fail('Le Network n’est pas activé sur cette app.', 503);
    if (!sameOrigin(req)) return fail('Origine refusée.', 403);
    let me: Me | null;
    try {
      me = await currentMember(req);
    } catch {
      return fail('Service indisponible.', 503);
    }
    if (!me) return fail('Connecte-toi au Network.', 401);
    try {
      return await handler(req, me, ctx);
    } catch (err) {
      console.error('[network]', err);
      return fail('Erreur serveur.', 500);
    }
  };
}

export async function readBody(req: NextRequest, maxBytes = 200_000): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error('too large');
  try {
    const v = JSON.parse(text || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/* ---------- profils publics ---------- */

export function toPublic(id: string, p: ProfileDoc, since: string): PublicProfile {
  const city = cityById(p.cityId);
  const region = regionById(city?.region);
  const exact = p.precision === 'ville';
  return {
    id,
    pseudo: p.pseudo,
    photo: p.photoV ? `/api/network/photo/${id}?v=${p.photoV}` : null,
    company: p.company,
    sector: p.sector,
    skills: p.skills,
    interests: p.interests,
    place: {
      city: exact && city ? city.name : null,
      cityId: exact && city ? city.id : null,
      region: region?.name ?? '',
      regionId: region?.id ?? '',
    },
    bio: p.bio,
    openToMessages: p.openToMessages,
    since: since.slice(0, 7),
  };
}

/** Members hidden from `me` in both directions: those I blocked and those who blocked me. */
export async function blockedWith(me: string): Promise<Set<string>> {
  const [mine, theirs] = await Promise.all([
    listDocs<{ blocked: string }>('blocks', { part: me, limit: 1000 }),
    listDocs<{ blocked: string }>('blocks', { where: { field: 'blocked', value: me }, limit: 1000 }),
  ]);
  return new Set([...mine.map((b) => b.data.blocked), ...theirs.map((b) => b.part)]);
}

/** Pseudo and photo of several members at once; deleted members come back as null. */
export async function summaries(ids: string[]): Promise<Map<string, { id: string; pseudo: string; photo: string | null }>> {
  const docs = await getDocs<ProfileDoc>('profiles', [...new Set(ids)]);
  return new Map(
    docs.map((d) => [d.id, { id: d.id, pseudo: d.data.pseudo, photo: d.data.photoV ? `/api/network/photo/${d.id}?v=${d.data.photoV}` : null }]),
  );
}
