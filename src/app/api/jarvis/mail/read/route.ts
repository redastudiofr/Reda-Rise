import { bad, failed, gate, noStore } from '@/lib/jarvis/api';
import { latestMailFrom } from '@/lib/jarvis/google';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const locked = gate();
  if (locked) return locked;
  const from = (new URL(req.url).searchParams.get('from') ?? '').trim();
  if (!from) return bad('Expéditeur manquant.');
  try {
    const mail = await latestMailFrom(from);
    return Response.json({ mail }, { headers: noStore });
  } catch (e) {
    return failed(e, 'La messagerie');
  }
}
