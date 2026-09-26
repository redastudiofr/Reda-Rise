'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import ProgressPanel from '@/components/ProgressPanel';
import XpBurst from '@/components/XpBurst';
import ObjectiveSheet, { type ObjectiveDraft } from '@/components/ObjectiveSheet';
import ConfirmDialog from '@/components/ConfirmDialog';
import PhotoProof from '@/components/PhotoProof';
import RandomGoalSheet, { type GeneratedGoal } from '@/components/RandomGoalSheet';
import {
  MAX_DAY_XP,
  TASKS,
  dayXp,
  shiftKey,
  todayKey,
  todayPlan,
  uid,
  workoutOn,
} from '@/lib/logic';
import {
  categoryLabel,
  isDone,
  levelFromXp,
  objectivesForDate,
  streakOf,
  totalXpOf,
  xpOnDate,
} from '@/lib/xp';
import { deleteQuest } from '@/lib/quests';
import { localNow } from '@/lib/schedule';
import { enablePush, readPushState, type PushState } from '@/lib/pushClient';
import { proofKey, type DailyEntry, type Objective, type ObjectiveProof } from '@/lib/types';

type Filter = 'tous' | 'afaire' | 'faits';

/** How long a just-validated objective keeps its animation, and its place in a filtered list. */
const SETTLE_MS = 900;

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path className="dash-tick" d="M4.5 12.5 9.5 17.5 19.5 6.5" />
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

function Bell() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

function Clock() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5.5 15.5 12 9 18.5" />
    </svg>
  );
}

