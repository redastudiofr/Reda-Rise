import { NextResponse } from 'next/server';
import { sendToAll } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await sendToAll({
    title: 'Notification de test',
    body: 'Les rappels sont bien actifs sur cet appareil.',
    tag: 'test',
    url: '/reglages',
  });
  return NextResponse.json(result);
}
