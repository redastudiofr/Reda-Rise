import type { NextRequest } from 'next/server';
import { clearSessionCookie, endSession, json, sameOrigin } from '@/lib/network/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Origine refusée.' }, 403);
  await endSession(req).catch(() => undefined);
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
}
