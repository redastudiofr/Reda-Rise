'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import EventCard from '@/components/network/EventCard';
import EventSheet, { type EventDraft } from '@/components/network/EventSheet';
import NetNav from '@/components/network/NetNav';
import { api } from '@/lib/network/client';
import { EVENT_TZ } from '@/lib/network/events';
import { CITIES } from '@/lib/network/places';
import type { NetEvent, ProfileDoc } from '@/lib/network/types';
import { todayKey } from '@/lib/logic';

export default function EventsPage() {
  const router = useRouter();
  const [scope, setScope] = useState<'upcoming' | 'mine'>('upcoming');
  const [city, setCity] = useState('');
  const [events, setEvents] = useState<NetEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [myCity, setMyCity] = useState('');
  const today = todayKey(EVENT_TZ);

  const load = useCallback(() => {
    const q = new URLSearchParams({ scope });
    if (city && scope === 'upcoming') q.set('city', city);
    api<{ events: NetEvent[] }>(`/events?${q}`)
      .then((r) => {
        setEvents(r.events);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [scope, city]);

  useEffect(load, [load]);
  useEffect(() => {
    api<{ profile: ProfileDoc | null }>('/profile')
      .then((r) => setMyCity(r.profile?.cityId ?? ''))
      .catch(() => undefined);
  }, []);

  async function create(d: EventDraft) {
    setBusy(true);
    setSheetError(null);
    try {
      const r = await api<{ id: string }>('/events', { method: 'POST', body: { ...d, capacity: d.capacity || undefined } });
      router.push(`/network/evenements/${r.id}`);
    } catch (e) {
      setSheetError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="net">
      {creating ? (
        <EventSheet initial={null} defaultCity={myCity} today={today} busy={busy} error={sheetError} onSave={create} onClose={() => setCreating(false)} />
      ) : null}
      <NetNav title="Événements" sub="Afterworks, petits-déjeuners, ateliers…" action={<button className="btn btn-accent btn-sm" onClick={() => setCreating(true)}>+ Créer</button>} />
      <div className="net-filters">
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={scope === 'upcoming'} data-on={scope === 'upcoming'} onClick={() => setScope('upcoming')}>À venir</button>
          <button role="tab" aria-selected={scope === 'mine'} data-on={scope === 'mine'} onClick={() => setScope('mine')}>Mes événements</button>
        </div>
        {scope === 'upcoming' ? (
          <select className="input" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Ville">
            <option value="">Toutes les villes</option>
            {[...CITIES].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : null}
      </div>
      {error ? <div className="banner warn" role="alert">{error}</div> : null}
      {events === null ? (
        <div className="empty">Chargement…</div>
      ) : events.length === 0 ? (
        <div className="card dash-empty">
          <b>{scope === 'mine' ? 'Aucun événement pour toi.' : 'Aucun événement à venir.'}</b>
          <span>Lance le premier : un afterwork, un petit-déjeuner, un atelier…</span>
          <button className="btn btn-accent" style={{ marginTop: 10 }} onClick={() => setCreating(true)}>Créer un événement</button>
        </div>
      ) : (
        <div className="net-grid">
          {events.map((e) => (
            <EventCard key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}
