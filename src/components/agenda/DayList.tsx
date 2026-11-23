'use client';

import { durationLabel, fromMin, priorityOf, type AgendaItem } from '@/lib/agenda';

function Tick({ on }: { on: boolean }) {
  return (
    <span className="ag-tick" data-on={on} aria-hidden>
      {on ? (
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
        </svg>
      ) : null}
    </span>
  );
}

/** One day as a timeline list: "09:00 — Cours", "11:00 — Objectif : travailler 1 h"… */
export default function DayList({
  items,
  onOpen,
  onToggle,
  empty = 'Rien de prévu. Touche + pour ajouter.',
}: {
  items: AgendaItem[];
  onOpen: (item: AgendaItem) => void;
  onToggle: (item: AgendaItem) => void;
  empty?: string;
}) {
  if (items.length === 0) return <div className="card dash-empty ag-empty">{empty}</div>;
  return (
    <div className="ag-list">
      {items.map((it) => {
        const checkable = it.type !== 'event';
        return (
          <div key={it.key} className="ag-row" data-type={it.type} data-done={it.done} style={{ ['--c' as string]: it.color }}>
            <span className="ag-row-time mono">
              {it.start === null ? 'Jour' : fromMin(it.start)}
              {it.start !== null && it.end !== null && it.type !== 'objective' ? (
                <small>{durationLabel(it.end - it.start)}</small>
              ) : null}
            </span>
            {checkable ? (
              <button
                className="ag-row-check"
                onClick={() => onToggle(it)}
                aria-label={it.done ? `${it.title} : marquer comme à faire` : `${it.title} : marquer comme fait`}
                aria-pressed={Boolean(it.done)}
              >
                <Tick on={Boolean(it.done)} />
              </button>
            ) : (
              <span className="ag-row-bar" aria-hidden />
            )}
            <button className="ag-row-main" onClick={() => (it.type === 'objective' ? onToggle(it) : onOpen(it))}>
              <span className="ag-row-title">
                {it.type === 'objective' ? <em>Objectif : </em> : null}
                {it.title}
              </span>
              <span className="ag-row-meta">
                {it.label}
                {it.priority && it.priority !== 'normale' ? (
                  <b style={{ color: priorityOf(it.priority).color }}> · {priorityOf(it.priority).label}</b>
                ) : null}
                {it.repeat && it.repeat !== 'none' ? ' · répété' : ''}
                {it.task?.status === 'en-cours' ? ' · en cours' : ''}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
