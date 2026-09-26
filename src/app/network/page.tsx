'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import MemberCard from '@/components/network/MemberCard';
import NetNav from '@/components/network/NetNav';
import { api } from '@/lib/network/client';
import { REGIONS, cityById } from '@/lib/network/places';
import type { PublicProfile } from '@/lib/network/types';
import { SECTORS } from '@/lib/network/validate';

function Discover() {
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('');
  const [region, setRegion] = useState(params.get('region') ?? '');
  const [city, setCity] = useState(params.get('city') ?? '');
  const [profiles, setProfiles] = useState<PublicProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const s = new URLSearchParams();
      if (q.trim()) s.set('q', q.trim());
      if (sector) s.set('sector', sector);
      if (region) s.set('region', region);
      if (city) s.set('city', city);
      api<{ profiles: PublicProfile[] }>(`/profiles?${s}`)
        .then((r) => {
          setProfiles(r.profiles);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, sector, region, city]);

  const cityName = cityById(city)?.name;

  return (
    <div className="net">
      <NetNav title="Network" sub="Les entrepreneurs de l’app" />
      <div className="net-filters">
        <input className="input" type="search" placeholder="Rechercher : nom, compétence, entreprise…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <div className="grid-2">
          <select className="input" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Secteur">
            <option value="">Tous les secteurs</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="input"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setCity('');
            }}
            aria-label="Région"
          >
            <option value="">Toute la France</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        {cityName ? (
          <button className="chip" data-on="true" onClick={() => setCity('')}>
            {cityName} ×
          </button>
        ) : null}
      </div>
      {error ? <div className="banner warn" role="alert">{error}</div> : null}
      {profiles === null ? (
        <div className="empty">Chargement…</div>
      ) : profiles.length === 0 ? (
        <div className="card dash-empty">
          <b>Personne pour l’instant.</b>
          <span>{q || sector || region || city ? 'Aucun entrepreneur ne correspond à ces filtres.' : 'Tu es parmi les premiers membres : invite d’autres entrepreneurs à rejoindre le Network.'}</span>
        </div>
      ) : (
        <div className="net-grid">
          {profiles.map((p) => (
            <MemberCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NetworkPage() {
  return (
    <Suspense>
      <Discover />
    </Suspense>
  );
}
