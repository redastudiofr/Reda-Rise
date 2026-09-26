'use client';

import { useState } from 'react';
import { GOAL_COLORS } from '@/lib/finance';
import type { SavingsGoal } from '@/lib/types';

const num = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.'));

/** Create or edit a savings goal: what for, how much, already saved, by when. */
export default function GoalSheet({
  initial,
  count,
  onSave,
  onDelete,
  onClose,
}: {
  initial: SavingsGoal | null;
  count: number;
  onSave: (g: { label: string; target: number; current: number; deadline?: string; color: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [target, setTarget] = useState(initial ? String(initial.target) : '');
  const [current, setCurrent] = useState(initial ? String(initial.current).replace('.', ',') : '');
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [color, setColor] = useState(initial?.color ?? GOAL_COLORS[count % GOAL_COLORS.length]);
  const [confirm, setConfirm] = useState(false);
  const t = num(target);
  const c = current.trim() === '' ? 0 : num(current);
  const ok = label.trim() !== '' && Number.isFinite(t) && t > 0 && Number.isFinite(c) && c >= 0;

  function submit() {
    if (!ok) return;
    onSave({ label: label.trim(), target: Math.round(t * 100) / 100, current: Math.round(c * 100) / 100, deadline: deadline || undefined, color });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Objectif d’épargne" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{initial ? 'Modifier l’objectif' : 'Nouvel objectif d’épargne'}</div>
        <label className="field" style={{ marginTop: 0 }}>
          <span>Pour quoi ?</span>
          <input className="input" value={label} autoFocus placeholder="Ex. Voyage au Japon" onChange={(e) => setLabel(e.target.value)} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Objectif (€)</span>
            <input className="input mono" inputMode="decimal" value={target} placeholder="5000" onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="field">
            <span>Déjà de côté (€)</span>
            <input className="input mono" inputMode="decimal" value={current} placeholder="0" onChange={(e) => setCurrent(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </label>
        </div>
        <label className="field">
          <span>Échéance — facultatif</span>
          <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <div className="ag-colors">
          {GOAL_COLORS.map((col) => (
            <button key={col} className="ag-color" data-on={color === col} style={{ background: col }} onClick={() => setColor(col)} aria-label={`Couleur ${col}`} />
          ))}
        </div>
        {confirm ? (
          <div className="ag-delete">
            <span>Supprimer l’objectif « {initial?.label} » ?</span>
            <div className="ag-delete-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Annuler</button>
              <button className="btn btn-danger btn-sm" onClick={onDelete}>Supprimer</button>
            </div>
          </div>
        ) : null}
        <div className="ag-sheet-actions">
          {initial && !confirm ? <button className="btn btn-ghost ag-del-btn" onClick={() => setConfirm(true)}>Supprimer</button> : null}
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" disabled={!ok} onClick={submit}>{initial ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </div>
    </div>
  );
}
