'use client';

import { useState } from 'react';
import { SUBSCRIPTION_CATEGORIES } from '@/lib/business';

export type SubscriptionDraft = {
  name: string;
  amount: number;
  category?: string;
  dayOfMonth?: number;
};

/** Name, monthly amount, and two optional details. Nothing else. */
export default function SubscriptionSheet({
  onSave,
  onClose,
}: {
  onSave: (draft: SubscriptionDraft) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [day, setDay] = useState('');

  const parsed = Number(amount.replace(',', '.'));
  const valid = name.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  function submit() {
    if (!valid) return;
    const dayNum = Number(day);
    onSave({
      name: name.trim(),
      amount: Math.round(parsed * 100) / 100,
      category: category ?? undefined,
      dayOfMonth:
        Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 31 ? dayNum : undefined,
    });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        <div className="sheet-title">Nouvel abonnement</div>

        <input
          className="input"
          placeholder="Nom — Netflix, salle de sport…"
          maxLength={40}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          aria-label="Nom de l'abonnement"
        />

        <div className="grid-2" style={{ marginTop: 12 }}>
          <label className="field" style={{ marginTop: 0 }}>
            <span>Montant mensuel</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="15,99"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </label>
          <label className="field" style={{ marginTop: 0 }}>
            <span>Jour de prélèvement</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min="1"
              max="31"
              placeholder="Facultatif"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </label>
        </div>

        <div className="field">
          <span>Catégorie — facultatif</span>
          <div className="chip-grid">
            {SUBSCRIPTION_CATEGORIES.map((c) => (
              <button
                key={c}
                className="chip"
                data-on={category === c}
                onClick={() => setCategory(category === c ? null : c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-accent" onClick={submit} disabled={!valid}>
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
