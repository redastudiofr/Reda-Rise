import { bad, failed, gate, noStore } from '@/lib/jarvis/api';
import { searchCity } from '@/lib/jarvis/weather';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const locked = gate();
  if (locked) return locked;
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return bad('Ville trop courte.');
  try {
    return Response.json({ places: await searchCity(q) }, { headers: noStore });
  } catch (e) {
    return failed(e, 'La recherche de ville');
  }
}
