'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import ActiveSession from '@/components/ActiveSession';
import SessionEditor from '@/components/SessionEditor';
import Curve from '@/components/Curve';
import {
  catalogue,
  equipmentOf,
  groupLabel,
  groupOf,
  lookupExercise,
  planIdsForDay,
} from '@/lib/program';
import {
  WEEK_ORDERED,
  formatDate,
  todayKey,
  uid,
  weekDates,
  workoutOn,
} from '@/lib/logic';
import { tipsFor, usedTipCategories, type TipCategoryId } from '@/lib/tips';
import type { DailyEntry, Exercise, LoggedExercise, MuscleGroup } from '@/lib/types';

type Quick = { id: string; label: string; pick: (all: Exercise[]) => Exercise[] };

const QUICK: Quick[] = [
  {
    id: 'haut',
    label: 'Haut du corps',
    pick: (all) => byGroups(all, ['dos', 'pectoraux', 'epaules', 'bras'], 5),
  },
  { id: 'bas', label: 'Bas du corps', pick: (all) => byGroups(all, ['jambes'], 5) },
  {
    id: 'poids',
    label: 'Poids du corps',
    pick: (all) => all.filter((e) => equipmentOf(e) === 'poids-du-corps').slice(0, 5),
  },
  {
    id: 'halteres',
    label: 'Haltères uniquement',
    pick: (all) => all.filter((e) => equipmentOf(e) === 'halteres').slice(0, 5),
  },
  {
    id: 'court',
    label: 'Court — 4 exercices',
    pick: (all) => byGroups(all, ['jambes', 'dos', 'pectoraux', 'epaules'], 4),
  },
];

/** One exercise per group, cycling, so a quick session stays balanced. */
function byGroups(all: Exercise[], groups: MuscleGroup[], limit: number): Exercise[] {
  const pools = groups.map((g) => all.filter((e) => groupOf(e) === g));
  const out: Exercise[] = [];
  let i = 0;
  while (out.length < limit && pools.some((p) => p.length > 0)) {
    const pool = pools[i % pools.length];
    const next = pool.shift();
    if (next) out.push(next);
    i++;
  }
  return out;
}

