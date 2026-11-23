import { gate } from '@/lib/jarvis/api';
import { disconnectGoogle } from '@/lib/jarvis/google';
import { sameOrigin } from '@/lib/jarvis/security';

export async function POST(req: Request) {
  const locked = gate();
  if (locked) return locked;
  if (!sameOrigin(req)) return Response.json({ error: 'forbidden' }, { status: 403 });
  await disconnectGoogle();
  return Response.json({ ok: true });
}