/** Day progress as a ring: completed objectives over today's total. */
function Ring({ done, total }: { done: number; total: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? done / total : 0;
  return (
    <div className="dash-ring" role="img" aria-label={`${done} objectifs terminés sur ${total}`}>
      <svg viewBox="0 0 100 100">
        <circle className="dash-ring-track" cx="50" cy="50" r={r} />
        <circle
          className="dash-ring-fill"
          cx="50"
          cy="50"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <div className="dash-ring-label">
        <b className="mono">{Math.round(ratio * 100)}%</b>
        <span>du jour</span>
      </div>
    </div>
  );
}

function parseTime(t?: string): number | null {
  const m = t ? /^(\d{1,2}):(\d{2})$/.exec(t) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export default function TodayPage() {
  const { data, update, status, durable, pending } = useData();
  const tz = data.settings.timezone;
  const key = todayKey(tz);
  const entry = data.daily[key];
  const plan = todayPlan(tz);
  const logged = workoutOn(data.workouts, key);
  const dayCheck = data.settings.notifications.dayCheck;

  const [burst, setBurst] = useState<{ id: number; amount: number; title: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Objective | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Objective | null>(null);
  const [drawing, setDrawing] = useState(false);
  /** Objective waiting for its photo before it counts as done. */
  const [provingId, setProvingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('tous');
  /** Objective just validated: plays its animation and stays in a filtered list a moment. */
  const [recent, setRecent] = useState<{ id: string; done: boolean } | null>(null);
  const [nowMinutes, setNowMinutes] = useState(() => localNow(tz).minutes);
  const [push, setPush] = useState<PushState>('unknown');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNowMinutes(localNow(tz).minutes);
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [tz]);

  useEffect(() => {
    let alive = true;
    readPushState().then((s) => alive && setPush(s));
    return () => {
      alive = false;
    };
  }, []);

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

  useEffect(() => {
    if (!recent) return;
    const t = setTimeout(() => setRecent(null), SETTLE_MS);
    return () => clearTimeout(t);
  }, [recent]);

  const todays = useMemo(() => objectivesForDate(data.objectives, key), [data.objectives, key]);
  const doneCount = todays.filter((o) => isDone(entry, o.id)).length;
  const allDone = todays.length > 0 && doneCount === todays.length;

  const stats = useMemo(() => {
    const total = totalXpOf(data, dayXp);
    return {
      level: levelFromXp(total),
      streak: streakOf(data, tz, dayXp),
      today: xpOnDate(data, key, dayXp),
    };
  }, [data, tz, key]);

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
    setRecent({ id: o.id, done });
    // The full-screen burst is kept for the moment the whole day is complete.
    const willComplete = done && todays.every((x) => x.id === o.id || isDone(entry, x.id));
    if (willComplete) {
      const dayXpTotal = todays.reduce((a, x) => a + x.xp, 0);
      setBurst({ id: Date.now(), amount: dayXpTotal, title: 'Tous tes objectifs du jour sont faits.' });
    }
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

  /** A new tab shows its list as is — no leftover from a validation made on the previous one. */
  function changeFilter(next: Filter) {
    setRecent(null);
    setFilter(next);
  }

  function setDayCheck(enabled: boolean) {
    update((d) => ({
      ...d,
      settings: {
        ...d.settings,
        notifications: {
          ...d.settings.notifications,
          dayCheck: { ...d.settings.notifications.dayCheck, enabled },
        },
      },
    }));
  }

  async function turnOnReminders() {
    setPushBusy(true);
    setPushError(null);
    try {
      const next = await enablePush();
      setPush(next);
      if (next === 'on' && !dayCheck.enabled) setDayCheck(true);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : String(err));
    } finally {
      setPushBusy(false);
    }
  }

  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  }).format(new Date());

  const hour = Math.floor(nowMinutes / 60);
  const pseudo = data.settings.profile.pseudo || data.settings.profile.name;
  const greeting = `${hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour'}${pseudo ? ` ${pseudo}` : ''}`;

  const proving = provingId ? (todays.find((o) => o.id === provingId) ?? null) : null;

  const checklistXp = dayXp(entry);
  const dayRatio = Math.round((stats.today / (MAX_DAY_XP + todays.reduce((a, o) => a + o.xp, 0) || 1)) * 100);
  const unfinished = todays.filter((o) => !isDone(entry, o.id));
  const next = unfinished.find((o) => o.time) ?? unfinished[0];
  const reminderTimes = dayCheck.times.join(' et ');

  const visible = todays.filter((o) => {
    if (filter === 'tous' || o.id === recent?.id) return true;
    return filter === 'faits' ? isDone(entry, o.id) : !isDone(entry, o.id);
  });

  const heroLine = allDone
    ? 'Journée validée. Tout est fait.'
    : todays.length === 0
      ? 'Aucun objectif pour l’instant.'
      : next
        ? `Prochain : ${next.title}${next.time ? ` · ${next.time}` : ''}`
        : '';

  return (
    <div className="dash">
      {burst ? (
        <XpBurst key={burst.id} amount={burst.amount} title={burst.title} label="Journée complète" />
      ) : null}
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
          <h1>{greeting}</h1>
          <p className="sub dash-date">{dateLabel}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-mark" src="/icons/icon-192.png" alt="" width={34} height={34} />
      </header>

      <div className="dash-grid">
        <div className="dash-main">
          <section className="dash-hero" data-complete={allDone}>
            <div className="dash-hero-top">
              <Ring done={doneCount} total={todays.length} />
              <div className="dash-hero-text">
                <div className="dash-eyebrow">Objectifs du jour</div>
                <div className="dash-count mono">
                  {doneCount}
                  <span> / {todays.length}</span>
                </div>
                <div className="dash-hero-line">{heroLine}</div>
              </div>
            </div>

            <div className="dash-kpis">
              <div>
                <b className="mono streak-value">
                  <Flame />
                  {stats.streak}
                </b>
                <span>Jours d&apos;affilée</span>
              </div>
              <div>
                <b className="mono">+{stats.today}</b>
                <span>XP aujourd&apos;hui</span>
              </div>
              <Link href="/progression" className="dash-level-link">
                <b className="mono">Niv. {stats.level.level}</b>
                <span>{stats.level.title}</span>
              </Link>
            </div>
            <Link href="/progression" className="dash-level-row" aria-label="Voir ma progression">
              <div className="bar dash-level-bar" aria-hidden>
                <i style={{ width: `${Math.round(stats.level.progress * 100)}%` }} />
              </div>
              <span className="mono">
                {stats.level.intoLevel} / {stats.level.needed} XP ·{' '}
                {Math.floor(stats.level.progress * 100)} %
              </span>
            </Link>
          </section>

          {status === 'local' && pending ? (
            <div className="banner warn">
              Hors-ligne. Tout est enregistré sur l&apos;appareil et synchronisé au retour du réseau.
            </div>
          ) : null}
          {status === 'ready' && !durable ? (
            <div className="banner warn">Aucune base de données connectée.</div>
          ) : null}

          <section className="section">
            <div className="row dash-head">
              <h2 className="section-title" style={{ margin: 0 }}>
                Objectifs du jour
              </h2>
              <Link href="/quetes" className="link-sm">
                Mes quêtes
              </Link>
            </div>

            {todays.length > 0 ? (
              <div className="segmented dash-filter" role="tablist" aria-label="Filtrer les objectifs">
                <button role="tab" aria-selected={filter === 'tous'} data-on={filter === 'tous'} onClick={() => changeFilter('tous')}>
                  Tous <span className="mono">{todays.length}</span>
                </button>
                <button role="tab" aria-selected={filter === 'afaire'} data-on={filter === 'afaire'} onClick={() => changeFilter('afaire')}>
                  À faire <span className="mono">{unfinished.length}</span>
                </button>
                <button role="tab" aria-selected={filter === 'faits'} data-on={filter === 'faits'} onClick={() => changeFilter('faits')}>
                  Terminés <span className="mono">{doneCount}</span>
                </button>
              </div>
            ) : null}

            {todays.length === 0 ? (
              <div className="card dash-empty">
                <b>Pose ta première brique.</b>
                <span>
                  Fixe ce que tu veux avoir fait ce soir — sport, travail, lecture… Tu les modifies ou les
                  retires quand tu veux.
                </span>
              </div>
            ) : visible.length === 0 ? (
              <div className="card dash-empty">
                <span>
                  {filter === 'faits'
                    ? 'Rien de terminé pour l’instant. Le premier est le plus dur.'
                    : 'Plus rien à faire. Journée validée.'}
                </span>
              </div>
            ) : (
              <div className="dash-list">
                {visible.map((o) => {
                  const on = isDone(entry, o.id);
                  const open = openId === o.id;
                  const t = parseTime(o.time);
                  const late = !on && t !== null && nowMinutes > t;
                  const justDone = recent?.id === o.id && recent.done && on;
                  return (
                    <div key={o.id} className="obj dash-obj" data-done={on} data-just={justDone}>
                      <div className="obj-row">
                        <button
                          className="check"
                          data-on={on}
                          onClick={() => toggleObjective(o)}
                          aria-pressed={on}
                        >
                          <span className="box">{on ? <Check /> : null}</span>
                          <span className="check-main">
                            <span className="check-label">{o.title}</span>
                            <span className="dash-meta">
                              <span className="dash-cat" data-cat={o.category}>
                                {categoryLabel(o.category)}
                              </span>
                              {o.time ? (
                                <span className="dash-time" data-late={late}>
                                  <Clock />
                                  {o.time}
                                  {late ? ' · en retard' : ''}
                                </span>
                              ) : null}
                              {o.requiresProof ? (
                                <span>{on ? 'Photo fournie' : 'Photo requise'}</span>
                              ) : null}
                            </span>
                          </span>
                          <span className="xp-chip">+{o.xp}</span>
                          {justDone ? (
                            <span className="dash-float mono" aria-hidden>
                              +{o.xp} XP
                            </span>
                          ) : null}
                        </button>
                        <button
                          className="obj-more"
                          data-on={open}
                          onClick={() => setOpenId(open ? null : o.id)}
                          aria-label={`Actions pour ${o.title}`}
                          aria-expanded={open}
                        >
                          <span />
                          <span />
                          <span />
                        </button>
                      </div>

                      {open ? (
                        <div className="obj-actions dash-actions">
                          <button onClick={() => { setEditing(o); setOpenId(null); }}>Modifier</button>
                          {o.recurrence === 'once' ? (
                            <button onClick={() => postpone(o)}>Reporter à demain</button>
                          ) : (
                            <button onClick={() => archive(o)}>Archiver</button>
                          )}
                          <button
                            className="dash-danger"
                            onClick={() => {
                              setConfirmDelete(o);
                              setOpenId(null);
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="money-actions">
              <button className="btn btn-accent" onClick={() => setCreating(true)}>
                + Nouvel objectif
              </button>
              <button className="btn btn-ghost" onClick={() => setDrawing(true)}>
                Objectif surprise
              </button>
            </div>

            <div className="dash-remind" data-state={push}>
              <span className="dash-remind-icon">
                <Bell />
              </span>
              <div className="dash-remind-text">
                <b>Rappels du soir</b>
                <span>
                  {push === 'unsupported'
                    ? 'Ce navigateur ne gère pas les notifications.'
                    : push === 'needs-install'
                      ? 'Sur iPhone, ajoute l’app à l’écran d’accueil (Partager → Sur l’écran d’accueil) pour recevoir les rappels.'
                      : push === 'denied'
                        ? 'Notifications bloquées. Autorise-les dans les réglages du navigateur pour cette app.'
                        : push === 'on' && dayCheck.enabled
                          ? unfinished.length > 0
                            ? `À ${reminderTimes} si ${unfinished.length === 1 ? 'cet objectif reste' : `ces ${unfinished.length} objectifs restent`} à faire.`
                            : `À ${reminderTimes}, seulement s’il reste des objectifs.`
                          : `Un rappel à ${reminderTimes} s’il reste des objectifs non terminés.`}
                </span>
                {pushError ? <span className="dash-remind-error">{pushError}</span> : null}
              </div>
              {push === 'off' ? (
                <button className="btn btn-sm btn-accent" onClick={turnOnReminders} disabled={pushBusy}>
                  {pushBusy ? '…' : 'Activer'}
                </button>
              ) : push === 'on' ? (
                <button
                  className="switch"
                  data-on={dayCheck.enabled}
                  onClick={() => setDayCheck(!dayCheck.enabled)}
                  aria-pressed={dayCheck.enabled}
                  aria-label="Rappels du soir"
                >
                  <i />
                </button>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="dash-side">
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
              <Chevron />
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
            <div className="row dash-head">
              <h2 className="section-title" style={{ margin: 0 }}>
                Progression
              </h2>
              <Link href="/progression" className="link-sm">
                Voir le détail
              </Link>
            </div>
            <ProgressPanel />
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
        </aside>
      </div>
    </div>
  );
}
