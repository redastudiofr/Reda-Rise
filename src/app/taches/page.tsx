'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { Check } from '@/components/Check';
import { AddTaskSheet } from '@/components/Forms';
import { Menu } from '@/components/Menu';
import { Toast } from '@/components/Toast';
import { useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/hooks';
import { parseKey } from '@/lib/dates';

function dueLabel(due: string | null, today: string): string {
  if (!due) return 'Sans échéance';
  if (due === today) return "Pour aujourd'hui";
  if (due < today) return 'En retard';
  return parseKey(due).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function TasksPage() {
  const today = useTodayKey();
  const { state, addTask, toggleTask, removeTask } = useStore();
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const open = state.tasks.filter((t) => !t.done);
  const done = state.tasks.filter((t) => t.done);
  const late = today ? open.filter((t) => t.due && t.due < today).length : 0;

  const sorted = [...open, ...done];

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Tâches</h1>
        <div className="pill-actions">
          <button aria-label="Ajouter une tâche" onClick={() => setAdding(true)}>
            <Icon name="plus" size={24} strokeWidth={2.1} />
          </button>
          <button aria-label="Plus d'options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <Icon name="more" size={22} />
          </button>
        </div>
      </div>

      <div className="card stats3" style={{ marginBottom: 14 }}>
        <div>
          <b>{open.length}</b>
          <span>Ouverte</span>
        </div>
        <div>
          <b>{done.length}</b>
          <span>Terminée</span>
        </div>
        <div>
          <b>{late}</b>
          <span>En retard</span>
        </div>
      </div>

      {state.tasks.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="checklist" size={60} strokeWidth={1.8} />
          </span>
          <h3>Aucune tâche pour l&apos;instant</h3>
          <p>Il y a de la place ici pour ce qui va suivre.</p>
          <button className="btn-wide" onClick={() => setAdding(true)}>
            <Icon name="plus" size={20} /> Ajouter une tâche
          </button>
        </div>
      ) : (
        <div className="card settings stagger">
          {sorted.map((t) => (
            <div
              key={t.id}
              className="row"
              role="button"
              tabIndex={0}
              onClick={() => toggleTask(t.id)}
              onKeyDown={(e) => e.key === 'Enter' && toggleTask(t.id)}
              style={{ position: 'relative' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="row-title"
                  style={{ opacity: t.done ? 0.45 : 1, textDecoration: t.done ? 'line-through' : 'none' }}
                >
                  {t.title}
                </div>
                <div className="row-sub">{t.done ? 'Terminée' : today ? dueLabel(t.due, today) : ''}</div>
              </div>
              <Check on={t.done} onToggle={() => toggleTask(t.id)} label={`Terminer ${t.title}`} />
            </div>
          ))}
        </div>
      )}

      <Menu
        open={menu}
        onClose={() => setMenu(false)}
        items={[
          {
            label: 'Supprimer les tâches terminées',
            icon: <Icon name="close" size={20} />,
            danger: true,
            onSelect: () => {
              if (done.length === 0) return setToast('Aucune tâche terminée');
              done.forEach((t) => removeTask(t.id));
              setToast('Tâches terminées supprimées');
            },
          },
        ]}
      />

      {today && (
        <AddTaskSheet open={adding} onClose={() => setAdding(false)} onSubmit={addTask} todayKey={today} />
      )}
      <Toast message={toast} />
    </>
  );
}
