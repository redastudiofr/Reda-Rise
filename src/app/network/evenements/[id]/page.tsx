'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import AddToAgenda from '@/components/network/AddToAgenda';
import { eventWhen } from '@/components/network/EventCard';
import EventSheet, { type EventDraft } from '@/components/network/EventSheet';
import { useNet } from '@/components/network/NetContext';
import NetNav from '@/components/network/NetNav';
import ReportButton from '@/components/network/ReportButton';
import { api } from '@/lib/network/client';
import { EVENT_TZ, isOver } from '@/lib/network/events';
import type { NetEvent } from '@/lib/network/types';
import { todayKey } from '@/lib/logic';

type Person = { id: string; pseudo: string; photo: string | null };
type Resp = { event: NetEvent; participants: Person[]; hiddenParticipants: number };

function durationText(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
}

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { owner, member } = useNet();
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(() => {
    api<Resp>(`/events/${encodeURIComponent(id)}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function act(path: string, method: string, body?: unknown) {
    setBusy(true);
    setActionError(null);
    try {
      await api(path, { method, body });
      load();
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(d: EventDraft) {
    if (await act(`/events/${id}`, 'PUT', { ...d, capacity: d.capacity || undefined })) setEditing(false);
  }

  const e = data?.event;
  const over = e ? isOver(e) : false;
  const full = e?.capacity !== undefined && e.participants >= e.capacity;

  return (
    <div className="net">
      {editing && e ? (
        <EventSheet initial={e} defaultCity={e.cityId} today={todayKey(EVENT_TZ)} busy={busy} error={actionError} onSave={saveEdit} onClose={() => setEditing(false)} />
      ) : null}
      <NetNav title="Événement" action={<Link href="/network/evenements" className="link-sm">← Événements</Link>} />
      {error ? <div className="card dash-empty"><b>{error}</b></div> : null}
      {e ? (
        <div className="net-event-page">
          <div className="card net-event-main">
            {e.cancelled ? <div className="banner warn">Cet événement a été annulé par l’organisateur.</div> : over ? <div className="banner">Cet événement est terminé.</div> : null}
            <h2>{e.title}</h2>
            <dl className="net-event-facts">
              <div>
                <dt>Quand</dt>
                <dd>{eventWhen(e)} · {durationText(e.duration)}</dd>
              </div>
              <div>
                <dt>Où</dt>
                <dd>{e.city}{e.placeHint ? ` — ${e.placeHint}` : ''} <small>(lieu approximatif)</small></dd>
              </div>
              <div>
                <dt>Organisateur</dt>
                <dd>
                  {e.organizer ? (
                    <Link href={`/network/membre/${e.organizer.id}`} className="net-inline-person">
                      <Avatar src={e.organizer.photo ?? undefined} name={e.organizer.pseudo} size={22} /> {e.organizer.pseudo}
                    </Link>
                  ) : (
                    'Compte supprimé'
                  )}
                </dd>
              </div>
              <div>
                <dt>Participants</dt>
                <dd>{e.participants}{e.capacity ? ` / ${e.capacity} places` : ''}</dd>
              </div>
            </dl>
            {e.description ? <p className="net-bio">{e.description}</p> : null}

            <div className="net-event-actions">
              {e.mine ? (
                <>
                  {!e.cancelled && !over ? <button className="btn btn-ghost" onClick={() => setEditing(true)}>Modifier</button> : null}
                  {!e.cancelled && !over ? (
                    confirmCancel ? (
                      <button className="btn btn-ghost ag-del-btn" disabled={busy} onClick={() => act(`/events/${id}`, 'DELETE').then(() => setConfirmCancel(false))}>Confirmer l’annulation</button>
                    ) : (
                      <button className="btn btn-ghost ag-del-btn" onClick={() => setConfirmCancel(true)}>Annuler l’événement</button>
                    )
                  ) : null}
                </>
              ) : e.joined ? (
                <button className="btn btn-ghost" disabled={busy} onClick={() => act(`/events/${id}/join`, 'DELETE')}>Ne plus participer</button>
              ) : !e.cancelled && !over ? (
                <button className="btn btn-accent" disabled={busy || full} onClick={() => act(`/events/${id}/join`, 'POST')}>{full ? 'Complet' : 'Participer'}</button>
              ) : null}
              {e.joined || e.mine ? (
                <Link className="btn btn-ghost" href={`/network/messages/ev_${id}`}>
                  Discussion du groupe
                </Link>
              ) : null}
              {owner && !e.cancelled ? <AddToAgenda e={e} /> : null}
              {!e.cancelled ? (
                <a className="btn btn-ghost" href={`/api/network/events/${id}/ics`} download>
                  Fichier calendrier (.ics)
                </a>
              ) : null}
            </div>
            {actionError && !editing ? <div className="banner warn" role="alert">{actionError}</div> : null}
            {!e.mine && e.organizer && member ? <ReportButton kind="evenement" targetId={id} label="Signaler l’événement" /> : null}
          </div>

          <section className="card net-people">
            <h3>Participants</h3>
            {data.participants.length === 0 ? (
              <p className="sub">Personne pour l’instant.</p>
            ) : (
              <ul>
                {data.participants.map((p) => (
                  <li key={p.id}>
                    <Link href={`/network/membre/${p.id}`}>
                      <Avatar src={p.photo ?? undefined} name={p.pseudo} size={32} />
                      <span>{p.pseudo}{p.id === member?.id ? ' (toi)' : ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {data.hiddenParticipants > 0 ? <p className="sub">+ {data.hiddenParticipants} masqué{data.hiddenParticipants > 1 ? 's' : ''}</p> : null}
          </section>
        </div>
      ) : !error ? (
        <div className="empty">Chargement…</div>
      ) : null}
    </div>
  );
}
