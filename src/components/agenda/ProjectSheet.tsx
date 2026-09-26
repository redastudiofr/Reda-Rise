'use client';

import { useState } from 'react';
import TaskRow from './TaskRow';
import { PROJECT_COLORS, newTask, projectTasks } from '@/lib/agenda';
import { uid } from '@/lib/logic';
import type { AgendaProject, AppData, CalTask } from '@/lib/types';

/** A project and its tasks: rename, add tasks in one line each, tick them off. */
export default function ProjectSheet({
  data,
  project,
  today,
  onSaveProject,
  onDeleteProject,
  onAddTask,
  onToggleTask,
  onOpenTask,
  onClose,
}: {
  data: AppData;
  project: AgendaProject | null;
  today: string;
  onSaveProject: (p: AgendaProject) => void;
  onDeleteProject: (p: AgendaProject, withTasks: boolean) => void;
  onAddTask: (t: CalTask) => void;
  onToggleTask: (t: CalTask) => void;
  onOpenTask: (t: CalTask) => void;
  onClose: () => void;
}) {
  const creating = project === null;
  const [draft, setDraft] = useState<AgendaProject>(
    project ?? { id: uid(), title: '', color: PROJECT_COLORS[data.agenda.projects.length % PROJECT_COLORS.length], createdAt: today },
  );
  const [newTitle, setNewTitle] = useState('');
  const [confirm, setConfirm] = useState(false);
  const tasks = creating ? [] : projectTasks(data, draft.id);
  const done = tasks.filter((t) => t.status === 'termine').length;
  const ratio = tasks.length ? done / tasks.length : 0;

  function save(next: AgendaProject) {
    setDraft(next);
    if (!creating && next.title.trim()) onSaveProject({ ...next, title: next.title.trim() });
  }

  function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    onAddTask(newTask({ id: uid(), createdAt: today, title, projectId: draft.id }));
    setNewTitle('');
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet ag-sheet" role="dialog" aria-label="Projet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <input
          className="input ag-title"
          placeholder="Nom du projet — ex. Lancement Reda Studio"
          value={draft.title}
          autoFocus={creating}
          onChange={(e) => save({ ...draft, title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && creating && draft.title.trim()) onSaveProject({ ...draft, title: draft.title.trim() });
          }}
          aria-label="Nom du projet"
        />
        <div className="ag-colors">
          {PROJECT_COLORS.map((c) => (
            <button key={c} className="ag-color" data-on={draft.color === c} style={{ background: c }} onClick={() => save({ ...draft, color: c })} aria-label={`Couleur ${c}`} />
          ))}
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Échéance — facultatif</span>
            <input className="input" type="date" value={draft.deadline ?? ''} onChange={(e) => save({ ...draft, deadline: e.target.value || undefined })} />
          </label>
          <label className="field">
            <span>Description</span>
            <input className="input" value={draft.description ?? ''} onChange={(e) => save({ ...draft, description: e.target.value || undefined })} />
          </label>
        </div>

        {creating ? (
          <div className="ag-sheet-actions">
            <button className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-accent" disabled={!draft.title.trim()} onClick={() => onSaveProject({ ...draft, title: draft.title.trim() })}>
              Créer le projet
            </button>
          </div>
        ) : (
          <>
            <div className="ag-proj-progress" style={{ ['--pc' as string]: draft.color }}>
              <div className="row">
                <b>Progression</b>
                <span className="mono">
                  {done} / {tasks.length} · {Math.round(ratio * 100)} %
                </span>
              </div>
              <div className="bar">
                <i style={{ width: `${ratio * 100}%` }} />
              </div>
            </div>

            <div className="ag-quickadd">
              <input
                className="input"
                placeholder="Ajouter une tâche puis Entrée"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTask();
                  }
                }}
                aria-label="Nouvelle tâche du projet"
              />
              <button className="btn btn-accent btn-sm" onClick={addTask} disabled={!newTitle.trim()}>
                Ajouter
              </button>
            </div>

            <div className="ag-tasklist">
              {tasks.length === 0 ? (
                <div className="hint">Découpe le projet en étapes : photos, produits, publicités…</div>
              ) : (
                tasks.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} onToggle={() => onToggleTask(t)} onOpen={() => onOpenTask(t)} />
                ))
              )}
            </div>

            {confirm ? (
              <div className="ag-delete">
                <span>Supprimer « {draft.title} » ?</span>
                <div className="ag-delete-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>
                    Annuler
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDeleteProject(draft, false)}>
                    Garder les tâches
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDeleteProject(draft, true)}>
                    Avec ses {tasks.length} tâches
                  </button>
                </div>
              </div>
            ) : null}

            <div className="ag-sheet-actions">
              {!confirm ? (
                <button className="btn btn-ghost ag-del-btn" onClick={() => setConfirm(true)}>
                  Supprimer
                </button>
              ) : null}
              <button className="btn btn-ghost" onClick={() => save({ ...draft, archived: !draft.archived })}>
                {draft.archived ? 'Désarchiver' : 'Archiver'}
              </button>
              <button className="btn btn-accent" onClick={onClose}>
                Fermer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
