'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Avatar from '../Avatar';
import { api } from '@/lib/network/client';
import { enablePush, readPushState, type PushState } from '@/lib/pushClient';

type Person = { id: string; pseudo: string; photo: string | null };

const PUSH_TEXT: Record<PushState, string> = {
  unknown: '',
  unsupported: 'Ce navigateur ne gère pas les notifications.',
  'needs-install': 'Sur iPhone, ajoute d’abord l’app à l’écran d’accueil (Partager → Sur l’écran d’accueil).',
  denied: 'Notifications bloquées : autorise-les dans les réglages du navigateur.',
  off: 'Reçois une notification quand quelqu’un t’écrit (sans le contenu du message).',
  on: 'Activées sur cet appareil.',
};

/** Member settings that live outside the profile: message notifications and blocked members. */
export default function NetSettings() {
  const [push, setPush] = useState<PushState>('unknown');
  const [registered, setRegistered] = useState(false);
  const [blocked, setBlocked] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readPushState().then(setPush);
    api<{ devices: number }>('/push')
      .then((r) => setRegistered(r.devices > 0))
      .catch(() => undefined);
    api<{ blocked: Person[] }>('/blocks')
      .then((r) => setBlocked(r.blocked))
      .catch(() => setBlocked([]));
  }, []);

  async function turnOn() {
    setError(null);
    try {
      const s = await enablePush({ key: '/api/network/push', register: '/api/network/push' });
      setPush(s);
      if (s === 'on') setRegistered(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function unblock(id: string) {
    await api('/blocks', { method: 'DELETE', body: { memberId: id } }).catch(() => undefined);
    setBlocked((b) => (b ? b.filter((p) => p.id !== id) : b));
  }

  const on = push === 'on' && registered;
  return (
    <>
      <section className="section">
        <h2 className="section-title">Notifications</h2>
        <div className="card net-switch-row" style={{ marginTop: 0, borderTop: 0 }}>
          <span>
            <b>Nouveaux messages</b>
            <small>{on ? PUSH_TEXT.on : PUSH_TEXT[push === 'on' ? 'off' : push]}</small>
          </span>
          {push === 'off' || (push === 'on' && !registered) ? (
            <button className="btn btn-accent btn-sm" onClick={turnOn}>Activer</button>
          ) : null}
        </div>
        {error ? <div className="banner warn" role="alert">{error}</div> : null}
      </section>
      <section className="section">
        <h2 className="section-title">Membres bloqués</h2>
        {blocked === null ? null : blocked.length === 0 ? (
          <p className="sub">Personne.</p>
        ) : (
          <ul className="card net-count-list">
            {blocked.map((p) => (
              <li key={p.id} className="net-blocked-row">
                <Link href={`/network/membre/${p.id}`} className="net-inline-person">
                  <Avatar src={p.photo ?? undefined} name={p.pseudo} size={26} /> {p.pseudo}
                </Link>
                <button className="link-sm" onClick={() => unblock(p.id)}>Débloquer</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
