import { env } from './env';
import { ServiceError, fetchJson, fetchWithTimeout } from './http';
import { seal, unseal } from './security';
import { getJson, setJson } from './store';
import { TZ, parisIso } from './time';

/**
 * Minimum scopes: read mail, read and create calendar events. Nothing can
 * send mail, delete mail or change other calendar settings.
 */
export const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar.events'];

type Stored = { refreshToken: string; scope: string; connectedAt: string };
type Cached = { accessToken: string; exp: number };

export const googleConfigured = () => Boolean(env.googleClientId() && env.googleClientSecret());

export function redirectUri(req: Request): string {
  const configured = env.googleRedirectUri();
  if (configured) return configured;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host;
  const proto = (req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '')).split(',')[0];
  return `${proto}://${host}/api/jarvis/google/callback`;
}

export function authUrl(req: Request, state: string): string {
  const q = new URLSearchParams({
    client_id: env.googleClientId(),
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    // Always ask, so Google sends a refresh token again on reconnection.
    prompt: 'consent',
    include_granted_scopes: 'false',
    state,
  });
  return `${env.googleAuthUrl()}?${q}`;
}

async function tokenCall(params: Record<string, string>) {
  const res = await fetchWithTimeout(
    env.googleTokenUrl(),
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.googleClientId(), client_secret: env.googleClientSecret(), ...params }),
    },
    10_000,
  );
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    if (json.error === 'invalid_grant') throw new ServiceError('auth', 'Autorisation Google expirée ou retirée.', 400);
    throw new ServiceError(res.status === 429 ? 'quota' : 'bad_response', `Google token ${res.status} ${json.error ?? ''}`.trim(), res.status);
  }
  return json;
}

export async function exchangeCode(req: Request, code: string): Promise<void> {
  const t = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: redirectUri(req) });
  if (!t.refresh_token) throw new ServiceError('auth', 'Google n’a pas renvoyé de jeton de rafraîchissement.');
  const granted = (t.scope ?? '').split(' ');
  const missing = SCOPES.filter((s) => !granted.includes(s));
  if (missing.length) throw new ServiceError('auth', 'Accès incomplet : cochez Gmail et Agenda sur l’écran Google.');
  await setJson('google', seal({ refreshToken: t.refresh_token, scope: t.scope ?? '', connectedAt: new Date().toISOString() } satisfies Stored));
  await setJson('google_access', seal({ accessToken: t.access_token!, exp: Date.now() + (t.expires_in ?? 3600) * 1000 } satisfies Cached));
}

async function stored(): Promise<Stored | null> {
  const raw = await getJson<string>('google');
  if (!raw) return null;
  try {
    return unseal<Stored>(raw);
  } catch {
    return null; // sealed with another SESSION_SECRET: reconnect
  }
}

let memo: Cached | null = null;

export async function accessToken(): Promise<string> {
  if (!googleConfigured()) throw new ServiceError('not_configured', 'Google n’est pas configuré.');
  if (memo && memo.exp - 60_000 > Date.now()) return memo.accessToken;
  const cachedRaw = await getJson<string>('google_access');
  if (cachedRaw) {
    try {
      const c = unseal<Cached>(cachedRaw);
      if (c.exp - 60_000 > Date.now()) return (memo = c).accessToken;
    } catch {
      /* refreshed below */
    }
  }
  const s = await stored();
  if (!s) throw new ServiceError('auth', 'Google n’est pas connecté.');
  try {
    const t = await tokenCall({ refresh_token: s.refreshToken, grant_type: 'refresh_token' });
    memo = { accessToken: t.access_token!, exp: Date.now() + (t.expires_in ?? 3600) * 1000 };
    await setJson('google_access', seal(memo));
    return memo.accessToken;
  } catch (e) {
    if (e instanceof ServiceError && e.code === 'auth') {
      // Expired (7 days in test mode) or revoked: forget it, the page offers to reconnect.
      await setJson('google_access', null);
      await setJson('google', null);
      memo = null;
    }
    throw e;
  }
}

export type GoogleStatus = { configured: boolean; connected: boolean; connectedAt?: string; expiresHint?: string; reason?: string };

