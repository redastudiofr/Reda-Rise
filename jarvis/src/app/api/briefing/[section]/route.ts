import { SECTIONS, runSection, type Section } from '@/lib/briefing';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ section: string }> }) {
  const { section } = await ctx.params;
  if (!(SECTIONS as readonly string[]).includes(section)) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(await runSection(section as Section), { headers: { 'Cache-Control': 'no-store' } });
}
