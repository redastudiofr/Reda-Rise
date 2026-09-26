import { json, memberRoute } from '@/lib/network/server';
import { listDocs } from '@/lib/network/store';
import { aggregate } from '@/lib/network/places';
import type { ProfileDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Counts per city and region — never a list of people, never a position finer than a large city. */
export const GET = memberRoute(async () => {
  const docs = await listDocs<ProfileDoc>('profiles', { limit: 1000 });
  const visible = docs.filter((d) => d.data.visible);
  return json(aggregate(visible.map((d) => ({ cityId: d.data.cityId, regionOnly: d.data.precision === 'region' }))));
});
