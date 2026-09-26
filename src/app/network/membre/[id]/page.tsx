'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import MemberActions from '@/components/network/MemberActions';
import { placeLabel } from '@/components/network/MemberCard';
import NetNav from '@/components/network/NetNav';
import { api } from '@/lib/network/client';
import type { PublicProfile } from '@/lib/network/types';

type Resp = { profile: PublicProfile; self: boolean; blocked: boolean };

export default function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Resp>(`/profiles/${encodeURIComponent(id)}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  const p = data?.profile;
  return (
    <div className="net">
      <NetNav title="Profil" action={<Link href="/network" className="link-sm">← Découvrir</Link>} />
      {error ? <div className="card dash-empty"><b>{error}</b></div> : null}
      {p ? (
        <div className="card net-profile">
          <div className="net-profile-head">
            <Avatar src={p.photo ?? undefined} name={p.pseudo} size={84} />
            <div>
              <h2>{p.pseudo}</h2>
              {p.company ? <div className="net-profile-company">{p.company}</div> : null}
              <div className="sub">{p.sector}</div>
              <div className="net-place">{placeLabel(p.place)}</div>
            </div>
          </div>
          {p.bio ? <p className="net-bio">{p.bio}</p> : null}
          {p.skills.length > 0 ? (
            <div className="net-profile-block">
              <h3>Compétences</h3>
              <div className="net-tags">{p.skills.map((s) => <span key={s} className="net-tag">{s}</span>)}</div>
            </div>
          ) : null}
          {p.interests.length > 0 ? (
            <div className="net-profile-block">
              <h3>Centres d’intérêt</h3>
              <div className="net-tags">{p.interests.map((s) => <span key={s} className="net-tag">{s}</span>)}</div>
            </div>
          ) : null}
          <div className="net-profile-since sub">Membre depuis {new Date(`${p.since}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
          {data.self ? (
            <Link href="/network/profil" className="btn btn-ghost">Modifier mon profil</Link>
          ) : (
            <MemberActions profile={p} blocked={data.blocked} onBlocked={(b) => setData({ ...data, blocked: b })} />
          )}
        </div>
      ) : !error ? (
        <div className="empty">Chargement…</div>
      ) : null}
    </div>
  );
}