export async function googleStatus(): Promise<GoogleStatus> {
  if (!googleConfigured()) return { configured: false, connected: false, reason: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants.' };
  const s = await stored();
  if (!s) return { configured: true, connected: false, reason: 'Non connecté.' };
  try {
    await accessToken();
  } catch (e) {
    const auth = e instanceof ServiceError && e.code === 'auth';
    return { configured: true, connected: false, reason: auth ? 'Autorisation expirée : reconnectez Google.' : 'Google ne répond pas.' };
  }
  // In test mode Google keeps the refresh token for 7 days.
  const expiresHint = new Date(Date.parse(s.connectedAt) + 7 * 86_400_000).toISOString();
  return { configured: true, connected: true, connectedAt: s.connectedAt, expiresHint };
}

export async function disconnectGoogle(): Promise<void> {
  const s = await stored();
  if (s) await fetchWithTimeout(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(s.refreshToken)}`, { method: 'POST' }, 5000).catch(() => undefined);
  memo = null;
  await setJson('google', null);
  await setJson('google_access', null);
}

async function forgetAccess(): Promise<void> {
  memo = null;
  await setJson('google_access', null);
}

/** A 401 means the access token was revoked early: refreshed once, then reported. */
async function authed<T>(call: (token: string) => Promise<T>): Promise<T> {
  try {
    return await call(await accessToken());
  } catch (e) {
    if (!(e instanceof ServiceError && e.status === 401)) throw e;
    await forgetAccess();
    return call(await accessToken());
  }
}

function gget<T>(url: string): Promise<T> {
  return authed((token) => fetchJson<T>(url, { headers: { Authorization: `Bearer ${token}` } }, 12_000));
}

/* ---------------- Gmail (lecture seule) ---------------- */

export type MailMeta = { id: string; from: string; fromEmail: string; subject: string; date: string; snippet: string; labels: string[] };

type GmailMessage = {
  id: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailPart;
};
type GmailPart = { mimeType?: string; headers?: { name: string; value: string }[]; body?: { data?: string }; parts?: GmailPart[] };

const header = (m: GmailMessage, name: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

export function splitFrom(from: string): { name: string; email: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (m) return { name: m[1].trim() || m[2], email: m[2].trim() };
  return { name: from.trim(), email: from.trim() };
}

function toMeta(m: GmailMessage): MailMeta {
  const f = splitFrom(header(m, 'From'));
  return {
    id: m.id,
    from: f.name,
    fromEmail: f.email,
    subject: header(m, 'Subject') || '(sans objet)',
    date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : header(m, 'Date'),
    snippet: decodeHtml(m.snippet ?? ''),
    labels: m.labelIds ?? [],
  };
}

function decodeHtml(s: string): string {
  return s
    .replace(/&#39;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

/** Mail of the last 24 hours, without promotions, social networks and forums. */
export async function recentMail(max = 40): Promise<MailMeta[]> {
  const q = new URLSearchParams({ q: 'newer_than:1d -category:promotions -category:social -category:forums -in:chats -in:sent', maxResults: String(max) });
  const list = await gget<{ messages?: { id: string }[] }>(`${env.gmailUrl()}/users/me/messages?${q}`);
  const ids = (list.messages ?? []).map((m) => m.id);
  const metas = await inBatches(ids, 8, (id) =>
    gget<GmailMessage>(`${env.gmailUrl()}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
  );
  return metas.map(toMeta);
}

function b64(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

export function bodyText(part: GmailPart | undefined): string {
  if (!part) return '';
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (p: GmailPart) => {
    if (p.mimeType === 'text/plain' && p.body?.data) plain.push(b64(p.body.data));
    else if (p.mimeType === 'text/html' && p.body?.data) html.push(b64(p.body.data));
    p.parts?.forEach(walk);
  };
  walk(part);
  const raw = plain.length
    ? plain.join('\n')
    : html
        .join('\n')
        .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, ' ');
  return decodeHtml(raw)
    .replace(/&nbsp;/g, ' ')
    // Quoted replies and signatures are not read aloud.
    .split(/\n(?:Le .{5,80} a écrit ?:|On .{5,80} wrote:|-- ?\n|>)/)[0]
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type FullMail = MailMeta & { body: string };

/** The latest mail from someone (name or address), the past 30 days. */
export async function latestMailFrom(who: string): Promise<FullMail | null> {
  const clean = who.replace(/["()]/g, ' ').trim().slice(0, 80);
  if (!clean) return null;
  for (const query of [`from:(${clean}) newer_than:30d`, `${clean} newer_than:30d -in:sent`]) {
    const q = new URLSearchParams({ q: query, maxResults: '1' });
    const list = await gget<{ messages?: { id: string }[] }>(`${env.gmailUrl()}/users/me/messages?${q}`);
    const id = list.messages?.[0]?.id;
    if (!id) continue;
    const m = await gget<GmailMessage>(`${env.gmailUrl()}/users/me/messages/${id}?format=full`);
    return { ...toMeta(m), body: bodyText(m.payload).slice(0, 4000) };
  }
  return null;
}

/* ---------------- Agenda ---------------- */

export type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean; busy: boolean; location?: string };

type GEvent = {
  id: string;
  summary?: string;
  status?: string;
  transparency?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export async function eventsBetween(start: Date, end: Date): Promise<CalEvent[]> {
  const q = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
    timeZone: TZ,
  });
  const r = await gget<{ items?: GEvent[] }>(`${env.calendarUrl()}/calendars/primary/events?${q}`);
  return (r.items ?? [])
    .filter((e) => e.status !== 'cancelled')
    .map((e) => {
      const allDay = !e.start?.dateTime;
      return {
        id: e.id,
        title: e.summary || '(sans titre)',
        start: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
        end: e.end?.dateTime ?? `${e.end?.date}T00:00:00`,
        allDay,
        busy: !allDay && e.transparency !== 'transparent',
        location: e.location,
      };
    });
}

export async function createEvent(ev: { title: string; start: Date; end: Date; description?: string }): Promise<{ id: string; link?: string }> {
  const r = await authed((token) => fetchJson<{ id: string; htmlLink?: string }>(
    `${env.calendarUrl()}/calendars/primary/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        summary: ev.title,
        description: ev.description ?? 'Planifié avec Jarvis.',
        start: { dateTime: parisIso(ev.start), timeZone: TZ },
        end: { dateTime: parisIso(ev.end), timeZone: TZ },
        reminders: { useDefault: true },
      }),
    },
    12_000,
  ));
  return { id: r.id, link: r.htmlLink };
}
