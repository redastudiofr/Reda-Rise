import { blockedWith, json, memberRoute, toPublic } from '@/lib/network/server';
import { listDocs } from '@/lib/network/store';
import { cityById } from '@/lib/network/places';
import type { ProfileDoc } from '@/lib/network/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Visible entrepreneurs, filtered by text, sector, region or city. Never the caller, never a blocked member. */
export const GET = memberRoute(async (req, me) => {
  const u = new URL(req.url);
  const q = fold((u.searchParams.get('q') ?? '').trim().slice(0, 60));
  const sector = u.searchParams.get('sector') ?? '';
  const region = u.searchParams.get('region') ?? '';
  const city = u.searchParams.get('city') ?? '';
  const blocked = await blockedWith(me.id);
  const docs = await listDocs<ProfileDoc>('profiles', { order: 'desc', limit: 1000 });
  const out = docs
    .filter((d) => d.data.visible && d.id !== me.id && !blocked.has(d.id))
    .filter((d) => !sector || d.data.sector === sector)
    .filter((d) => !region || cityById(d.data.cityId)?.region === region)
    // A member showing only their region is not listed under a city.
    .filter((d) => !city || (d.data.cityId === city && d.data.precision === 'ville'))
    .filter((d) => {
      if (!q) return true;
      const hay = fold([d.data.pseudo, d.data.company, d.data.sector, d.data.bio, ...d.data.skills, ...d.data.interests].join(' '));
      return q.split(' ').every((w) => hay.includes(w));
    })
    .slice(0, 200)
    .map((d) => toPublic(d.id, d.data, d.createdAt));
  return json({ profiles: out });
});
