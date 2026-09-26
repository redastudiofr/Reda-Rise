import { NextResponse } from 'next/server';
import { alreadySent, markSent, readData } from '@/lib/db';
import { dueNotifications, localNow } from '@/lib/schedule';
import { sendToAll } from '@/lib/push';
import { cronSecret } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Called on a schedule (Vercel Cron, or any external scheduler hitting
 * /api/cron/notify?secret=…). Sends every reminder that is due, once.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const secret = cronSecret();
  const authorized =
    auth === `Bearer ${secret}` ||
    url.searchParams.get('secret') === secret ||
    req.headers.has('x-vercel-cron');

  if (!authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const data = await readData();
    const now = new Date();
    const due = dueNotifications(data.settings, now);
    const results: { key: string; sent: number; failed: number }[] = [];

    for (const item of due) {
      if (await alreadySent(item.key)) continue;
      const { sent, failed } = await sendToAll({
        title: item.title,
        body: item.body,
        tag: item.tag,
        url: item.url,
      });
      // Mark even when nothing was sent, so a device with no subscription does
      // not get a burst of stale reminders the moment it subscribes.
      await markSent(item.key);
      results.push({ key: item.key, sent, failed });
    }

    return NextResponse.json({
      ok: true,
      local: localNow(data.settings.timezone, now),
      due: due.map((d) => d.key),
      delivered: results,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export const POST = GET;
