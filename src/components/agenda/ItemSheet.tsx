'use client';

import { useState } from 'react';
import ReminderPicker from './ReminderPicker';
import {
  EVENT_KINDS,
  PRIORITIES,
  REPEATS,
  STATUSES,
  durationLabel,
  kindOf,
  newEvent,
  newTask,
} from '@/lib/agenda';
import { CATEGORIES } from '@/lib/xp';
import { uid } from '@/lib/logic';
import type {
  AgendaProject,
  CalEvent,
  CalTask,
  Category,
  EventKind,
  Repeat,
  TaskPriority,
  TaskStatus,
} from '@/lib/types';

export type SheetTarget =
  | { mode: 'create'; type: 'event' | 'task'; date?: string; time?: string; projectId?: string }
  | { mode: 'edit'; type: 'event'; event: CalEvent; occurrence: string }
  | { mode: 'edit'; type: 'task'; task: CalTask };

export type SheetResult = { type: 'event'; event: CalEvent } | { type: 'task'; task: CalTask };

const DURATIONS = [15, 30, 45, 60, 90, 120];

/** Create or edit an event or a task. Enter in the title saves. */
export default function ItemSheet({
  target,
  today,
  projects,
  onSave,
  onDelete,
  onClose,
}: {
  target: SheetTarget;
  today: string;
  projects: AgendaProject[];
  onSave: (result: SheetResult) => void;
  onDelete: (scope: 'occurrence' | 'all') => void;
  onClose: () => void;
}) {
  const editing = target.mode === 'edit';
  const [type, setType] = useState<'event' | 'task'>(target.type);

  const baseEvent =
    target.mode === 'edit' && target.type === 'event'
      ? target.event
      : newEvent({
          id: uid(),
          createdAt: today,
          date: (target.mode === 'create' && target.date) || today,
          time: target.mode === 'create' ? target.time : undefined,
        });
  const baseTask =
    target.mode === 'edit' && target.type === 'task'
      ? target.task
      : newTask({
          id: uid(),
          createdAt: today,
          date: target.mode === 'create' ? (target.projectId && !target.date ? undefined : (target.date ?? today)) : today,
          time: target.mode === 'create' ? target.time : undefined,
          projectId: target.mode === 'create' ? target.projectId : undefined,
        });

  const [title, setTitle] = useState(type === 'event' ? baseEvent.title : baseTask.title);
  // Event fields
  const [kind, setKind] = useState<EventKind>(baseEvent.kind);
  const [date, setDate] = useState(type === 'event' ? baseEvent.date : (baseTask.date ?? ''));
  const [allDay, setAllDay] = useState(type === 'event' ? !baseEvent.time : !baseTask.time);
  const [time, setTime] = useState((type === 'event' ? baseEvent.time : baseTask.time) ?? '09:00');
  const [duration, setDuration] = useState(
    type === 'event' ? baseEvent.duration || 60 : (baseTask.duration ?? 30),
  );
  const [repeat, setRepeat] = useState<Repeat>(baseEvent.repeat);
  const [until, setUntil] = useState(baseEvent.until ?? '');
  const [description, setDescription] = useState(baseEvent.description ?? '');
  const [eventReminders, setEventReminders] = useState<number[]>(baseEvent.reminders);
  // Task fields
  const [priority, setPriority] = useState<TaskPriority>(baseTask.priority);
  const [status, setStatus] = useState<TaskStatus>(baseTask.status);
  const [category, setCategory] = useState<Category>(baseTask.category);
  const [projectId, setProjectId] = useState(baseTask.projectId ?? '');
  const [notes, setNotes] = useState(baseTask.notes ?? '');
  const [taskReminders, setTaskReminders] = useState<number[]>(baseTask.reminders);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function pickKind(k: EventKind) {
    setKind(k);
    if (editing) return;
    const def = kindOf(k);
    setRepeat(def.repeat);
    setAllDay(Boolean(def.allDay));
    if (def.duration) setDuration(def.duration);
    setEventReminders([def.allDay ? 1440 : 15]);
  }

  const canSave = title.trim() !== '' && (type === 'task' || date !== '');

  function submit() {
    if (!canSave) return;
    if (type === 'event') {
      onSave({
        type: 'event',
        event: {
          ...baseEvent,
          kind,
          title: title.trim(),
          date,
          time: allDay ? undefined : time,
          duration: allDay ? 0 : duration,
          repeat,
          until: repeat !== 'none' && until ? until : undefined,
          description: description.trim() || undefined,
          reminders: eventReminders,
        },
      });
    } else {
      const done = status === 'termine';
      onSave({
        type: 'task',
        task: {
          ...baseTask,
          title: title.trim(),
          date: date || undefined,
          time: date && !allDay ? time : undefined,
          duration: date && !allDay ? duration : undefined,
          priority,
          status,
          category,
          projectId: projectId || undefined,
          notes: notes.trim() || undefined,
          reminders: date ? taskReminders : [],
          doneAt: done ? (baseTask.doneAt ?? today) : undefined,
        },
      });
    }
  }

  const recurring = target.mode === 'edit' && target.type === 'event' && target.event.repeat !== 'none';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet ag-sheet"
        role="dialog"
        aria-label={editing ? 'Modifier' : 'Créer'}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="sheet-grip" />
        {editing ? (
          <div className="sheet-title">{type === 'event' ? 'Modifier l’événement' : 'Modifier la tâche'}</div>
        ) : (
          <div className="segmented ag-type" role="tablist">
            <button role="tab" aria-selected={type === 'event'} data-on={type === 'event'} onClick={() => setType('event')}>
              Événement
            </button>
            <button role="tab" aria-selected={type === 'task'} data-on={type === 'task'} onClick={() => setType('task')}>
              Tâche
            </button>
          </div>
        )}

        <input
          className="input ag-title"
          placeholder={type === 'event' ? 'Ex. Rendez-vous banque' : 'Ex. Préparer les photos produits'}
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          aria-label="Titre"
        />

        {type === 'event' ? (
          <div className="chip-grid ag-kinds">
            {EVENT_KINDS.map((k) => (
              <button
                key={k.id}
                className="chip ag-kind"
                data-on={kind === k.id}
                style={{ ['--k' as string]: k.color }}
                onClick={() => pickKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid-2">
          <label className="field">
            <span>{type === 'task' ? 'Date — facultatif' : 'Date'}</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="field">
            <span>Heure</span>
            {allDay ? (
              <button className="input ag-allday" onClick={() => setAllDay(false)} disabled={type === 'task' && !date}>
                {type === 'task' ? 'Sans heure' : 'Journée entière'}
              </button>
            ) : (
              <div className="time-row">
                <input className="input" type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} />
                <button className="btn btn-ghost btn-sm" onClick={() => setAllDay(true)} aria-label="Sans heure">
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {!allDay && (type === 'event' || date) ? (
          <div className="field">
            <span>Durée · {durationLabel(duration)}</span>
            <div className="chip-grid">
              {DURATIONS.map((m) => (
                <button key={m} className="chip" data-on={duration === m} onClick={() => setDuration(m)}>
                  {durationLabel(m)}
                </button>
              ))}
              <input
                className="input ag-dur"
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Math.max(5, Math.min(1440, Number(e.target.value) || 5)))}
                aria-label="Durée en minutes"
              />
            </div>
          </div>
        ) : null}

        {type === 'event' ? (
          <>
            <div className="grid-2">
              <label className="field">
                <span>Répétition</span>
                <select className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
                  {REPEATS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              {repeat !== 'none' ? (
                <label className="field">
                  <span>Jusqu’au — facultatif</span>
                  <input className="input" type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} />
                </label>
              ) : null}
            </div>
            <ReminderPicker value={eventReminders} onChange={setEventReminders} />
            <label className="field">
              <span>Description</span>
              <textarea className="input ag-text" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <div className="field">
              <span>Priorité</span>
              <div className="segmented ag-prio">
                {PRIORITIES.map((p) => (
                  <button key={p.id} data-on={priority === p.id} style={{ ['--p' as string]: p.color }} onClick={() => setPriority(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>Statut</span>
              <div className="segmented">
                {STATUSES.map((s) => (
                  <button key={s.id} data-on={status === s.id} onClick={() => setStatus(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid-2">
              <label className="field">
                <span>Catégorie</span>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Projet</span>
                <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Aucun</option>
                  {projects
                    .filter((p) => !p.archived || p.id === projectId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {date ? <ReminderPicker value={taskReminders} onChange={setTaskReminders} /> : null}
            <label className="field">
              <span>Notes</span>
              <textarea className="input ag-text" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </>
        )}

        {confirmDelete ? (
          <div className="ag-delete">
            <span>{recurring ? 'Supprimer quelles dates ?' : 'Supprimer définitivement ?'}</span>
            <div className="ag-delete-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
                Annuler
              </button>
              {recurring ? (
                <button className="btn btn-danger btn-sm" onClick={() => onDelete('occurrence')}>
                  Ce jour seulement
                </button>
              ) : null}
              <button className="btn btn-danger btn-sm" onClick={() => onDelete('all')}>
                {recurring ? 'Toute la série' : 'Supprimer'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="ag-sheet-actions">
          {editing && !confirmDelete ? (
            <button className="btn btn-ghost ag-del-btn" onClick={() => setConfirmDelete(true)}>
              Supprimer
            </button>
          ) : null}
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-accent" onClick={submit} disabled={!canSave}>
            {editing ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
