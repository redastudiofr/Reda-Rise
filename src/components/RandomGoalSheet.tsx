'use client';

import { useCallback, useEffect, useState } from 'react';
import { DIFFICULTIES, categoryLabel, defaultXp } from '@/lib/xp';
import { drawGoals, type GoalTemplate } from '@/lib/randomGoals';
import type { Difficulty } from '@/lib/types';

export type GeneratedGoal = {
  title: string;
  category: GoalTemplate['category'];
  difficulty: Difficulty;
  xp: number;
  requiresProof: boolean;
};

/**
 * Draws a handful of ready-made objectives to pick from. Anything already on
 * the list is left out of the draw, so the generator never proposes something
 * the user is already doing.
 */
export default function RandomGoalSheet({
  takenTitles,
  onAdd,
  onClose,
}: {
  /** Objectives already in play — excluded from the draw. */
  takenTitles: string[];
  onAdd: (goal: GeneratedGoal) => void;
  onClose: () => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [picks, setPicks] = useState<GoalTemplate[]>([]);
  const [withProof, setWithProof] = useState(true);

  // Keyed on the contents, not the array identity: a re-render of the page
  // behind the sheet must not reshuffle the draw under the user's finger.
  const takenKey = takenTitles.join('|');
  const draw = useCallback(() => {
    setPicks(drawGoals(3, takenKey === '' ? [] : takenKey.split('|'), difficulty ?? undefined));
  }, [takenKey, difficulty]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        <div className="sheet-title">Objectif surprise</div>

        <div className="field" style={{ marginTop: 0 }}>
          <span>Difficulté</span>
          <div className="chip-grid">
            <button className="chip" data-on={difficulty === null} onClick={() => setDifficulty(null)}>
              Peu importe
            </button>
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                className="chip"
                data-on={difficulty === d.id}
                onClick={() => setDifficulty(d.id)}
              >
                {d.label} · {d.xp} XP
              </button>
            ))}
          </div>
        </div>

        {picks.length === 0 ? (
          <div className="empty">
            Plus rien à proposer dans cette difficulté — tu as déjà tout sur ta liste.
          </div>
        ) : (
          <div className="draw-list">
            {picks.map((pick) => (
              <button
                key={pick.id}
                className="draw"
                onClick={() =>
                  onAdd({
                    title: pick.title,
                    category: pick.category,
                    difficulty: pick.difficulty,
                    xp: defaultXp(pick.difficulty),
                    requiresProof: withProof && Boolean(pick.proof),
                  })
                }
              >
                <span className="draw-main">
                  <span className="draw-title">{pick.title}</span>
                  <span className="draw-meta">
                    {categoryLabel(pick.category)} ·{' '}
                    {DIFFICULTIES.find((d) => d.id === pick.difficulty)?.label}
                    {withProof && pick.proof ? ' · photo' : ''}
                  </span>
                </span>
                <span className="xp-chip">+{defaultXp(pick.difficulty)}</span>
              </button>
            ))}
          </div>
        )}

        <button
          className="check"
          data-on={withProof}
          style={{ marginTop: 12 }}
          onClick={() => setWithProof(!withProof)}
        >
          <span className="box">
            {withProof ? (
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
              </svg>
            ) : null}
          </span>
          <span className="check-main">
            <span className="check-label">Demander une photo</span>
            <span className="check-hint">Quand l’objectif laisse une trace visible</span>
          </span>
        </button>

        <div className="grid-2" style={{ marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Fermer
          </button>
          <button className="btn btn-accent" onClick={draw} disabled={picks.length === 0}>
            Relancer
          </button>
        </div>
      </div>
    </div>
  );
}
