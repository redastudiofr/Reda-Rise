'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import { useNet } from '@/components/network/NetContext';
import NetNav from '@/components/network/NetNav';
import { api } from '@/lib/network/client';
import type { ReportDoc } from '@/lib/network/types';

type Person = { id: string; pseudo: string; photo: string | null };
type Report = Omit<ReportDoc, 'by'> & { id: string; by: Person; member: Person; memberState: 'actif' | 'suspendu' | 'supprime'; reportersOfMember: number };

const KIND_LABEL = { membre: 'Profil', message: 'Message', evenement: 'Événement' };

/** The owner's view of reports: dismiss, delete the content, or suspend the account. */
export default function ModerationPage() {
  const { owner } = useNet();
  const [status, setStatus] = useState<'ouvert' | 'traite'>('ouvert');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ reports: Report[] }>(`/admin/reports?status=${status}`)
      .then((r) => {
        setReports(r.reports);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [status]);
  useEffect(() => {
    if (owner) load();
  }, [owner, load]);

  async function act(id: string, action: 'dismiss' | 'delete-content' | 'suspend') {
    setBusy(id);
    try {
      await api(`/admin/reports/${id}`, { method: 'POST', body: { action } });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  }

  if (!owner) {
    return (
      <div className="net">
        <NetNav title="Modération" />
        <div className="card dash-empty"><b>Réservé au propriétaire de l’app.</b></div>
      </div>
    );
  }

  return (
    <div className="net">
      <NetNav title="Modération" sub="Signalements des membres" />
      <div className="segmented" role="tablist" style={{ marginBottom: 14 }}>
        <button role="tab" aria-selected={status === 'ouvert'} data-on={status === 'ouvert'} onClick={() => setStatus('ouvert')}>À traiter</button>
        <button role="tab" aria-selected={status === 'traite'} data-on={status === 'traite'} onClick={() => setStatus('traite')}>Traités</button>
      </div>
      {error ? <div className="banner warn" role="alert">{error}</div> : null}
      {reports === null ? (
        <div className="empty">Chargement…</div>
      ) : reports.length === 0 ? (
        <div className="card dash-empty"><b>{status === 'ouvert' ? 'Aucun signalement en attente.' : 'Aucun signalement traité.'}</b></div>
      ) : (
        <div className="net-grid net-reports">
          {reports.map((r) => (
            <div key={r.id} className="card net-report-card">
              <div className="net-report-top">
                <span className="net-flag">{KIND_LABEL[r.kind]}</span>
                <b>{r.reason}</b>
                <small className="sub">{new Date(r.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
              </div>
              <div className="net-report-who">
                <Link href={`/network/membre/${r.member.id}`} className="net-inline-person">
                  <Avatar src={r.member.photo ?? undefined} name={r.member.pseudo} size={24} /> {r.member.pseudo}
                </Link>
                <small className="sub">
                  {r.memberState === 'suspendu' ? 'suspendu' : r.memberState === 'supprime' ? 'compte supprimé' : `signalé par ${r.reportersOfMember} membre${r.reportersOfMember > 1 ? 's' : ''}`}
                </small>
              </div>
              {r.excerpt ? <blockquote className="net-excerpt">{r.excerpt}</blockquote> : null}
              {r.detail ? <p className="net-report-detail">« {r.detail} » — {r.by.pseudo}</p> : <p className="sub">Signalé par {r.by.pseudo}</p>}
              {r.status === 'ouvert' ? (
                <div className="net-report-actions">
                  <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => act(r.id, 'dismiss')}>Classer</button>
                  {r.kind !== 'membre' ? (
                    <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => act(r.id, 'delete-content')}>Supprimer le contenu</button>
                  ) : null}
                  {r.memberState === 'actif' ? (
                    <button className="btn btn-ghost btn-sm ag-del-btn" disabled={busy === r.id} onClick={() => act(r.id, 'suspend')}>Suspendre le compte</button>
                  ) : null}
                </div>
              ) : (
                <p className="sub">{r.resolution}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
