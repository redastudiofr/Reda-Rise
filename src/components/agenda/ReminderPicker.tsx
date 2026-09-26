'use client';

import { useState } from 'react';
import { REMINDER_PRESETS, reminderLabel } from '@/lib/agenda';

const UNITS = [
  { id: 'min', label: 'min', factor: 1 },
  { id: 'h', label: 'heures', factor: 60 },
  { id: 'j', label: 'jours', factor: 1440 },
] as const;

/** Several reminders per item: the usual presets plus any custom delay. */
export default function ReminderPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState('2');
  const [unit, setUnit] = useState<(typeof UNITS)[number]['id']>('h');

  const sorted = [...new Set(value)].sort((a, b) => a - b);
  const extra = sorted.filter((m) => !REMINDER_PRESETS.includes(m));

  function toggle(m: number) {
    onChange(sorted.includes(m) ? sorted.filter((x) => x !== m) : [...sorted, m].sort((a, b) => a - b));
  }

  function addCustom() {
    const n = Number(amount.replace(',', '.'));
    const factor = UNITS.find((u) => u.id === unit)!.factor;
    if (!Number.isFinite(n) || n <= 0) return;
    const minutes = Math.min(60 * 1440, Math.round(n * factor));
    if (!sorted.includes(minutes)) onChange([...sorted, minutes].sort((a, b) => a - b));
    setCustom(false);
  }

  return (
    <div className="field">
      <span>Rappels {sorted.length ? `· ${sorted.length}` : ''}</span>
      <div className="chip-grid">
        {REMINDER_PRESETS.map((m) => (
          <button key={m} type="button" className="chip" data-on={sorted.includes(m)} onClick={() => toggle(m)}>
            {reminderLabel(m)}
          </button>
        ))}
        {extra.map((m) => (
          <button key={m} type="button" className="chip" data-on onClick={() => toggle(m)} aria-label={`Retirer le rappel ${reminderLabel(m)} avant`}>
            {reminderLabel(m)} ✕
          </button>
        ))}
        <button type="button" className="chip" data-on={custom} onClick={() => setCustom(!custom)}>
          Personnalisé
        </button>
      </div>
      {custom ? (
        <div className="ag-custom-rem">
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Délai du rappel"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)} aria-label="Unité">
            {UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} avant
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-sm btn-accent" onClick={addCustom}>
            Ajouter
          </button>
        </div>
      ) : null}
    </div>
  );
}