export default function MuscuPage() {
  const { data, update } = useData();
  const tz = data.settings.timezone;
  const today = todayKey(tz);

  const [running, setRunning] = useState<{ id: string; title: string; exercises: Exercise[] } | null>(
    null,
  );
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [progressId, setProgressId] = useState<string | null>(null);

  const tipCategories = usedTipCategories();
  const [tipCategory, setTipCategory] = useState<TipCategoryId>(tipCategories[0].id);
  const tips = tipsFor(tipCategory);

  const cat = useMemo(() => catalogue(data.customExercises), [data.customExercises]);

  function exercisesOf(dayId: string): Exercise[] {
    return planIdsForDay(data.plan, dayId)
      .map((id) => lookupExercise(id, data.customExercises))
      .filter((e): e is Exercise => Boolean(e));
  }

  const week = weekDates(tz);
  const weekStats = useMemo(() => {
    const done = week.filter((d) => workoutOn(data.workouts, d));
    let sets = 0;
    let volume = 0;
    for (const d of done) {
      const w = workoutOn(data.workouts, d);
      for (const e of w?.exercises ?? []) {
        for (const s of e.sets) {
          sets += 1;
          volume += s.weight * s.reps;
        }
      }
    }
    return { sessions: done.length, sets, volume: Math.round(volume) };
  }, [week, data.workouts]);

  /** Exercises with at least two logged sessions, for the progression curve. */
  const tracked = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of data.workouts) {
      for (const e of w.exercises) counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .map(([id]) => lookupExercise(id, data.customExercises))
      .filter((e): e is Exercise => Boolean(e));
  }, [data.workouts, data.customExercises]);

  const progressPoints = useMemo(() => {
    if (!progressId) return [];
    return [...data.workouts]
      .filter((w) => w.exercises.some((e) => e.exerciseId === progressId))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((w) => {
        const sets = w.exercises.find((e) => e.exerciseId === progressId)?.sets ?? [];
        const best = Math.max(...sets.map((s) => s.weight), 0);
        return { date: w.date, value: best };
      });
  }, [progressId, data.workouts]);

  function finishSession(dayId: string, logs: LoggedExercise[]) {
    if (logs.length === 0) {
      setRunning(null);
      return;
    }
    update((d) => {
      const loads = { ...d.loads };
      for (const e of logs) loads[e.exerciseId] = Math.max(...e.sets.map((s) => s.weight));
      const entry: DailyEntry = d.daily[today] ?? { tasks: {} };
      const tasks: Record<string, boolean> = { ...entry.tasks, seance: true, activite: true };
      return {
        ...d,
        loads,
        workouts: [
          { id: uid(), date: today, sessionId: dayId, exercises: logs },
          ...d.workouts.filter((w) => w.date !== today),
        ],
        daily: { ...d.daily, [today]: { ...entry, tasks } },
      };
    });
    setRunning(null);
  }

  if (running) {
    return (
      <ActiveSession
        title={running.title}
        exercises={running.exercises}
        loads={data.loads}
        workouts={data.workouts}
        onFinish={(logs) => finishSession(running.id, logs)}
        onClose={() => setRunning(null)}
      />
    );
  }

  const history = [...data.workouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Musculation</h1>
          <p className="sub">Cette semaine · {weekStats.sessions} séance{weekStats.sessions > 1 ? 's' : ''}</p>
        </div>
      </header>

      <div className="stat-row" style={{ marginTop: 4 }}>
        <div className="stat">
          <b className="mono">{weekStats.sessions}</b>
          <span>Séances</span>
        </div>
        <div className="stat">
          <b className="mono">{weekStats.sets}</b>
          <span>Séries</span>
        </div>
        <div className="stat">
          <b className="mono">{weekStats.volume}</b>
          <span>kg de volume</span>
        </div>
      </div>

      <section className="section">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Mes séances
          </h2>
          <button className="link-sm" onClick={() => setQuickOpen(true)}>
            Séance rapide
          </button>
        </div>

        {WEEK_ORDERED.filter((d) => !d.rest).map((day) => {
          const exercises = exercisesOf(day.id);
          const totalSets = exercises.reduce((a, e) => a + e.sets, 0);
          const preview = exercises.slice(0, 3);
          const more = exercises.length - preview.length;
          const isEditing = editingDay === day.id;
          const doneToday =
            day.weekday === new Date(`${today}T12:00:00Z`).getUTCDay() &&
            Boolean(workoutOn(data.workouts, today));

          return (
            <div key={day.id} className="routine">
              <div className="routine-head">
                <div>
                  <div className="routine-name">{day.title}</div>
                  <div className="routine-meta">
                    {day.label} · {totalSets} séries
                    {doneToday ? ' · faite' : ''}
                  </div>
                </div>
                <button
                  className="routine-edit"
                  onClick={() => setEditingDay(isEditing ? null : day.id)}
                >
                  {isEditing ? 'Fermer' : 'Modifier'}
                </button>
              </div>

              {isEditing ? (
                <div style={{ marginTop: 12 }}>
                  <SessionEditor
                    dayId={day.id}
                    ids={exercises.map((e) => e.id)}
                    catalogue={cat}
                    onChange={(ids) => update((d) => ({ ...d, plan: { ...d.plan, [day.id]: ids } }))}
                    onReset={() =>
                      update((d) => {
                        const next = { ...d.plan };
                        delete next[day.id];
                        return { ...d, plan: next };
                      })
                    }
                    onCreate={(ex) =>
                      update((d) => ({
                        ...d,
                        customExercises: [...d.customExercises, ex],
                        plan: { ...d.plan, [day.id]: [...planIdsForDay(d.plan, day.id), ex.id] },
                      }))
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="routine-list">
                    {preview.map((e) => (
                      <div key={e.id} className="routine-item">
                        <span className="routine-dot" />
                        <span className="routine-item-main">
                          <span className="routine-item-name">{e.name}</span>
                          <span className="routine-item-sets">
                            {e.sets} séries · {groupLabel(groupOf(e))}
                          </span>
                        </span>
                      </div>
                    ))}
                    {more > 0 ? <div className="routine-more">et {more} de plus</div> : null}
                  </div>

                  <button
                    className="btn btn-accent routine-start"
                    onClick={() => setRunning({ id: day.id, title: day.title, exercises })}
                    disabled={exercises.length === 0}
                  >
                    Commencer
                  </button>
                </>
              )}
            </div>
          );
        })}
      </section>

      {tracked.length > 0 ? (
        <section className="section">
          <h2 className="section-title">Progression par exercice</h2>
          <div className="pill-row">
            {tracked.map((e) => (
              <button
                key={e.id}
                className="pill"
                data-on={progressId === e.id}
                onClick={() => setProgressId(progressId === e.id ? null : e.id)}
              >
                {e.name}
              </button>
            ))}
          </div>
          {progressId ? (
            <div className="card" style={{ marginTop: 10 }}>
              <div className="row">
                <div className="ex-name">{lookupExercise(progressId, cat)?.name}</div>
                <div className="rec-val">
                  <b className="mono">{progressPoints[progressPoints.length - 1]?.value ?? 0} kg</b>
                </div>
              </div>
              <Curve
                points={progressPoints}
                suffix=" kg"
                periodLabel={
                  progressPoints.length > 1
                    ? `${formatDate(progressPoints[0].date)} → ${formatDate(progressPoints[progressPoints.length - 1].date)}`
                    : undefined
                }
                emptyLabel="Deux séances suffisent pour voir la courbe apparaître."
              />
            </div>
          ) : (
            <div className="card empty">Choisis un exercice pour voir l&apos;évolution des charges.</div>
          )}
        </section>
      ) : null}

      <section className="section">
        <h2 className="section-title">Historique</h2>
        {history.length === 0 ? (
          <div className="card empty">Aucune séance enregistrée pour le moment.</div>
        ) : (
          <div className="card">
            {history.map((w) => {
              const day = WEEK_ORDERED.find((d) => d.id === w.sessionId);
              const volume = w.exercises.reduce(
                (a, e) => a + e.sets.reduce((b, s) => b + s.weight * s.reps, 0),
                0,
              );
              const sets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
              return (
                <div key={w.id} className="rec">
                  <div>
                    <div className="ex-name">{day?.title ?? w.sessionId}</div>
                    <div className="ex-meta">
                      {formatDate(w.date)} · {sets} séries
                    </div>
                  </div>
                  <div className="rec-val">
                    <b className="mono">{Math.round(volume)}</b>
                    <div className="ex-meta">kg</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Conseils</h2>
        <div className="pill-row">
          {tipCategories.map((c) => (
            <button
              key={c.id}
              className="pill"
              data-on={tipCategory === c.id}
              onClick={() => setTipCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="tips">
          {tips.map((t) => (
            <article key={t.id} className="tip">
              <div className="tip-cat">
                {tipCategories.find((c) => c.id === t.category)?.label}
              </div>
              <div className="tip-title">{t.title}</div>
              <p className="tip-text">{t.text}</p>
            </article>
          ))}
        </div>
      </section>

      {quickOpen ? (
        <div className="sheet-backdrop" onClick={() => setQuickOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div className="sheet-title">Séance rapide</div>
            <div className="ex-meta" style={{ marginBottom: 14 }}>
              Composée depuis ton catalogue. Rien n&apos;est enregistré tant que tu ne termines pas
              la séance.
            </div>
            <div className="quick-grid">
              {QUICK.map((q) => {
                const picked = q.pick([...cat]);
                return (
                  <button
                    key={q.id}
                    className="quick"
                    disabled={picked.length === 0}
                    onClick={() => {
                      setQuickOpen(false);
                      setRunning({ id: 'rapide', title: q.label, exercises: picked });
                    }}
                  >
                    <span className="quick-label">{q.label}</span>
                    <span className="quick-count mono">{picked.length} exercices</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
