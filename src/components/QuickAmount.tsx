'use client';

import { useState } from 'react';

/**
 * Minimal bottom sheet: tap an amount, type a number, validate. Used for
 * every "quick tap to record money" flow — no categories, no friction.
 */
export default function QuickAmount({
  title,
  confirmLabel = 'Valider',
  allowWithdraw = false,
  onConfirm,
  onClose,
}: {
  title: string;
  confirmLabel?: string;
  /** Shows an Ajouter / Retirer toggle; onConfirm then receives a signed amount. */
  allowWithdraw?: boolean;
  onConfirm: (signedAmount: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'ajouter' | 'retirer'>('ajouter');
  const [value, setValue] = useState('');

  function submit() {
    const n = Number(value.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return;
    onConfirm(allowWithdraw && mode === 'retirer' ? -n : n);
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet quick-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{title}</div>

        {allowWithdraw ? (
          <div className="segmented" style={{ marginBottom: 14 }}>
            <button data-on={mode === 'ajouter'} onClick={() => setMode('ajouter')}>
              Ajouter
            </button>
            <button data-on={mode === 'retirer'} onClick={() => setMode('retirer')}>
              Retirer
            </button>
          </div>
        ) : null}

        <input
          className="input quick-input"
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <div className="grid-2" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-accent"
            onClick={submit}
            disabled={!Number.isFinite(Number(value.replace(',', '.'))) || Number(value) <= 0}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
