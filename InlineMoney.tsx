'use client';

import { useEffect, useRef, useState } from 'react';
import { formatMoneyExact } from '@/lib/business';

/**
 * An amount you edit by tapping it. The figure turns into a numeric field,
 * Entrée or the check validates, Échap or the cross cancels. No extra page,
 * no extra screen.
 */
export default function InlineMoney({
  value,
  hint,
  onSet,
}: {
  value: number;
  hint?: string;
  /** Receives the new total the user typed. */
  onSet: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  function open() {
    setDraft(String(Math.round(value * 100) / 100));
    setEditing(true);
  }

  function commit() {
    const next = Number(draft.replace(',', '.'));
    if (Number.isFinite(next)) onSet(Math.round(next * 100) / 100);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button className="inline-money" onClick={open} aria-label="Modifier le montant">
        <span className="inline-money-value mono">{formatMoneyExact(value)}</span>
        <span className="inline-money-hint">{hint ?? 'Tape pour modifier'}</span>
      </button>
    );
  }

  return (
    <div className="inline-money-edit">
      <input
        ref={input}
        className="input inline-money-input mono"
        type="number"
        inputMode="decimal"
        step="0.01"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label="Nouveau montant"
      />
      <button className="icon-btn" onClick={() => setEditing(false)} aria-label="Annuler">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
        </svg>
      </button>
      <button className="icon-btn icon-btn-accent" onClick={commit} aria-label="Valider">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      </button>
    </div>
  );
}
