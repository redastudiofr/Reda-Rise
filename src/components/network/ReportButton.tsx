'use client';

import { useState } from 'react';
import { api } from '@/lib/network/client';
import type { ReportKind } from '@/lib/network/types';
import { LIMITS, REPORT_REASONS } from '@/lib/network/validate';

/** Opens a small form to report a member, a message or an event to the moderation. */
export default function ReportButton({ kind, targetId, label = 'Signaler', className = 'link-sm net-report' }: { kind: ReportKind; targetId: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api('/reports', { method: 'POST', body: { kind, targetId, reason, detail } });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  function close() {
    setOpen(false);
    setDone(false);
    setReason('');
    setDetail('');
    setError(null);
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open ? (
        <div className="sheet-backdrop" onClick={close}>
          <div className="sheet" role="dialog" aria-label="Signaler" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div className="sheet-title">{label}</div>
            {done ? (
              <>
                <div className="banner" role="status">Merci, le signalement a été transmis à la modération. La personne n’est pas prévenue.</div>
                <div className="ag-sheet-actions">
                  <button className="btn btn-accent" onClick={close}>Fermer</button>
                </div>
              </>
            ) : (
              <>
                <div className="chip-grid" role="radiogroup" aria-label="Motif">
                  {REPORT_REASONS.map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={reason === r} className="chip" data-on={reason === r} onClick={() => setReason(r)}>{r}</button>
                  ))}
                </div>
                <label className="field">
                  <span>Précisions — facultatif</span>
                  <textarea className="input" rows={3} maxLength={LIMITS.reportDetail} value={detail} onChange={(e) => setDetail(e.target.value)} />
                </label>
                {error ? <div className="banner warn" role="alert">{error}</div> : null}
                <div className="ag-sheet-actions">
                  <button className="btn btn-ghost" onClick={close}>Annuler</button>
                  <button className="btn btn-accent" disabled={!reason || busy} onClick={send}>Envoyer</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
