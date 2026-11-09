import { gate, noStore } from '@/lib/jarvis/api';
import { env, shops } from '@/lib/jarvis/env';
import { googleStatus } from '@/lib/jarvis/google';
import { durable } from '@/lib/jarvis/store';

export const dynamic = 'force-dynamic';

/** What is configured, never the values. */
export async function GET() {
  const locked = gate();
  if (locked) return locked;
  return Response.json(
    {
      gemini: { configured: Boolean(env.geminiKey()), model: env.geminiModel() },
      google: await googleStatus().catch(() => ({ configured: true, connected: false, reason: 'Stockage indisponible.' })),
      shops: shops().length,
      durable: durable(),
    },
    { headers: noStore },
  );
}
