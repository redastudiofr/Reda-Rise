import { gate } from '@/lib/jarvis/api';
import { SECTIONS, runSection, type Section } from '@/lib/jarvis/briefing';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ section: string }> }) {
  const locked = gate();
  if (locked) return locked;
  const { section } = await ctx.params;
  if (!(SECTIONS as readonly string[]).includes(section)) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(await runSection(section as Section), { headers: { 'Cache-Control': 'no-store' } });
}
