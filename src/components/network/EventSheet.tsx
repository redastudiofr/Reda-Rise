'use client';

import { useState } from 'react';
import { CITIES, REGIONS } from '@/lib/network/places';
import type { NetEvent } from '@/lib/network/types';
import { LIMITS, looksLikeAddress } from '@/lib/network/validate';

export type EventDraft = {
  title: string;
  description: string;
  date: string;
  time: string;
  duration: number;
  cityId: string;
  placeHint: string;
  capacity: string;
};

const DURATIONS = [60, 90, 120, 180, 240];

/** Create or edit a Network event. The place stays approximate on purpose. */
export default function EventSheet({
  initial,
  defaultCity,
  today,
  busy,
  error,
  onSave,
  onClose,
}: {
  initial: NetEvent | null;
  defaultCity: string;
  today: string;
  busy: boolean;
  error: string | null;
  onSave: (d: EventDraft) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<EventDraft>(
    initial
      ? {
          title: initial.title,
          description: initial.description,
          date: initial.date,
          time: initial.time,
          duration: initial.duration,
          cityId: initial.cityId,
          placeHint: initial.placeHint,
          capacity: initial.capacity ? String(initial.capacity) : '',
        }
      : { title: '', description: '', date: today, time: '19:00', duration: 120, cityId: defaultCity, placeHint: '', capacity: '' },
  );
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setD({ ...d, [k]: v });
  const addressWarning = [d.title, d.description, d.placeHint].some(looksLikeAddress);
  const ok = d.title.trim().length >= 3 && d.date >= today && /^\d\d:\d\d$/.test(d.time) && d.cityId && !addressWarning;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Événement" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{initial ? 'Modifier l’événement' : 'Nouvel événement'}</div>
        <label className="field">
          <span>Titre</span>
          <input className="input" value={d.title} maxLength={LIMITS.eventTitle} placeholder="Afterwork entrepreneurs — Nantes" autoFocus onChange={(e) => set('title', e.target.value)} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" min={today} value={d.date} onChange={(e) => set('date', e.target.value)} />
          </label>
          <label className="field">
            <span>Heure</span>
            <input className="input" type="time" value={d.time} onChange={(e) => set('time', e.target.value)} />
          </label>
        </div>
        <div className="grid-2">
          <label className="field">
            <span>Durée</span>
            <select className="input" value={d.duration} onChange={(e) => set('duration', Number(e.target.value))}>
              {[...new Set([...DURATIONS, d.duration])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>{m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Places — facultatif</span>
            <input className="input mono" inputMode="numeric" value={d.capacity} placeholder="Illimité" onChange={(e) => set('capacity', e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>
        <label className="field">
          <span>Ville</span>
          <select className="input" value={d.cityId} onChange={(e) => set('cityId', e.target.value)}>
            <option value="">Choisir…</option>
            {REGIONS.map((r) => (
              <optgroup key={r.id} label={r.name}>
                {CITIES.filter((c) => c.region === r.id)
                  .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Lieu approximatif</span>
          <input className="input" value={d.placeHint} maxLength={LIMITS.placeHint} placeholder="Centre-ville, quartier gare…" onChange={(e) => set('placeHint', e.target.value)} />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea className="input" rows={4} value={d.description} maxLength={LIMITS.eventDescription} placeholder="Programme, pour qui, ce qu’il faut apporter…" onChange={(e) => set('description', e.target.value)} />
        </label>
        {addressWarning ? (
          <div className="banner warn" role="alert">Pas d’adresse exacte ni de code postal ici. Tu pourras donner l’adresse aux participants dans la discussion de l’événement.</div>
        ) : (
          <p className="hint">Le lieu reste approximatif pour tout le monde. L’adresse précise se partage dans la discussion réservée aux participants.</p>
        )}
        {error ? <div className="banner warn" role="alert">{error}</div> : null}
        <div className="ag-sheet-actions">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" disabled={!ok || busy} onClick={() => onSave(d)}>
            {busy ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  );
}
