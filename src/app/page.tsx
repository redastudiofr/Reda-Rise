'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Check } from '@/components/Check';
import { Ring } from '@/components/Ring';
import { WeekCalendar } from '@/components/WeekCalendar';
import { AddHabitSheet, AddTaskSheet } from '@/components/Forms';
import { Menu } from '@/components/Menu';
import { useStore } from '@/lib/store';
import { useTodayKey } from '@/lib/hooks';
import { dayKey } from '@/lib/dates';

export default function TodayPage() {
  const today = useTodayKey();
  const { state, toggleHabit, addHabit, addTask, toggleTask } = useStore();
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'habit' | 'task'>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const closeFab = useCallback(() => setFabOpen(false), []);

  if (!today) return <div className="today-head" style={{ minHeight: 150 }} />;

  const selected = picked ?? today;
  const total = state.habits.length;
  const doneOn = (key: string) => state.habits.filter((h) => h.done[key]).length;
  const progressOf = (key: string) => (total ? doneOn(key) / total : 0);
  const selDone = doneOn(selected);
  const tasksDoneToday = state.tasks.filter(
    (t) => t.done && t.completedAt && dayKey(new Date(t.completedAt)) === today,
  ).length;

  return (
    <>
      <header className="today-head">
        <div className="head-row" style={{ gridTemplateColumns: '1fr 54px', gap: 6 }}>
          <WeekCalendar
            selected={selected}
            today={today}
            onSelect={setPicked}
            progressOf={progressOf}
          />
          <Ring value={total ? selDone / total : 0} size={54} stroke={3.5}>
            <span key={selDone} className="bump-once">
              {selDone}
            </span>
          </Ring>
        </div>
      </header>

      <div className="section-head">
        <h2 className="section-title">Habitudes</h2>
        <Link href="/habitudes" className="link-more">
          Tout afficher <Icon name="chevron" size={18} strokeWidth={2.4} />
        </Link>
      </div>

      <div className="stack stagger">
        {state.habits.length === 0 && (
          <button className="card btn-wide" style={{ height: 74 }} onClick={() => setSheet('habit')}>
            <Icon name="plus" size={20} /> Ajouter une habitude
          </button>
        )}
        {state.habits.map((h) => {
          const on = !!h.done[selected];
          return (
            <div
              key={h.id}
              className="card row"
              role="button"
              tabIndex={0}
              onClick={() => toggleHabit(h.id, selected)}
              onKeyDown={(e) => e.key === 'Enter' && toggleHabit(h.id, selected)}
            >
              <span className="row-title">{h.name}</span>
              <Check on={on} onToggle={() => toggleHabit(h.id, selected)} label={`Valider ${h.name}`} />
            </div>
          );
        })}
      </div>

      <div className="section-head">
        <h2 className="section-title">Tâches</h2>
        <Link href="/taches" className="link-more">
          Tout afficher <Icon name="chevron" size={18} strokeWidth={2.4} />
        </Link>
      </div>

      <div className="stack stagger">
        <button className="card row" onClick={() => setSheet('task')}>
          <span className="tile">
            <Icon name="note" size={24} />
          </span>
          <span className="row-title">Créer une tâche</span>
          <Icon name="plus" size={26} strokeWidth={1.8} />
        </button>

        <Link href="/taches" className="card row">
          <span className="tile">
            <Icon name="target" size={24} />
          </span>
          <span className="row-title">
            Terminé aujourd&apos;hui
            <span className="row-sub" style={{ display: 'block' }}>
              {tasksDoneToday === 0
                ? "Aucune tâche pour l'instant"
                : `${tasksDoneToday} tâche${tasksDoneToday > 1 ? 's' : ''} terminée${tasksDoneToday > 1 ? 's' : ''}`}
            </span>
          </span>
          <Icon name="chevron" size={22} strokeWidth={2.2} />
        </Link>
      </div>

      <button
        className={`fab ${fabOpen ? 'is-open' : ''}`}
        aria-label="Ajouter"
        aria-expanded={fabOpen}
        onClick={() => setFabOpen((o) => !o)}
      >
        <Icon name="plus" size={30} strokeWidth={1.8} />
      </button>

      <Menu
        open={fabOpen}
        onClose={closeFab}
        right={22}
        items={[
          { label: 'Nouvelle habitude', icon: <Icon name="checklist" size={20} />, onSelect: () => setSheet('habit') },
          { label: 'Nouvelle tâche', icon: <Icon name="note" size={20} />, onSelect: () => setSheet('task') },
        ]}
      />

      <AddHabitSheet open={sheet === 'habit'} onClose={() => setSheet(null)} onSubmit={addHabit} />
      <AddTaskSheet
        open={sheet === 'task'}
        onClose={() => setSheet(null)}
        onSubmit={addTask}
        todayKey={today}
      />
    </>
  );
}
