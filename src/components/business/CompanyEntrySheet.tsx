'use client';

import { useState } from 'react';
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from '@/lib/business';
import type { FinanceEntry } from '@/lib/types';

/** Record or edit a company revenue or expense. */
export default function CompanyEntrySheet({
  initial,
  kind: initialKind,
  today,
  onSave,
  onDelete,
  onClose,
}: {
  initial: FinanceEntry | null;
  kind: 'revenu' | 'depense';
  today: string;
  onSave: (e: Omit<FinanceEntry, 'id'>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState(initial?.kind ?? initialKind);
  const cats = kind === 'revenu' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;
  const [category, setCategory] = useState(initial?.category ?? cats[0]);
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace('.', ',') : '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [date, setDate] = useState(initial?.date ?? today);
  const n = Number(amount.replace(/\s/g, '').replace(',', '.'));
  const ok = Number.isFinite(n) && n > 0 && date !== '';

  function switchKind(k: 'revenu' | 'depense') {
    setKind(k);
    const list = k === 'revenu' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;
    if (!list.includes(category)) setCategory(list[0]);
  }

  function submit() {
    if (ok) onSave({ kind, category, amount: Math.round(n * 100) / 100, label: label.trim() || undefined, date });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Opération" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="segmented fi-kind" role="tablist">
          <button role="tab" aria-selected={kind === 'revenu'} data-on={kind === 'revenu'} onClick={() => switchKind('revenu')}>Chiffre d’affaires</button>
          <button role="tab" aria-selected={kind === 'depense'} data-on={kind === 'depense'} onClick={() => switchKind('depense')}>Dépense</button>
        </div>
        <input className="input fi-amount mono" inputMode="decimal" placeholder="0,00 €" value={amount} autoFocus aria-label="Montant" onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <div className="field">
          <span>Catégorie</span>
          <div className="chip-grid">
            {cats.map((c) => <button key={c} className="chip" data-on={category === c} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Libellé — facultatif</span>
            <input className="input" value={label} placeholder={kind === 'revenu' ? 'Ex. Commande #1042' : 'Ex. Campagne Meta'} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </label>
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="ag-sheet-actions">
          {initial ? <button className="btn btn-ghost ag-del-btn" onClick={onDelete}>Supprimer</button> : null}
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" disabled={!ok} onClick={submit}>{initial ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  );
}
