'use client';

import { useEffect, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { addDays, dayKey } from '@/lib/dates';

export function AddHabitSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      const t = window.setTimeout(() => ref.current?.focus(), 350);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  function submit() {
    if (!name.trim()) return;
    onSubmit(name);
    onClose();
  }

  return (
    <Sheet open={open} title="Nouvelle habitude" onClose={onClose}>
      <input
        ref={ref}
        className="field"
        placeholder="Ex. Lire 10 pages"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        maxLength={60}
        aria-label="Nom de l'habitude"
      />
      <div className="sheet-actions">
        <button className="btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn-primary" disabled={!name.trim()} onClick={submit}>
          Ajouter
        </button>
      </div>
    </Sheet>
  );
}

const DUE_CHOICES: { label: string; offset: number | null }[] = [
  { label: 'Plus tard', offset: null },
  { label: "Aujourd'hui", offset: 0 },
  { label: 'Demain', offset: 1 },
];

export function AddTaskSheet({
  open,
  onClose,
  onSubmit,
  todayKey,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string, due: string | null) => void;
  todayKey: string;
}) {
  const [title, setTitle] = useState('');
  const [choice, setChoice] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setChoice(0);
      const t = window.setTimeout(() => ref.current?.focus(), 350);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  function submit() {
    if (!title.trim()) return;
    const offset = DUE_CHOICES[choice].offset;
    const due = offset === null ? null : dayKey(addDays(new Date(`${todayKey}T12:00:00`), offset));
    onSubmit(title, due);
    onClose();
  }

  return (
    <Sheet open={open} title="Nouvelle tâche" onClose={onClose}>
      <input
        ref={ref}
        className="field"
        placeholder="Ex. Envoyer la facture"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        maxLength={80}
        aria-label="Titre de la tâche"
      />
      <div className="chip-row" style={{ marginTop: 12 }} role="radiogroup" aria-label="Échéance">
        {DUE_CHOICES.map((c, i) => (
          <button
            key={c.label}
            role="radio"
            aria-checked={i === choice}
            className={`chip ${i === choice ? 'is-on' : ''}`}
            onClick={() => setChoice(i)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        <button className="btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn-primary" disabled={!title.trim()} onClick={submit}>
          Ajouter
        </button>
      </div>
    </Sheet>
  );
}
