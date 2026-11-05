import { bad, failed, jsonBody, noStore } from '@/lib/api';
import { detailPoint } from '@/lib/news';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await jsonBody<{ point?: { title?: unknown; link?: unknown; summary?: unknown; source?: unknown } }>(req);
  const p = body?.point;
  if (!p || typeof p.title !== 'string') return bad('Point inconnu.');
  try {
    const text = await detailPoint({
      title: p.title.slice(0, 300),
      link: typeof p.link === 'string' ? p.link.slice(0, 1000) : '',
      summary: typeof p.summary === 'string' ? p.summary.slice(0, 1000) : '',
      source: typeof p.source === 'string' ? p.source.slice(0, 80) : '',
    });
    return Response.json({ text }, { headers: noStore });
  } catch (e) {
    return failed(e, 'Mon moteur de réflexion');
  }
}
