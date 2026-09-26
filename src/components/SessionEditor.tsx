'use client';

import { useState } from 'react';
import { lookupExercise } from '@/lib/program';
import { uid } from '@/lib/logic';
import type { Exercise } from '@/lib/types';

type Props = {
  dayId: string;
  ids: string[];
  catalogue: Exercise[];
  onChange: (ids: string[]) => void;
  onReset: () => void;
  onCreate: (exercise: Exercise) => void;
};

/** Reorder, remove, add or invent the exercises of one day. */
export default function SessionEditor({ ids, catalogue, onChange, onReset, onCreate }: Props) {
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [sets, setSets] = useState('3');
  const [repMin, setRepMin] = useState('8');
  const [repMax, setRepMax] = useState('12');
  const [rest, setRest] = useState('90');

  const available = catalogue
    .filter((e) => !ids.includes(e.id))
    .filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()));

  function move(index: number, delta: number) {
    const next = [...ids];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function createExercise() {
    if (name.trim() === '') return;
    const n = (v: string, fallback: number) => {
      const parsed = Number(v);
      return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
    };
    const exercise: Exercise = {
      id: `perso-${uid()}`,
      name: name.trim(),
      sets: n(sets, 3),
      repMin: n(repMin, 8),
      repMax: n(repMax, 12),
      restSec: n(rest, 90),
      rpe: 8,
      unit: 'kg',
      defaultWeight: 20,
      increment: 2.5,
    };
    onCreate(exercise);
    setName('');
    setCreating(false);
    setPicking(false);
  }

  return (
    <>
      <div className="card">
        {ids.length === 0 ? (
          <div className="empty">Aucun exercice. Ajoute-en un ci-dessous.</div>
        ) : (
          ids.map((id, i) => {
            const ex = lookupExercise(id, catalogue);
            return (
              <div key={id} className="edit-row">
                <span className="edit-name">{ex?.name ?? id}</span>
                <div className="edit-actions">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Monter">
                    ↑
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === ids.length - 1}
                    aria-label="Descendre"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => onChange(ids.filter((x) => x !== id))}
                    aria-label="Retirer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}

        <div className="grid-2" style={{ marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={onReset}>
            Réinitialiser
          </button>
          <button className="btn btn-accent" onClick={() => setPicking((v) => !v)}>
            {picking ? 'Fermer' : 'Ajouter'}
          </button>
        </div>
      </div>

      {picking ? (
        <div className="card">
          <input
            className="input"
            placeholder="Rechercher un exercice"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="picker">
            {available.length === 0 ? (
              <div className="empty">Aucun exercice ne correspond.</div>
            ) : (
              available.map((e) => (
                <button
                  key={e.id}
                  className="picker-row"
                  onClick={() => {
                    onChange([...ids, e.id]);
                    setQuery('');
                  }}
                >
                  <span>{e.name}</span>
                  <span className="muted small">
                    {e.sets} × {e.repMin}–{e.repMax}
                  </span>
                </button>
              ))
            )}
          </div>

          {creating ? (
            <>
              <label className="field">
                <span>Nom de l&apos;exercice</span>
                <input
                  className="input"
                  placeholder="Ex. Pull-over à la poulie"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <div className="grid-2">
                <label className="field">
                  <span>Séries</span>
                  <input className="input" type="number" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
                </label>
                <label className="field">
                  <span>Repos (s)</span>
                  <input className="input" type="number" inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} />
                </label>
                <label className="field">
                  <span>Reps min</span>
                  <input className="input" type="number" inputMode="numeric" value={repMin} onChange={(e) => setRepMin(e.target.value)} />
                </label>
                <label className="field">
                  <span>Reps max</span>
                  <input className="input" type="number" inputMode="numeric" value={repMax} onChange={(e) => setRepMax(e.target.value)} />
                </label>
              </div>
              <div className="grid-2" style={{ marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => setCreating(false)}>
                  Annuler
                </button>
                <button className="btn btn-accent" onClick={createExercise} disabled={name.trim() === ''}>
                  Créer et ajouter
                </button>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setCreating(true)}>
                Créer mon propre exercice
              </button>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
