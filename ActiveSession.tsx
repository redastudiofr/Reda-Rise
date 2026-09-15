'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { groupLabel, groupOf } from '@/lib/program';
import type { Exercise, LoggedExercise, LoggedWorkout } from '@/lib/types';

type LiveSet = { weight: number; reps: number; done: boolean };
type Live = Record<string, LiveSet[]>;

function lastPerf(workouts: LoggedWorkout[], exerciseId: string) {
  const sorted = [...workouts].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const w of sorted) {
    const e = w.exercises.find((x) => x.exerciseId === exerciseId);
    const best = e?.sets.filter((s) => s.reps > 0).sort((a, b) => b.weight - a.weight)[0];
    if (best) return best;
  }
  return null;
}

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ActiveSession({
  title,
  exercises,
  loads,
  workouts,
  onFinish,
  onClose,
}: {
  title: string;
  exercises: Exercise[];
  loads: Record<string, number>;
  workouts: LoggedWorkout[];
  onFinish: (logs: LoggedExercise[]) => void;
  onClose: () => void;
}) {
  const [live, setLive] = useState<Live>(() => {
    const init: Live = {};
    for (const ex of exercises) {
      const weight = loads[ex.id] ?? ex.defaultWeight;
      init[ex.id] = Array.from({ length: ex.sets }, () => ({ weight, reps: 0, done: false }));
    }
    return init;
  });

  const [rest, setRest] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      setRest((r) => (r === null ? null : r <= 1 ? null : r - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const totals = useMemo(() => {
    let done = 0;
    let planned = 0;
    let volume = 0;
    for (const ex of exercises) {
      const sets = live[ex.id] ?? [];
      planned += sets.length;
      for (const s of sets) {
        if (!s.done) continue;
        done += 1;
        volume += s.weight * s.reps;
      }
    }
    return { done, planned, volume };
  }, [live, exercises]);

  function setCell(exId: string, i: number, field: 'weight' | 'reps', value: string) {
    setLive((prev) => {
      const sets = [...(prev[exId] ?? [])];
      const num = value === '' ? 0 : Number(value.replace(',', '.'));
      sets[i] = { ...sets[i], [field]: Number.isFinite(num) ? num : 0 };
      return { ...prev, [exId]: sets };
    });
  }

  function toggleSet(ex: Exercise, i: number) {
    setLive((prev) => {
      const sets = [...(prev[ex.id] ?? [])];
      const target = sets[i];
      const willBeDone = !target.done;
      // Validating an empty set assumes the target rep count.
      const reps = willBeDone && target.reps === 0 ? ex.repMin : target.reps;
      sets[i] = { ...target, reps, done: willBeDone };
      if (willBeDone && ex.restSec > 0) setRest(ex.restSec);
      return { ...prev, [ex.id]: sets };
    });
  }

  function finish() {
    const logs: LoggedExercise[] = exercises
      .map((ex) => ({
        exerciseId: ex.id,
        sets: (live[ex.id] ?? [])
          .filter((s) => s.done && s.reps > 0)
          .map((s) => ({ weight: s.weight, reps: s.reps })),
      }))
      .filter((e) => e.sets.length > 0);
    onFinish(logs);
  }

  return (
    <div className="run">
      <div className="run-top">
        <button className="run-close" onClick={onClose} aria-label="Fermer">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="run-title">
          <b>{title}</b>
          <span className="mono">{mmss(elapsed)}</span>
        </div>
        <div className="run-count mono">
          {totals.done}/{totals.planned}
        </div>
      </div>

      <div className="run-body">
        {exercises.map((ex) => {
          const sets = live[ex.id] ?? [];
          const prev = lastPerf(workouts, ex.id);
          const isTime = ex.unit === 'sec' || ex.unit === 'min';
          return (
            <div key={ex.id} className="run-ex">
              <div className="run-ex-head">
                <div>
                  <div className="ex-name">{ex.name}</div>
                  <div className="ex-meta">
                    {groupLabel(groupOf(ex))} · {ex.sets} × {ex.repMin}–{ex.repMax}
                    {ex.restSec > 0 ? ` · repos ${ex.restSec}s` : ''}
                  </div>
                </div>
              </div>

              {prev ? (
                <div className="run-prev">
                  Dernière fois : {isTime ? `${prev.reps}` : `${prev.weight} kg × ${prev.reps}`}
                </div>
              ) : null}

              <div className="run-sets">
                {sets.map((s, i) => (
                  <div key={i} className="run-set" data-done={s.done}>
                    <span className="run-set-n mono">{i + 1}</span>
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={s.weight === 0 ? '' : String(s.weight)}
                      placeholder={isTime ? 'lest' : 'kg'}
                      onChange={(e) => setCell(ex.id, i, 'weight', e.target.value)}
                    />
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      value={s.reps === 0 ? '' : String(s.reps)}
                      placeholder={ex.unit === 'min' ? 'min' : ex.unit === 'sec' ? 's' : 'reps'}
                      onChange={(e) => setCell(ex.id, i, 'reps', e.target.value)}
                    />
                    <button
                      className="run-check"
                      data-on={s.done}
                      onClick={() => toggleSet(ex, i)}
                      aria-label="Valider la série"
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="run-bottom">
        {rest !== null ? (
          <div className="run-rest">
            <span>Repos</span>
            <b className="mono">{mmss(rest)}</b>
            <button onClick={() => setRest(null)}>Passer</button>
          </div>
        ) : null}
        <div className="run-actions">
          <div className="run-volume mono">{Math.round(totals.volume)} kg de volume</div>
          <button className="btn btn-accent" onClick={finish} disabled={totals.done === 0}>
            Terminer la séance
          </button>
        </div>
      </div>
    </div>
  );
}
