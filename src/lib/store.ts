'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Habit = {
  id: string;
  name: string;
  /** Historique : clé de jour -> true si fait ce jour-là. */
  done: Record<string, true>;
  createdAt: string;
};

export type Task = {
  id: string;
  title: string;
  done: boolean;
  due: string | null; // clé de jour ou null
  createdAt: string;
  completedAt: string | null;
};

export type State = { habits: Habit[]; tasks: Task[] };

const STORAGE_KEY = 'hustly.v2';
const EMPTY: State = { habits: [], tasks: [] };

// Données de départ, pour que l'écran ne soit pas vide au premier lancement.
const SEED: State = {
  habits: [
    { id: 'h1', name: 'Définir des objectifs quotidiens', done: {}, createdAt: '' },
    { id: 'h2', name: 'Créatine', done: {}, createdAt: '' },
  ],
  tasks: [],
};

let cache: State | null = null;
const listeners = new Set<() => void>();

function read(): State {
  if (cache) return cache;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    cache = raw ? (JSON.parse(raw) as State) : SEED;
  } catch {
    cache = SEED;
  }
  return cache!;
}

function write(next: State) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : l'état reste en mémoire */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverSnapshot = EMPTY;

export function useStore() {
  const state = useSyncExternalStore(subscribe, read, () => serverSnapshot);

  const toggleHabit = useCallback((id: string, key: string) => {
    const s = read();
    write({
      ...s,
      habits: s.habits.map((h) => {
        if (h.id !== id) return h;
        const done = { ...h.done };
        if (done[key]) delete done[key];
        else done[key] = true;
        return { ...h, done };
      }),
    });
  }, []);

  const addHabit = useCallback((name: string) => {
    const s = read();
    const habit: Habit = {
      id: crypto.randomUUID(),
      name: name.trim(),
      done: {},
      createdAt: new Date().toISOString(),
    };
    write({ ...s, habits: [...s.habits, habit] });
  }, []);

  const addTask = useCallback((title: string, due: string | null) => {
    const s = read();
    const task: Task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      done: false,
      due,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    write({ ...s, tasks: [...s.tasks, task] });
  }, []);

  const toggleTask = useCallback((id: string) => {
    const s = read();
    write({
      ...s,
      tasks: s.tasks.map((t) =>
        t.id !== id
          ? t
          : { ...t, done: !t.done, completedAt: t.done ? null : new Date().toISOString() },
      ),
    });
  }, []);

  const removeTask = useCallback((id: string) => {
    const s = read();
    write({ ...s, tasks: s.tasks.filter((t) => t.id !== id) });
  }, []);

  const resetDay = useCallback((key: string) => {
    const s = read();
    write({
      ...s,
      habits: s.habits.map((h) => {
        const done = { ...h.done };
        delete done[key];
        return { ...h, done };
      }),
    });
  }, []);

  return { state, toggleHabit, addHabit, addTask, toggleTask, removeTask, resetDay };
}

/** Streak : nombre de jours consécutifs terminés, en remontant depuis `key`. */
export function streakOf(habit: Habit, key: string): number {
  let n = 0;
  const d = new Date(`${key}T12:00:00`);
  for (;;) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!habit.done[k]) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
