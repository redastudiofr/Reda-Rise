'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import {
  dayXp,
  formatDate,
  planForDate,
  shiftKey,
  todayKey,
  weekdayOf,
  workoutOn,
} from '@/lib/logic';
import { isDone, objectivesForDate, xpOnDate } from '@/lib/xp';
import type { DailyEntry, Objective } from '@/lib/types';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Six weeks starting on the Monday on or before the first of the month. */
function monthGrid(anchor: string): string[] {
  const first = `${anchor.slice(0, 7)}-01`;
  const wd = weekdayOf(first);
  const start = shiftKey(first, wd === 0 ? -6 : 1 - wd);
  return Array.from({ length: 42 }, (_, i) => shiftKey(start, i));
}

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'left' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  );
}

export default function CalendarPage() {
  const { data, update } = useData();
  const tz = data.settings.timezone;
  const today = todayKey(tz);

  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);

  const cells = useMemo(() => monthGrid(anchor), [anchor]);
  const month = anchor.slice(0, 7);

  const monthLabel = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00Z`));

  const plan = planForDate(selected);
  const logged = workoutOn(data.workouts, selected);
  const objectives = objectivesForDate(data.objectives, selected);
  const entry = data.daily[selected];
  const xp = xpOnDate(data, selected, dayXp);

  function shiftMonth(delta: number) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setAnchor(d.toISOString().slice(0, 10));
  }

  function toggleObjective(o: Objective) {
    update((d) => {
      const e: DailyEntry = d.daily[selected] ?? { tasks: {} };
      const list = e.objectives ?? [];
      return {
        ...d,
        daily: {
          ...d.daily,
          [selected]: {
            ...e,
            objectives: list.includes(o.id) ? list.filter((x) => x !== o.id) : [...list, o.id],
          },
        },
      };
    });
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Calendrier</h1>
          <p className="sub" style={{ textTransform: 'capitalize' }}>
            {monthLabel}
          </p>
        </div>
        <div className="week-nav">
          <button onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
            <Arrow dir="left" />
          </button>
          <button className="week-today" onClick={() => { setAnchor(today); setSelected(today); }}>
            Auj.
          </button>
          <button onClick={() => shiftMonth(1)} aria-label="Mois suivant">
            <Arrow dir="right" />
          </button>
        </div>
      </header>

      <div className="cal">
        <div className="cal-head">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((date) => {
            const inMonth = date.slice(0, 7) === month;
            const dayPlan = planForDate(date);
            const hasWorkout = Boolean(workoutOn(data.workouts, date));
            const objs = objectivesForDate(data.objectives, date);
            const objsDone = objs.filter((o) => isDone(data.daily[date], o.id)).length;
            const gotXp = xpOnDate(data, date, dayXp) > 0;
            return (
              <button
                key={date}
                className="cal-cell"
                data-out={!inMonth}
                data-today={date === today}
                data-selected={date === selected}
                onClick={() => setSelected(date)}
              >
                <span className="cal-num mono">{Number(date.slice(8))}</span>
                <span className="cal-marks">
                  {hasWorkout ? <i className="m-workout" /> : null}
                  {objs.length > 0 ? (
                    <i className={objsDone === objs.length ? 'm-obj-full' : 'm-obj'} />
                  ) : null}
                  {gotXp && !hasWorkout && objs.length === 0 ? <i className="m-xp" /> : null}
                </span>
                {!dayPlan.rest && inMonth ? <span className="cal-bar" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <section className="section">
        <h2 className="section-title">{formatDate(selected)}</h2>

        <div className="card">
          <div className="row">
            <div>
              <div className="ex-name">{plan.title}</div>
              <div className="ex-meta">
                {plan.rest ? plan.focus : `${plan.exercises.length} exercices`}
                {logged ? ' · séance enregistrée' : ''}
              </div>
            </div>
            <div className="rec-val">
              <b className="mono">+{xp}</b>
              <div className="ex-meta">XP</div>
            </div>
          </div>
        </div>

        {objectives.length > 0 ? (
          <div style={{ marginTop: 10 }}>
            {objectives.map((o) => {
              const on = isDone(entry, o.id);
              return (
                <button key={o.id} className="check" data-on={on} onClick={() => toggleObjective(o)}>
                  <span className="box">{on ? <Check /> : null}</span>
                  <span className="check-main">
                    <span className="check-label">{o.title}</span>
                    <span className="check-hint">{o.time ?? ''}</span>
                  </span>
                  <span className="xp-chip">+{o.xp}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="card empty" style={{ marginTop: 10 }}>
            Aucun objectif ce jour-là.
          </div>
        )}
      </section>

      <section className="section">
        <div className="legend">
          <span>
            <i className="m-workout" /> Séance
          </span>
          <span>
            <i className="m-obj" /> Objectifs
          </span>
          <span>
            <i className="m-obj-full" /> Tous validés
          </span>
        </div>
      </section>
    </>
  );
}
