import { bad, failed, noStore } from '@/lib/api';
import { searchCity } from '@/lib/weather';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return bad('Ville trop courte.');
  try {
    return Response.json({ places: await searchCity(q) }, { headers: noStore });
  } catch (e) {
    return failed(e, 'La recherche de ville');
  }
}
