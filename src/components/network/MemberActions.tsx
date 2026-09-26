'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/network/client';
import type { PublicProfile } from '@/lib/network/types';
import ReportButton from './ReportButton';

/** On another member's profile: write to them, block or unblock, report. */
export default function MemberActions({ profile, blocked, onBlocked }: { profile: PublicProfile; blocked: boolean; onBlocked: (b: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function write() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>('/convs', { method: 'POST', body: { to: profile.id } });
      router.push(`/network/messages/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function setBlock(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api('/blocks', { method: on ? 'POST' : 'DELETE', body: { memberId: profile.id } });
      onBlocked(on);
      setConfirmBlock(false);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="net-member-actions">
      {blocked ? (
        <>
          <p className="sub">Tu as bloqué ce membre : vous ne pouvez plus vous écrire ni vous voir dans le Network.</p>
          <button className="btn btn-ghost" disabled={busy} onClick={() => setBlock(false)}>Débloquer</button>
        </>
      ) : (
        <>
          {profile.openToMessages ? (
            <button className="btn btn-accent" disabled={busy} onClick={write}>Envoyer un message</button>
          ) : (
            <p className="sub">Ce membre ne reçoit pas de messages privés.</p>
          )}
          {confirmBlock ? (
            <div className="net-confirm">
              <span>Bloquer {profile.pseudo} ? Il ou elle ne sera pas prévenu(e).</span>
              <div className="ag-sheet-actions">
                <button className="btn btn-ghost" onClick={() => setConfirmBlock(false)}>Annuler</button>
                <button className="btn btn-ghost ag-del-btn" disabled={busy} onClick={() => setBlock(true)}>Bloquer</button>
              </div>
            </div>
          ) : (
            <div className="net-member-minor">
              <button className="link-sm" onClick={() => setConfirmBlock(true)}>Bloquer</button>
              <ReportButton kind="membre" targetId={profile.id} label="Signaler le profil" />
            </div>
          )}
        </>
      )}
      {error ? <div className="banner warn" role="alert">{error}</div> : null}
    </div>
  );
}
