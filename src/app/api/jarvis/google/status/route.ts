import { gate } from '@/lib/jarvis/api';
import { googleStatus } from '@/lib/jarvis/google';

export const dynamic = 'force-dynamic';

export async function GET() {
  const locked = gate();
  if (locked) return locked;
  return Response.json(await googleStatus(), { headers: { 'Cache-Control': 'no-store' } });
}
