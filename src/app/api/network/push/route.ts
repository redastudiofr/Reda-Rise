import { validPushSub } from '@/lib/network/messaging';
import { fail, json, memberRoute, readBody, sha256 } from '@/lib/network/server';
import { deleteDoc, hit, listDocs, putDoc } from '@/lib/network/store';
import { vapidPublicKey } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The public key to subscribe with, and how many devices of the caller are subscribed. */
export const GET = memberRoute(async (_req, me) => {
  const subs = await listDocs('push', { part: me.id, limit: 20 });
  return json({ key: vapidPublicKey(), devices: subs.length });
});

/** Registers this device for the caller's message notifications (separate from the owner's reminders). */
export const POST = memberRoute(async (req, me) => {
  if (!(await hit(`push-sub:${me.id}`, 20, 3600))) return fail('Trop de demandes.', 429);
  const sub = validPushSub((await readBody(req, 5000)).subscription);
  if (!sub) return fail('Abonnement invalide.', 400);
  if ((await listDocs('push', { part: me.id, limit: 20 })).length >= 10) return fail('Trop d’appareils enregistrés.', 400);
  await putDoc('push', sha256(sub.endpoint), me.id, sub);
  return json({ ok: true });
});

export const DELETE = memberRoute(async (req, me) => {
  const endpoint = (await readBody(req, 5000)).endpoint;
  if (typeof endpoint === 'string') {
    const id = sha256(endpoint);
    const doc = (await listDocs('push', { part: me.id, limit: 20 })).find((d) => d.id === id);
    if (doc) await deleteDoc('push', id);
  }
  return json({ ok: true });
});
