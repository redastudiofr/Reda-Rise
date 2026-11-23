'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { Check } from '@/components/Check';
import { AddHabitSheet } from '@/components/Forms';
import { Menu } from '@/components/Menu';
import { Toast } from '@/components/Toast';
import { streakOf, useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/hooks';

export default function HabitsPage() {
  const today = useTodayKey();
  const { state, toggleHabit, addHabit, resetDay } = useStore();
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Habitudes</h1>
        <div className="pill-actions">
          <button aria-label="Ajouter une habitude" onClick={() => setAdding(true)}>
            <Icon name="plus" size={24} strokeWidth={2.1} />
          </button>
          <button aria-label="Plus d'options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <Icon name="more" size={22} />
          </button>
        </div>
      </div>

      {today && state.habits.length === 0 && (
        <div className="card empty">
          <span className="empty-icon">
            <Icon name="checklist" size={56} strokeWidth={1.8} />
          </span>
          <h3>Aucune habitude</h3>
          <p>Commence par une petite action chaque jour.</p>
          <button className="btn-wide" onClick={() => setAdding(true)}>
            <Icon name="plus" size={20} /> Ajouter une habitude
          </button>
        </div>
      )}

      {today && (
        <div className="stack stagger">
          {state.habits.map((h) => {
            const done = !!h.done[today];
            return (
              <article key={h.id} className="card habit">
                <div className="habit-top">
                  <span className="row-title" style={{ fontSize: 22 }}>
                    {h.name}
                  </span>
                  <Check
                    on={done}
                    onToggle={() => toggleHabit(h.id, today)}
                    label={`Valider ${h.name}`}
                  />
                </div>
                <div className="habit-count">
                  <span>{done ? 1 : 0}</span>
                  <small> / 1</small>
                </div>
                <div className="habit-foot">
                  <span>L&apos;objectif d&apos;aujourd&apos;hui</span>
                  <span className="streak">
                    <Icon name="flame" size={18} strokeWidth={2} />
                    {streakOf(h, today)}
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: done ? '100%' : '0%' }} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Menu
        open={menu}
        onClose={() => setMenu(false)}
        items={[
          {
            label: "Réinitialiser aujourd'hui",
            icon: <Icon name="close" size={20} />,
            danger: true,
            onSelect: () => {
              if (today) resetDay(today);
              setToast("Journée réinitialisée");
            },
          },
        ]}
      />

      <AddHabitSheet open={adding} onClose={() => setAdding(false)} onSubmit={addHabit} />
      <Toast message={toast} />
    </>
  );
}
