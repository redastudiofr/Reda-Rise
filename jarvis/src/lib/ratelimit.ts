import { getJson, setJson } from './store';

/** Failed logins, kept in the store so they survive serverless cold starts. */
type Window = { count: number; resetAt: number };

export async function tooMany(key: string, max: number, now = Date.now()): Promise<number | null> {
  const w = await getJson<Window>(`rl:${key}`);
  if (!w || w.resetAt < now || w.count < max) return null;
  return Math.ceil((w.resetAt - now) / 1000);
}

export async function fail(key: string, windowSec: number, now = Date.now()): Promise<void> {
  const w = await getJson<Window>(`rl:${key}`);
  const fresh = !w || w.resetAt < now;
  await setJson(`rl:${key}`, { count: fresh ? 1 : w.count + 1, resetAt: fresh ? now + windowSec * 1000 : w.resetAt });
}

export async function clear(key: string): Promise<void> {
  await setJson(`rl:${key}`, null);
}
