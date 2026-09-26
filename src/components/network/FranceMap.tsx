'use client';

import { FRANCE_RINGS } from '@/lib/network/franceOutline';
import type { MapPoint } from '@/lib/network/places';

/**
 * Metropolitan France drawn from Natural Earth (public domain), with one
 * bubble per large city that has enough members. Plain SVG: no tile server,
 * no API key, no request leaving the app.
 */

const LON0 = -5.4;
const LAT1 = 51.3;
const K = 60;
// Equirectangular, with longitudes shrunk by cos(46.5°) so France keeps its shape.
const COS = Math.cos((46.5 * Math.PI) / 180);
const project = (lon: number, lat: number): [number, number] => [(lon - LON0) * COS * K, (LAT1 - lat) * K];

const W = Math.round((9.8 - LON0) * COS * K);
const H = Math.round((LAT1 - 41.2) * K);

const OUTLINE = FRANCE_RINGS.map(
  (ring) => `M${ring.map(([lon, lat]) => project(lon, lat).map((v) => v.toFixed(1)).join(',')).join('L')}Z`,
).join('');

export default function FranceMap({
  points,
  selected,
  onSelect,
}: {
  points: MapPoint[];
  selected?: string | null;
  onSelect?: (cityId: string) => void;
}) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const radius = (n: number) => 11 + 17 * Math.sqrt(n / max);
  const label = points.length
    ? `Carte de France : ${points.map((p) => `${p.name} ${p.count}`).join(', ')}`
    : 'Carte de France : aucune ville avec assez d’entrepreneurs pour être affichée';
  // Biggest first so small bubbles stay on top and clickable.
  const drawn = [...points].sort((a, b) => b.count - a.count);

  return (
    <svg className="net-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <path d={OUTLINE} className="net-map-land" />
      {drawn.map((p) => {
        const [x, y] = project(p.lon, p.lat);
        const r = radius(p.count);
        return (
          <g
            key={p.cityId}
            className="net-map-city"
            data-on={selected === p.cityId}
            transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
            onClick={onSelect ? () => onSelect(p.cityId) : undefined}
          >
            <title>{`${p.name} — ${p.count} entrepreneur${p.count > 1 ? 's' : ''}`}</title>
            <circle r={r} />
            <text className="net-map-count" dy="0.35em">{p.count}</text>
            {r > 15 || selected === p.cityId ? <text className="net-map-name" y={r + 16}>{p.name}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}
