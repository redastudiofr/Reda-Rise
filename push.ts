import webpush from 'web-push';
import { listSubs, removeSub } from './db';
import type { PushSub } from './types';

/**
 * Default VAPID pair generated for this project. Override both values with the
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars on Vercel to use your own.
 */
const DEFAULT_PUBLIC =
  'BCXIXGZJ9R2h0-ici0R5MkNYi729igaLVqKWaZoWXiK6I4TR8gUpw3J8MdFfxD05-XHx22MbUJZdWyUNesMWvik';
const DEFAULT_PRIVATE = 'exgvMVSdv8nSnnsDI5HL-3QOdUL5K9j-Ei-NFXArd8A';

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_PUBLIC;
}

function vapidPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY || DEFAULT_PRIVATE;
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:athlete@example.com',
    vapidPublicKey(),
    vapidPrivateKey(),
  );
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

export async function sendTo(sub: PushSub, payload: PushPayload): Promise<boolean> {
  configure();
  try {
    await webpush.sendNotification(sub as never, JSON.stringify(payload), { TTL: 3600 });
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // The endpoint is gone: drop the subscription so it stops being retried.
    if (status === 404 || status === 410) await removeSub(sub.endpoint);
    return false;
  }
}

export async function sendToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const subs = await listSubs();
  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    if (await sendTo(sub, payload)) sent++;
    else failed++;
  }
  return { sent, failed };
}
