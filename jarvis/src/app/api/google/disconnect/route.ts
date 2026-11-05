import { disconnectGoogle } from '@/lib/google';
import { sameOrigin } from '@/lib/security';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'forbidden' }, { status: 403 });
  await disconnectGoogle();
  return Response.json({ ok: true });
}
