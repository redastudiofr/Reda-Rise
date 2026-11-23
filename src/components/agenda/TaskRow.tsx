'use client';

import { formatShort } from '@/lib/logic';
import { fromMin, priorityOf, toMin } from '@/lib/agenda';
import type { AgendaProject, CalTask } from '@/lib/types';

/** A task in a list: tick, title, priority, date, project. */
export default function TaskRow({
  task,
  project,
  today,
  onToggle,
  onOpen,
}: {
  task: CalTask;
  project?: AgendaProject;
  today: string;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const done = task.status === 'termine';
  const p = priorityOf(task.priority);
  const late = !done && task.date !== undefined && task.date < today;
  const t = toMin(task.time);
  return (
    <div className="ag-task" data-done={done} style={{ ['--c' as string]: p.color }}>
      <button className="ag-row-check" onClick={onToggle} aria-pressed={done} aria-label={done ? `${task.title} : rouvrir` : `${task.title} : terminer`}>
        <span className="ag-tick" data-on={done} aria-hidden>
          {done ? (
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
            </svg>
          ) : null}
        </span>
      </button>
      <button className="ag-task-main" onClick={onOpen}>
        <span className="ag-row-title">{task.title}</span>
        <span className="ag-row-meta">
          <b style={{ color: p.color }}>{p.label}</b>
          {task.status === 'en-cours' ? ' · en cours' : ''}
          {task.date ? (
            <span data-late={late}>
              {' '}
              · {task.date === today ? 'aujourd’hui' : formatShort(task.date)}
              {t !== null ? ` ${fromMin(t)}` : ''}
              {late ? ' · en retard' : ''}
            </span>
          ) : (
            ' · sans date'
          )}
          {project ? ` · ${project.title}` : ''}
        </span>
      </button>
    </div>
  );
}
