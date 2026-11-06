'use client';

import { useState } from 'react';
import { PROJECT_TYPES, STAGES } from '@/lib/business';
import { COMPANY_COLORS } from '@/lib/company';
import type { Project, ProjectStage } from '@/lib/types';

export type CompanyDraft = Pick<Project, 'name' | 'type' | 'stage' | 'description' | 'mainGoal' | 'color' | 'cashStart' | 'cashStartDate'>;

/** Create or edit a company: identity, stage, and the cash it started from. */
export default function CompanySheet({
  initial,
  count,
  today,
  onSave,
  onArchive,
  onDelete,
  onClose,
}: {
  initial: Project | null;
  count: number;
  today: string;
  onSave: (d: CompanyDraft) => void;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? PROJECT_TYPES[0]);
  const [stage, setStage] = useState<ProjectStage>(initial?.stage ?? 'idee');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [mainGoal, setMainGoal] = useState(initial?.mainGoal ?? '');
  const [color, setColor] = useState(initial?.color ?? COMPANY_COLORS[count % COMPANY_COLORS.length]);
  const [cash, setCash] = useState(initial?.cashStart !== undefined ? String(initial.cashStart).replace('.', ',') : '');
  const [cashDate, setCashDate] = useState(initial?.cashStartDate ?? today);
  const [confirm, setConfirm] = useState(false);
  const cashValue = cash.trim() === '' ? undefined : Number(cash.replace(/\s/g, '').replace(',', '.'));
  const ok = name.trim() !== '' && (cashValue === undefined || Number.isFinite(cashValue));

  function submit() {
    if (!ok) return;
    onSave({
      name: name.trim(),
      type,
      stage,
      description: description.trim() || undefined,
      mainGoal: mainGoal.trim() || undefined,
      color,
      cashStart: cashValue === undefined ? undefined : Math.round(cashValue * 100) / 100,
      cashStartDate: cashValue === undefined ? undefined : cashDate || today,
    });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Entreprise" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{initial ? 'Modifier l’entreprise' : 'Nouvelle entreprise'}</div>
        <label className="field" style={{ marginTop: 0 }}>
          <span>Nom</span>
          <input className="input" value={name} autoFocus placeholder="Ex. Reda Studio" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Secteur</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Stade</span>
            <select className="input" value={stage} onChange={(e) => setStage(e.target.value as ProjectStage)}>
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Objectif principal — facultatif</span>
          <input className="input" value={mainGoal} placeholder="Ex. 10 000 € de CA mensuel" onChange={(e) => setMainGoal(e.target.value)} />
        </label>
        <label className="field">
          <span>Description — facultatif</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Trésorerie de départ (€)</span>
            <input className="input mono" inputMode="decimal" value={cash} placeholder="Facultatif" onChange={(e) => setCash(e.target.value)} />
          </label>
          <label className="field">
            <span>À la date du</span>
            <input className="input" type="date" value={cashDate} onChange={(e) => setCashDate(e.target.value)} disabled={cash.trim() === ''} />
          </label>
        </div>
        <p className="hint">La trésorerie suit ensuite les revenus et dépenses enregistrés à partir de cette date.</p>
        <div className="ag-colors">
          {COMPANY_COLORS.map((c) => (
            <button key={c} className="ag-color" data-on={color === c} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Couleur ${c}`} />
          ))}
        </div>
        {confirm ? (
          <div className="ag-delete">
            <span>Supprimer « {initial?.name} » et toutes ses opérations ? Les projets du calendrier restent, détachés.</span>
            <div className="ag-delete-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Annuler</button>
              <button className="btn btn-danger btn-sm" onClick={onDelete}>Supprimer</button>
            </div>
          </div>
        ) : null}
        <div className="ag-sheet-actions">
          {initial && !confirm ? <button className="btn btn-ghost ag-del-btn" onClick={() => setConfirm(true)}>Supprimer</button> : null}
          {initial ? <button className="btn btn-ghost" onClick={onArchive}>{initial.archived ? 'Réactiver' : 'Archiver'}</button> : <button className="btn btn-ghost" onClick={onClose}>Annuler</button>}
          <button className="btn btn-accent" disabled={!ok} onClick={submit}>{initial ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </div>
    </div>
  );
}
