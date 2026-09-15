'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import Curve from '@/components/Curve';
import XpBurst from '@/components/XpBurst';
import ObjectiveSheet, { type ObjectiveDraft } from '@/components/ObjectiveSheet';
import ConfirmDialog from '@/components/ConfirmDialog';
import PhotoProof from '@/components/PhotoProof';
import RandomGoalSheet, { type GeneratedGoal } from '@/components/RandomGoalSheet';
import {
  MAX_DAY_XP,
  TASKS,
  dayXp,
  formatDate,
  shiftKey,
  todayKey,
  todayPlan,
  uid,
  workoutOn,
} from '@/lib/logic';
import {
  METRICS,
  RANGES,
  categoryLabel,
  isDone,
  levelFromXp,
  objectivesForDate,
  series,
  streakOf,
  totalXpOf,
  xpOnDate,
  type MetricId,
  type RangeId,
} from '@/lib/xp';
import { deleteQuest } from '@/lib/quests';
import { proofKey, type DailyEntry, type Objective, type ObjectiveProof } from '@/lib/types';

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  );
}

function Trash() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="M6.6 7l.8 11.1A1.9 1.9 0 0 0 9.3 20h5.4a1.9 1.9 0 0 0 1.9-1.9L17.4 7" />
    </svg>
  );
}

function Flame() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3s4.5 3.8 4.5 8a4.5 4.5 0 0 1-9 0c0-1.3.5-2.4 1.2-3.3.2 1.3.9 2.1 1.8 2.1 1.1 0 1.7-.9 1.5-2.3-.2-1.6-.6-3-1-4.5Z" />
      <path d="M6.5 13.6A6 6 0 0 0 12 21a6 6 0 0 0 5.5-7.4" />
    </svg>
  );
}

