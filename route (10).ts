import { NextResponse } from 'next/server';
import { addSub, removeSub } from '@/lib/db';
import type { PushSub } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { subscription?: PushSub };
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return NextResponse.json({ error: 'Abonnement invalide' }, { status: 400 });
    }
    await addSub({ endpoint: sub.endpoint, keys: sub.keys });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
    if (body.endpoint) await removeSub(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
