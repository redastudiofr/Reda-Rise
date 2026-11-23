import { createHash, timingSafeEqual } from 'crypto';

/**
 * Scheduled routes (/api/cron/*) answer only to `Authorization: Bearer
 * <CRON_SECRET>`, the header Vercel Cron sends when CRON_SECRET is set on
 * the project. No secret configured means every call is refused: there is
 * no default value, no query-string secret and no trusted header.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim();
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!given) return false;
  const h = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(h(given), h(secret));
}