export default function TodayPage() {
  const { data, update, status, durable, pending } = useData();
  const tz = data.settings.timezone;
  const key = todayKey(tz);
  const entry = data.daily[key];
  const plan = todayPlan(tz);
  const logged = workoutOn(data.workouts, key);

  const [metric, setMetric] = useState<MetricId>('xpCumule');
  const [range, setRange] = useState<RangeId>('30j');
  const [burst, setBurst] = useState<{ id: number; amount: number; title: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Objective | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Objective | null>(null);
  const [drawing, setDrawing] = useState(false);
  /** Objective waiting for its photo before it counts as done. */
  const [provingId, setProvingId] = useState<string | null>(null);

  function saveObjective(draft: ObjectiveDraft) {
    update((d) => {
      if (editing) {
        return {
          ...d,
          objectives: d.objectives.map((o) =>
            o.id === editing.id ? { ...o, ...draft, date: o.date } : o,
          ),
        };
      }
      const created: Objective = {
        id: uid(),
        createdAt: key,
        archived: false,
        date: draft.recurrence === 'once' ? key : undefined,
        ...draft,
      };
      return { ...d, objectives: [created, ...d.objectives] };
    });
    setCreating(false);
    setEditing(null);
  }

  /** Adds a drawn objective as a one-off quest for today. */
  function addGenerated(goal: GeneratedGoal) {
    const created: Objective = {
      id: uid(),
      title: goal.title,
      category: goal.category,
      difficulty: goal.difficulty,
      xp: goal.xp,
      recurrence: 'once',
      date: key,
      createdAt: key,
      archived: false,
      generated: true,
      requiresProof: goal.requiresProof || undefined,
    };
    update((d) => ({ ...d, objectives: [created, ...d.objectives] }));
    setDrawing(false);
  }

  function postpone(o: Objective) {
    const tomorrow = shiftKey(key, 1);
    update((d) => ({
      ...d,
      objectives: d.objectives.map((x) => (x.id === o.id ? { ...x, date: tomorrow } : x)),
    }));
    setOpenId(null);
  }

  function archive(o: Objective) {
    update((d) => ({
      ...d,
      objectives: d.objectives.map((x) => (x.id === o.id ? { ...x, archived: true } : x)),
    }));
    setOpenId(null);
  }

  /** Drops the objective, every tick that referenced it and its photo proofs. */
  function remove(o: Objective) {
    update((d) => deleteQuest(d, o.id));
    setOpenId(null);
    setConfirmDelete(null);
  }

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 1500);
    return () => clearTimeout(t);
  }, [burst]);

  const todays = useMemo(() => objectivesForDate(data.objectives, key), [data.objectives, key]);
  const doneCount = todays.filter((o) => isDone(entry, o.id)).length;

  const stats = useMemo(() => {
    const total = totalXpOf(data, dayXp);
    return {
      level: levelFromXp(total),
      streak: streakOf(data, tz, dayXp),
      today: xpOnDate(data, key, dayXp),
    };
  }, [data, tz, key]);

  const points = useMemo(
    () => series(data, tz, metric, range, dayXp),
    [data, tz, metric, range],
  );

  const suffix = metric === 'niveau' ? '' : metric === 'objectifs' ? '' : ' XP';

  const periodLabel =
    points.length > 1
      ? `${formatDate(points[0].date)} → ${formatDate(points[points.length - 1].date)}`
      : undefined;

  /** Flips completion for today, and drops the photo when it is un-validated. */
  function setObjectiveDone(o: Objective, done: boolean, photo?: string) {
    update((d) => {
      const e: DailyEntry = d.daily[key] ?? { tasks: {} };
      const list = e.objectives ?? [];
      const proofs = { ...d.proofs };
      const pk = proofKey(key, o.id);

      if (done && photo) {
        const proof: ObjectiveProof = {
          objectiveId: o.id,
          date: key,
          photo,
          takenAt: new Date().toISOString(),
        };
        proofs[pk] = proof;
      }
      if (!done) delete proofs[pk];

      return {
        ...d,
        proofs,
        daily: {
          ...d.daily,
          [key]: {
            ...e,
            objectives: done ? [...list.filter((x) => x !== o.id), o.id] : list.filter((x) => x !== o.id),
          },
        },
      };
    });
    if (done) setBurst({ id: Date.now(), amount: o.xp, title: o.title });
  }

  function toggleObjective(o: Objective) {
    const done = isDone(entry, o.id);
    // A quest that asks for a photo only counts once the photo is there.
    if (!done && o.requiresProof && !data.proofs[proofKey(key, o.id)]) {
      setProvingId(o.id);
      return;
    }
    setObjectiveDone(o, !done);
  }

  function toggleTask(taskId: string) {
    update((d) => {
      const e: DailyEntry = d.daily[key] ?? { tasks: {} };
      const tasks: Record<string, boolean> = { ...e.tasks, [taskId]: !e.tasks[taskId] };
      return { ...d, daily: { ...d.daily, [key]: { ...e, tasks } } };
    });
  }

  function closeDay() {
    update((d) => {
      const e: DailyEntry = d.daily[key] ?? { tasks: {} };
      return { ...d, daily: { ...d.daily, [key]: { ...e, closed: !e.closed } } };
    });
  }

  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  }).format(new Date());

  const proving = provingId ? (todays.find((o) => o.id === provingId) ?? null) : null;

  const checklistXp = dayXp(entry);
  const dayRatio = Math.round((stats.today / (MAX_DAY_XP + todays.reduce((a, o) => a + o.xp, 0) || 1)) * 100);
  const unfinished = todays.filter((o) => !isDone(entry, o.id));

  return (
    <>
      {burst ? <XpBurst key={burst.id} amount={burst.amount} title={burst.title} /> : null}
      {creating || editing ? (
        <ObjectiveSheet
          initial={editing}
          onSave={saveObjective}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          title="Supprimer cet objectif ?"
          detail={confirmDelete.title}
          onConfirm={() => remove(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      ) : null}
      {drawing ? (
        <RandomGoalSheet
          takenTitles={data.objectives.filter((o) => !o.archived).map((o) => o.title)}
          onAdd={addGenerated}
          onClose={() => setDrawing(false)}
        />
      ) : null}
      {proving ? (
        <PhotoProof
          title={proving.title}
          onConfirm={(photo) => {
            setObjectiveDone(proving, true, photo);
            setProvingId(null);
          }}
          onClose={() => setProvingId(null)}
        />
      ) : null}

      <header className="topbar">
        <div>
          <h1>Aujourd&apos;hui</h1>
          <p className="sub">{dateLabel}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-mark" src="/icons/icon-192.png" alt="" width={34} height={34} />
      </header>

      <div className="level-card">
        <div className="row">
          <div>
            <div className="level-tag">Niveau</div>
            <div className="level-number mono">{stats.level.level}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="level-xp mono">
              {stats.level.intoLevel} / {stats.level.needed} XP
            </div>
            <div className="level-xp mono" style={{ opacity: 0.65 }}>
              {stats.level.total} XP au total
            </div>
          </div>
        </div>
        <div className="bar">
          <i style={{ width: `${Math.round(stats.level.progress * 100)}%` }} />
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <b className="mono streak-value">
            <Flame />
            {stats.streak}
          </b>
          <span>Jours d&apos;affilée</span>
        </div>
        <div className="stat">
          <b className="mono">
            {doneCount}/{todays.length}
          </b>
          <span>Objectifs du jour</span>
        </div>
        <div className="stat">
          <b className="mono">+{stats.today}</b>
          <span>XP aujourd&apos;hui</span>
        </div>
      </div>

      {status === 'local' && pending ? (
        <div className="banner warn">
          Hors-ligne. Tout est enregistré sur l&apos;appareil et synchronisé au retour du réseau.
        </div>
      ) : null}
      {status === 'ready' && !durable ? (
        <div className="banner warn">Aucune base de données connectée.</div>
      ) : null}

      <section className="section">
        <h2 className="section-title">Progression</h2>
        <div className="card">
          <div className="segmented">
            {METRICS.map((m) => (
              <button key={m.id} data-on={m.id === metric} onClick={() => setMetric(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="pill-row" style={{ marginTop: 12 }}>
            {RANGES.map((r) => (
              <button
                key={r.id}
                className="pill"
                data-on={r.id === range}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Curve points={points} suffix={suffix} periodLabel={periodLabel} />
        </div>
      </section>

      <section className="section">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Objectifs du jour · {doneCount}/{todays.length}
          </h2>
          <Link href="/quetes" className="link-sm">
            Mes quêtes
          </Link>
        </div>

        {todays.length === 0 ? (
          <div className="card empty">
            Rien de fixé pour aujourd&apos;hui. Les objectifs sont libres — tu en poses quand tu
            veux, tu les retires quand ils n&apos;ont plus de sens.
          </div>
        ) : (
          todays.map((o) => {
            const on = isDone(entry, o.id);
            const open = openId === o.id;
            return (
              <div key={o.id} className="obj">
                <div className="obj-row">
                  <button className="check" data-on={on} onClick={() => toggleObjective(o)}>
                    <span className="box">{on ? <Check /> : null}</span>
                    <span className="check-main">
                      <span className="check-label">{o.title}</span>
                      <span className="check-hint">
                        {categoryLabel(o.category)}
                        {o.time ? ` · ${o.time}` : ''}
                        {o.requiresProof ? (on ? ' · photo fournie' : ' · photo requise') : ''}
                      </span>
                    </span>
                    <span className="xp-chip">+{o.xp}</span>
                  </button>
                  <button
                    className="obj-more"
                    data-on={open}
                    onClick={() => setOpenId(open ? null : o.id)}
                    aria-label="Actions"
                  >
                    <span />
                    <span />
                    <span />
                  </button>
                  <button
                    className="obj-del"
                    onClick={() => setConfirmDelete(o)}
                    aria-label={`Supprimer ${o.title}`}
                    title="Supprimer"
                  >
                    <Trash />
                  </button>
                </div>

                {open ? (
                  <div className="obj-actions">
                    <button onClick={() => { setEditing(o); setOpenId(null); }}>Modifier</button>
                    {o.recurrence === 'once' ? (
                      <button onClick={() => postpone(o)}>Reporter à demain</button>
                    ) : (
                      <button onClick={() => archive(o)}>Archiver</button>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}

        <div className="money-actions">
          <button className="btn btn-accent" onClick={() => setCreating(true)}>
            + Fixer un objectif
          </button>
          <button className="btn btn-ghost" onClick={() => setDrawing(true)}>
            Objectif surprise
          </button>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Séance du jour</h2>
        <Link href="/muscu" className="card row">
          <div>
            <div className="ex-name">
              {plan.title}
              {logged ? ' · terminée' : ''}
            </div>
            <div className="ex-meta">
              {plan.rest ? plan.focus : `${plan.exercises.length} exercices · ${plan.focus}`}
            </div>
          </div>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5.5 15.5 12 9 18.5" />
          </svg>
        </Link>
      </section>

      <section className="section">
        <h2 className="section-title">
          Discipline · {checklistXp} / {MAX_DAY_XP} XP
        </h2>
        {TASKS.map((task) => {
          const on = Boolean(entry?.tasks?.[task.id]);
          return (
            <button key={task.id} className="check" data-on={on} onClick={() => toggleTask(task.id)}>
              <span className="box">{on ? <Check /> : null}</span>
              <span className="check-main">
                <span className="check-label">{task.label}</span>
                <span className="check-hint">{task.hint}</span>
              </span>
              <span className="xp-chip">+{task.xp}</span>
            </button>
          );
        })}
      </section>

      <section className="section">
        <h2 className="section-title">Bilan du jour</h2>
        <div className="card">
          <div className="review-grid">
            <div>
              <b className="mono">
                {doneCount} / {todays.length}
              </b>
              <span>Objectifs</span>
            </div>
            <div>
              <b className="mono">+{stats.today}</b>
              <span>XP gagné</span>
            </div>
            <div>
              <b className="mono">{dayRatio}%</b>
              <span>Journée</span>
            </div>
          </div>

          {unfinished.length > 0 ? (
            <div className="hint" style={{ marginTop: 14 }}>
              Reste à faire : {unfinished.map((o) => o.title).join(', ')}
            </div>
          ) : (
            <div className="hint" style={{ marginTop: 14 }}>
              Tout est terminé pour aujourd&apos;hui.
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <button className={entry?.closed ? 'btn' : 'btn btn-accent'} onClick={closeDay}>
              {entry?.closed ? 'Journée terminée — rouvrir' : 'Terminer ma journée'}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
