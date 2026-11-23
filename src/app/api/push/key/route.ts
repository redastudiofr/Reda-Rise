import { NextResponse } from 'next/server';
import { vapidPublicKey } from '@/lib/push';
import { listSubs } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const subs = await listSubs().catch(() => []);
  return NextResponse.json({ key: vapidPublicKey(), subscriptions: subs.length });
}
