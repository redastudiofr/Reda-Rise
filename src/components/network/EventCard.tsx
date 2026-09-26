'use client';

import Link from 'next/link';
import type { NetEvent } from '@/lib/network/types';
import { isOver } from '@/lib/network/events';

export function eventWhen(e: { date: string; time: string }): string {
  const d = new Date(`${e.date}T12:00:00Z`);
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${day} · ${e.time.replace(':', 'h')}`;
}

export default function EventCard({ e }: { e: NetEvent }) {
  const d = new Date(`${e.date}T12:00:00Z`);
  const over = isOver(e);
  return (
    <Link href={`/network/evenements/${e.id}`} className="card net-event" data-off={e.cancelled || over}>
      <span className="net-event-date" aria-hidden>
        <b>{d.getUTCDate()}</b>
        <small>{d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', '')}</small>
      </span>
      <span className="net-event-body">
        <b>{e.title}</b>
        <small>{eventWhen(e)} · {e.city}{e.placeHint ? ` — ${e.placeHint}` : ''}</small>
        <small>
          {e.cancelled ? <span className="net-flag">Annulé</span> : over ? <span className="net-flag">Terminé</span> : null}
          {e.mine ? <span className="net-flag net-flag-on">Organisateur</span> : e.joined ? <span className="net-flag net-flag-on">Inscrit</span> : null}
          {e.participants} participant{e.participants > 1 ? 's' : ''}
          {e.capacity ? ` / ${e.capacity}` : ''}
          {e.organizer ? ` · par ${e.organizer.pseudo}` : ''}
        </small>
      </span>
    </Link>
  );
}
