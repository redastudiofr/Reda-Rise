'use client';

import { useState } from 'react';
import { ACCOUNT_TYPES } from '@/lib/finance';
import type { AccountType, MoneyAccount } from '@/lib/types';

function parse(v: string): number | null {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Add or edit an account kept by hand: name, type, bank, balance. */
export default function AccountSheet({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial: MoneyAccount | null;
  onSave: (a: { name: string; type: AccountType; bank?: string; balance: number }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<AccountType>(initial?.type ?? 'courant');
  const [bank, setBank] = useState(initial?.bank ?? '');
  const [balance, setBalance] = useState(initial ? String(initial.balance).replace('.', ',') : '');
  const [confirm, setConfirm] = useState(false);
  const value = parse(balance || '0');
  const ok = name.trim() !== '' && value !== null;

  function submit() {
    if (!ok) return;
    onSave({ name: name.trim(), type, bank: bank.trim() || undefined, balance: value! });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Compte" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{initial ? 'Modifier le compte' : 'Nouveau compte'}</div>
        <div className="chip-grid">
          {ACCOUNT_TYPES.map((t) => (
            <button key={t.id} className="chip fi-type" data-on={type === t.id} style={{ ['--c' as string]: t.color }} onClick={() => setType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Nom</span>
          <input className="input" value={name} autoFocus placeholder="Ex. Compte courant" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Banque — facultatif</span>
            <input className="input" value={bank} placeholder="Ex. Boursorama" onChange={(e) => setBank(e.target.value)} />
          </label>
          <label className="field">
            <span>Solde actuel (€)</span>
            <input className="input" inputMode="decimal" value={balance} placeholder="0" onChange={(e) => setBalance(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </label>
        </div>
        <p className="hint">Solde saisi à la main. Les opérations liées à ce compte le mettent à jour.</p>
        {confirm ? (
          <div className="ag-delete">
            <span>Supprimer « {initial?.name} » ? Les opérations restent, sans compte.</span>
            <div className="ag-delete-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Annuler</button>
              <button className="btn btn-danger btn-sm" onClick={onDelete}>Supprimer</button>
            </div>
          </div>
        ) : null}
        <div className="ag-sheet-actions">
          {initial && !confirm ? <button className="btn btn-ghost ag-del-btn" onClick={() => setConfirm(true)}>Supprimer</button> : null}
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" disabled={!ok} onClick={submit}>{initial ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  );
}
