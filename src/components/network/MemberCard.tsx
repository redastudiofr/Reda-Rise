'use client';

import Link from 'next/link';
import Avatar from '../Avatar';
import type { PublicProfile } from '@/lib/network/types';

export function placeLabel(p: PublicProfile['place']): string {
  return p.city ? `${p.city} · ${p.region}` : p.region;
}

export default function MemberCard({ p }: { p: PublicProfile }) {
  return (
    <Link href={`/network/membre/${p.id}`} className="card net-member">
      <Avatar src={p.photo ?? undefined} name={p.pseudo} size={48} />
      <span className="net-member-id">
        <b>{p.pseudo}</b>
        <small>{[p.company, p.sector].filter(Boolean).join(' · ')}</small>
        <small className="net-place">{placeLabel(p.place)}</small>
      </span>
      {p.skills.length > 0 ? (
        <span className="net-tags">
          {p.skills.slice(0, 3).map((s) => (
            <span key={s} className="net-tag">{s}</span>
          ))}
        </span>
      ) : null}
    </Link>
  );
}
