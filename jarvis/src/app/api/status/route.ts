import { noStore } from '@/lib/api';
import { env, shops } from '@/lib/env';
import { googleStatus } from '@/lib/google';
import { durable } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** What is configured, never the values. */
export async function GET() {
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
