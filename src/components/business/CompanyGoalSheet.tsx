'use client';

import { useState } from 'react';
import type { CompanyGoal } from '@/lib/types';

const METRICS: { id: CompanyGoal['metric']; label: string }[] = [
  { id: 'ca', label: 'Chiffre d’affaires' },
  { id: 'benefice', label: 'Bénéfice' },
  { id: 'custom', label: 'Autre (clients, ventes…)' },
];

/** A company goal: CA or profit over the month or the year, or any figure tracked by hand. */
export default function CompanyGoalSheet({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial: CompanyGoal | null;
  onSave: (g: Omit<CompanyGoal, 'id' | 'createdAt'>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [metric, setMetric] = useState<CompanyGoal['metric']>(initial?.metric ?? 'ca');
  const [period, setPeriod] = useState<CompanyGoal['period']>(initial?.period ?? 'mois');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [target, setTarget] = useState(initial ? String(initial.target) : '');
  const [current, setCurrent] = useState(initial?.current !== undefined ? String(initial.current) : '');
  const t = Number(target.replace(/\s/g, '').replace(',', '.'));
  const c = current.trim() === '' ? undefined : Number(current.replace(/\s/g, '').replace(',', '.'));
  const ok = Number.isFinite(t) && t > 0 && (metric !== 'custom' || label.trim() !== '');

  function submit() {
    if (!ok) return;
    const auto = metric === 'ca' ? 'Chiffre d’affaires' : 'Bénéfice';
    onSave({
      metric,
      period,
      target: Math.round(t * 100) / 100,
      label: label.trim() || `${auto} ${period === 'mois' ? 'du mois' : 'de l’année'}`,
      current: metric === 'custom' && c !== undefined && Number.isFinite(c) ? c : undefined,
    });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Objectif" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{initial ? 'Modifier l’objectif' : 'Nouvel objectif'}</div>
        <div className="chip-grid">
          {METRICS.map((m) => <button key={m.id} className="chip" data-on={metric === m.id} onClick={() => setMetric(m.id)}>{m.label}</button>)}
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Cible</span>
            <input className="input mono" inputMode="decimal" value={target} autoFocus placeholder={metric === 'custom' ? '100' : '10000'} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </label>
          <label className="field">
            <span>Période</span>
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as CompanyGoal['period'])}>
              <option value="mois">Ce mois-ci</option>
              <option value="annee">Cette année</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>{metric === 'custom' ? 'Intitulé' : 'Intitulé — facultatif'}</span>
          <input className="input" value={label} placeholder={metric === 'custom' ? 'Ex. 100 clients' : ''} onChange={(e) => setLabel(e.target.value)} />
        </label>
        {metric === 'custom' ? (
          <label className="field">
            <span>Où tu en es</span>
            <input className="input mono" inputMode="decimal" value={current} placeholder="0" onChange={(e) => setCurrent(e.target.value)} />
          </label>
        ) : (
          <p className="hint">Calculé automatiquement à partir des opérations de l’entreprise.</p>
        )}
        <div className="ag-sheet-actions">
          {initial ? <button className="btn btn-ghost ag-del-btn" onClick={onDelete}>Supprimer</button> : null}
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" disabled={!ok} onClick={submit}>{initial ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </div>
    </div>
  );
}
