'use client';

import { useState } from 'react';
import { PERSONAL_EXPENSE_CATEGORIES, PERSONAL_INCOME_CATEGORIES } from '@/lib/business';

export type EntryDraft = { amount: number; category: string; label?: string };

/**
 * One-screen capture for a personal entry: type the amount, tap a category,
 * validate. The description is optional and stays out of the way — the whole
 * flow is meant to take a couple of seconds.
 */
export default function EntrySheet({
  kind,
  onSave,
  onClose,
}: {
  kind: 'revenu' | 'depense';
  onSave: (draft: EntryDraft) => void;
  onClose: () => void;
}) {
  const categories = kind === 'revenu' ? PERSONAL_INCOME_CATEGORIES : PERSONAL_EXPENSE_CATEGORIES;
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [label, setLabel] = useState('');

  const parsed = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed > 0;

  function submit() {
    if (!valid) return;
    onSave({
      amount: Math.round(parsed * 100) / 100,
      category,
      label: label.trim() || undefined,
    });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet quick-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sheet-grip" />
        <div className="sheet-title">
          {kind === 'depense' ? 'Nouvelle dépense' : 'Argent gagné'}
        </div>

        <input
          className="input quick-input"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          aria-label="Montant"
        />

        <div className="field">
          <span>Catégorie</span>
          <div className="chip-grid">
            {categories.map((c) => (
              <button
                key={c}
                className="chip"
                data-on={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <input
          className="input"
          style={{ marginTop: 12 }}
          placeholder="Description (facultatif)"
          maxLength={60}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <div className="grid-2" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-accent" onClick={submit} disabled={!valid}>
            {kind === 'depense' ? 'Ajouter la dépense' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
