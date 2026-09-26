'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import FranceMap from '@/components/network/FranceMap';
import NetNav from '@/components/network/NetNav';
import { api } from '@/lib/network/client';
import { MIN_CITY_COUNT, type MapPoint, type MapRegion } from '@/lib/network/places';

type MapData = { points: MapPoint[]; regions: MapRegion[]; total: number };

const plural = (n: number) => `${n} entrepreneur${n > 1 ? 's' : ''}`;

export default function MapPage() {
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api<MapData>('/map')
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  const sel = data?.points.find((p) => p.cityId === selected);

  return (
    <div className="net">
      <NetNav title="Carte" sub={data ? `${plural(data.total)} sur le Network` : undefined} />
      {error ? <div className="banner warn" role="alert">{error}</div> : null}
      {data ? (
        <div className="net-map-layout">
          <div className="card net-map-card">
            <FranceMap points={data.points} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
            {sel ? (
              <div className="net-map-sel">
                <span>
                  <b>{sel.name}</b> · {plural(sel.count)}
                </span>
                <Link className="link-sm" href={`/network?city=${sel.cityId}`}>Voir les profils</Link>
              </div>
            ) : null}
            <p className="net-map-note">
              Positions approximatives : une bulle par grande ville, affichée à partir de {MIN_CITY_COUNT} entrepreneurs. En dessous, ils sont comptés
              uniquement dans leur région.
            </p>
          </div>
          <div className="net-map-lists">
            <section>
              <h2 className="section-title">Villes</h2>
              {data.points.length === 0 ? (
                <p className="sub">Aucune ville n’a encore {MIN_CITY_COUNT} entrepreneurs.</p>
              ) : (
                <ul className="card net-count-list">
                  {data.points.map((p) => (
                    <li key={p.cityId}>
                      <button onClick={() => setSelected(p.cityId)} data-on={selected === p.cityId}>
                        <span>{p.name}</span>
                        <b className="mono">{p.count}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="section-title">Régions</h2>
              {data.regions.length === 0 ? (
                <p className="sub">Pas encore de profil visible.</p>
              ) : (
                <ul className="card net-count-list">
                  {data.regions.map((r) => (
                    <li key={r.regionId}>
                      <Link href={`/network?region=${r.regionId}`}>
                        <span>{r.name}</span>
                        <b className="mono">{r.count}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : !error ? (
        <div className="empty">Chargement…</div>
      ) : null}
    </div>
  );
}
