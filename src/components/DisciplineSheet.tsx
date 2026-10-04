'use client';

import { useState } from 'react';
import { DISCIPLINE_LIMITS, clampTaskXp, uid } from '@/lib/logic';
import type { DisciplineTask } from '@/lib/types';

const { min: MIN, max: MAX, xpMin: XP_MIN, xpMax: XP_MAX } = DISCIPLINE_LIMITS;

/**
 * The user's own Discipline checklist: 1 to 15 items, each worth 1 to 20 XP.
 * Past days keep the XP they earned whatever changes here.
 */
export default function DisciplineSheet({
  initial,
  onSave,
  onClose,
}: {
  initial: DisciplineTask[];
  onSave: (list: DisciplineTask[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<DisciplineTask[]>(() => initial.map((t) => ({ ...t, hint: t.hint ?? '' })));
  const [error, setError] = useState<string | null>(null);

  const set = (i: number, patch: Partial<DisciplineTask>) => {
    setError(null);
    setList((l) => l.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  };
  const move = (i: number, dir: -1 | 1) =>
    setList((l) => {
      const j = i + dir;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function save() {
    const clean = list.map((t) => ({ ...t, label: t.label.trim(), hint: (t.hint ?? '').trim(), xp: clampTaskXp(t.xp) }));
    if (clean.some((t) => !t.label)) return setError('Chaque objectif doit avoir un nom.');
    if (clean.length < MIN) return setError('Garde au moins un objectif.');
    onSave(clean.map(({ hint, ...t }) => (hint ? { ...t, hint } : t)));
  }

  const total = list.reduce((a, t) => a + clampTaskXp(t.xp), 0);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet disc-sheet" role="dialog" aria-label="Objectifs Discipline" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">Mes objectifs Discipline</div>
        <p className="hint" style={{ marginTop: 0 }}>
          Tes habitudes de chaque jour : de {MIN} à {MAX} objectifs, chacun rapporte de {XP_MIN} à {XP_MAX} XP. L’XP déjà gagné les jours
          passés ne change pas.
        </p>

        <ol className="disc-list">
          {list.map((t, i) => (
            <li key={t.id} className="disc-row">
              <div className="disc-fields">
                <input
                  className="input"
                  value={t.label}
                  maxLength={DISCIPLINE_LIMITS.label}
                  placeholder="Ex. Lecture 20 min"
                  aria-label={`Objectif ${i + 1}`}
                  onChange={(e) => set(i, { label: e.target.value })}
                />
                <input
                  className="input disc-hint"
                  value={t.hint ?? ''}
                  maxLength={DISCIPLINE_LIMITS.hint}
                  placeholder="Précision (facultatif)"
                  aria-label={`Précision de l’objectif ${i + 1}`}
                  onChange={(e) => set(i, { hint: e.target.value })}
                />
              </div>
              <div className="disc-side">
                <div className="disc-xp" role="group" aria-label={`XP de l’objectif ${i + 1}`}>
                  <button type="button" aria-label="Moins d’XP" disabled={t.xp <= XP_MIN} onClick={() => set(i, { xp: clampTaskXp(t.xp - 1) })}>−</button>
                  <input
                    className="mono"
                    inputMode="numeric"
                    value={t.xp}
                    aria-label={`XP de l’objectif ${i + 1}`}
                    onChange={(e) => set(i, { xp: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                    onBlur={() => set(i, { xp: clampTaskXp(t.xp) })}
                  />
                  <button type="button" aria-label="Plus d’XP" disabled={t.xp >= XP_MAX} onClick={() => set(i, { xp: clampTaskXp(t.xp + 1) })}>+</button>
                </div>
                <div className="disc-tools">
                  <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" aria-label="Descendre" disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button
                    type="button"
                    className="disc-del"
                    aria-label={`Supprimer ${t.label || `l’objectif ${i + 1}`}`}
                    disabled={list.length <= MIN}
                    onClick={() => {
                      setError(null);
                      setList((l) => l.filter((_, j) => j !== i));
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          className="btn btn-ghost"
          disabled={list.length >= MAX}
          onClick={() => setList((l) => [...l, { id: uid(), label: '', hint: '', xp: 10 }])}
        >
          {list.length >= MAX ? `Maximum ${MAX} objectifs` : '+ Ajouter un objectif'}
        </button>
        <p className="sub disc-total">
          {list.length} objectif{list.length > 1 ? 's' : ''} · {total} XP par jour au maximum
        </p>

        {error ? <div className="banner warn" role="alert">{error}</div> : null}
        <div className="ag-sheet-actions">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" onClick={save}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
