'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import { useNet } from '@/components/network/NetContext';
import NetNav from '@/components/network/NetNav';
import type { ConvSummary } from '@/app/api/network/convs/route';
import { api } from '@/lib/network/client';

function when(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function MessagesPage() {
  const { unread } = useNet();
  const [convs, setConvs] = useState<ConvSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ convs: ConvSummary[] }>('/convs')
      .then((r) => setConvs(r.convs))
      .catch((e: Error) => setError(e.message));
    // Refreshes when the unread count moves (polled by the shell).
  }, [unread]);

  return (
    <div className="net">
      <NetNav title="Messages" sub="Conversations privées et groupes d’événements" />
      {error ? <div className="banner warn" role="alert">{error}</div> : null}
      {convs === null ? (
        <div className="empty">Chargement…</div>
      ) : convs.length === 0 ? (
        <div className="card dash-empty">
          <b>Aucune conversation.</b>
          <span>Écris à un entrepreneur depuis son profil, ou rejoins un événement pour accéder à sa discussion de groupe.</span>
          <Link href="/network" className="btn btn-accent" style={{ marginTop: 10 }}>Découvrir des entrepreneurs</Link>
        </div>
      ) : (
        <ul className="card net-convs">
          {convs.map((c) => (
            <li key={c.id}>
              <Link href={`/network/messages/${c.id}`} data-unread={c.unread}>
                {c.kind === 'dm' ? (
                  <Avatar src={c.photo ?? undefined} name={c.title} size={42} />
                ) : (
                  <span className="net-group-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                      <rect x="3" y="4.5" width="18" height="16" rx="3" />
                      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
                    </svg>
                  </span>
                )}
                <span className="net-conv-body">
                  <span className="net-conv-top">
                    <b>{c.title}</b>
                    <small>{c.lastPreview ? when(c.lastAt) : ''}</small>
                  </span>
                  <small className="net-conv-preview">
                    {c.blocked ? 'Membre bloqué' : c.lastPreview ? `${c.lastFromMe ? 'Toi : ' : ''}${c.lastPreview}` : c.kind === 'event' ? 'Discussion du groupe' : ''}
                  </small>
                </span>
                {c.unread ? <span className="net-dot" aria-label="Non lu" /> : c.muted ? <small className="sub">muet</small> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
