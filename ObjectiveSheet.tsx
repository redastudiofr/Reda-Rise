'use client';

import { useState } from 'react';
import { CATEGORIES, DIFFICULTIES, defaultXp } from '@/lib/xp';
import type { Category, Difficulty, Objective, Recurrence } from '@/lib/types';

const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export type ObjectiveDraft = {
  title: string;
  category: Category;
  difficulty: Difficulty;
  xp: number;
  time?: string;
  recurrence: Recurrence;
  days?: number[];
  /** The objective only counts once a photo has been attached. */
  requiresProof?: boolean;
};

/** Bottom sheet used to fix a new objective or edit an existing one. */
export default function ObjectiveSheet({
  initial,
  onSave,
  onClose,
}: {
  initial?: Objective | null;
  onSave: (draft: ObjectiveDraft) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'personnel');
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'moyen');
  const [xp, setXp] = useState(String(initial?.xp ?? defaultXp('moyen')));
  const [time, setTime] = useState(initial?.time ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>(initial?.recurrence ?? 'once');
  const [days, setDays] = useState<number[]>(initial?.days ?? [1, 2, 3, 4, 5]);
  const [requiresProof, setRequiresProof] = useState(Boolean(initial?.requiresProof));
  const [more, setMore] = useState(false);

  function submit() {
    if (title.trim() === '') return;
    const parsed = Number(xp);
    onSave({
      title: title.trim(),
      category,
      difficulty,
      xp: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : defaultXp(difficulty),
      time: time || undefined,
      recurrence,
      days: recurrence === 'weekdays' ? days : undefined,
      requiresProof: requiresProof || undefined,
    });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{initial ? 'Modifier l’objectif' : 'Fixer un objectif'}</div>

        <input
          className="input"
          placeholder="Ex. Travailler 2 h sur mon entreprise"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="field">
          <span>Catégorie</span>
          <div className="chip-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className="chip"
                data-on={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Difficulté</span>
          <div className="segmented">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                data-on={difficulty === d.id}
                onClick={() => {
                  setDifficulty(d.id);
                  setXp(String(d.xp));
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Quand</span>
          <div className="segmented">
            <button data-on={recurrence === 'once'} onClick={() => setRecurrence('once')}>
              Aujourd&apos;hui
            </button>
            <button data-on={recurrence === 'daily'} onClick={() => setRecurrence('daily')}>
              Chaque jour
            </button>
            <button data-on={recurrence === 'weekdays'} onClick={() => setRecurrence('weekdays')}>
              Certains jours
            </button>
          </div>
        </div>

        {recurrence === 'weekdays' ? (
          <div className="field">
            <span>Jours</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {DAYS.map((label, i) => {
                const on = days.includes(i);
                return (
                  <button
                    key={i}
                    className="pill"
                    data-on={on}
                    style={{ flex: 1, textAlign: 'center', padding: '9px 0' }}
                    onClick={() =>
                      setDays(on ? days.filter((x) => x !== i) : [...days, i].sort())
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <button
          className="check"
          data-on={requiresProof}
          style={{ marginTop: 12 }}
          onClick={() => setRequiresProof(!requiresProof)}
        >
          <span className="box">
            {requiresProof ? (
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
              </svg>
            ) : null}
          </span>
          <span className="check-main">
            <span className="check-label">Valider avec une photo</span>
            <span className="check-hint">L’objectif ne compte qu’une fois la photo ajoutée</span>
          </span>
        </button>

        {more ? (
          <div className="grid-2">
            <label className="field">
              <span>Récompense XP</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={xp}
                onChange={(e) => setXp(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Heure</span>
              <input
                className="input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
        ) : (
          <button className="link-sm" style={{ marginTop: 12 }} onClick={() => setMore(true)}>
            Options — XP et heure
          </button>
        )}

        <div className="grid-2" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-accent" onClick={submit} disabled={title.trim() === ''}>
            {initial ? 'Enregistrer' : 'Fixer'}
          </button>
        </div>
      </div>
    </div>
  );
}
