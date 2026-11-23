'use client';

import { useState } from 'react';
import { SUBSCRIPTION_CATEGORIES } from '@/lib/business';
import { FREQUENCIES, IMPORTANCES, USAGES, monthlyEquivalent } from '@/lib/finance';
import type { MoneyAccount, SubFrequency, SubImportance, SubUsage, Subscription } from '@/lib/types';

/** Add or edit a subscription, with what feeds its analysis. */
export default function SubSheet({
  initial,
  accounts,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Subscription | null;
  accounts: MoneyAccount[];
  onSave: (s: Omit<Subscription, 'id' | 'createdAt'>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price ?? initial.amount).replace('.', ',') : '');
  const [frequency, setFrequency] = useState<SubFrequency>(initial?.frequency ?? 'mensuel');
  const [billingDate, setBillingDate] = useState(initial?.billingDate ?? '');
  const [category, setCategory] = useState(initial?.category ?? SUBSCRIPTION_CATEGORIES[0]);
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  const [usage, setUsage] = useState<SubUsage | undefined>(initial?.usage);
  const [importance, setImportance] = useState<SubImportance | undefined>(initial?.importance);
  const [alternative, setAlternative] = useState(initial?.alternative ?? '');
  const [confirm, setConfirm] = useState(false);
  const n = Number(price.replace(/\s/g, '').replace(',', '.'));
  const ok = name.trim() !== '' && Number.isFinite(n) && n > 0;

  function submit() {
    if (!ok) return;
    const p = Math.round(n * 100) / 100;
    onSave({
      name: name.trim(),
      price: p,
      frequency,
      amount: monthlyEquivalent(p, frequency),
      billingDate: billingDate || undefined,
      // A legacy day of month only survives while no full date replaces it.
      dayOfMonth: billingDate ? undefined : initial?.dayOfMonth,
      category,
      accountId: accountId || undefined,
      usage,
      importance,
      alternative: alternative.trim() || undefined,
      decision: initial?.decision,
    });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Abonnement" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{initial ? 'Modifier l’abonnement' : 'Nouvel abonnement'}</div>
        <div className="grid-2">
          <label className="field" style={{ marginTop: 0 }}>
            <span>Nom</span>
            <input className="input" value={name} autoFocus placeholder="Ex. Netflix" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field" style={{ marginTop: 0 }}>
            <span>Prix (€)</span>
            <input className="input mono" inputMode="decimal" value={price} placeholder="0,00" onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </label>
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Fréquence</span>
            <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as SubFrequency)}>
              {FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Date de prélèvement</span>
            <input className="input" type="date" value={billingDate} onChange={(e) => setBillingDate(e.target.value)} />
          </label>
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Catégorie</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {SUBSCRIPTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Compte associé</span>
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Aucun</option>
              {accounts.filter((a) => !a.archived || a.id === accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        </div>

        <div className="fi-analysis-inputs">
          <div className="fi-sub-h">Pour l’analyse — facultatif</div>
          <div className="field">
            <span>Tu l’utilises…</span>
            <div className="chip-grid">
              {USAGES.map((u) => (
                <button key={u.id} className="chip" data-on={usage === u.id} onClick={() => setUsage(usage === u.id ? undefined : u.id)}>{u.label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Importance pour toi</span>
            <div className="segmented">
              {IMPORTANCES.map((i) => (
                <button key={i.id} data-on={importance === i.id} onClick={() => setImportance(importance === i.id ? undefined : i.id)}>{i.label}</button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Alternative éventuelle</span>
            <input className="input" value={alternative} placeholder="Ex. offre gratuite, abonnement partagé…" onChange={(e) => setAlternative(e.target.value)} />
          </label>
        </div>

        {confirm ? (
          <div className="ag-delete">
            <span>Supprimer « {initial?.name} » de la liste ?</span>
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
