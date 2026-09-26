'use client';

import Link from 'next/link';
import { useData } from '../DataProvider';
import { newEvent } from '@/lib/agenda';
import { uid, todayKey } from '@/lib/logic';
import type { NetEvent } from '@/lib/network/types';

/** Owner only (needs their app data): puts the event in their own calendar, once. */
export default function AddToAgenda({ e }: { e: NetEvent }) {
  const { data, update } = useData();
  const existing = data.agenda.events.find((x) => x.networkEventId === e.id);

  function add() {
    const place = [e.city, e.placeHint].filter(Boolean).join(' — ');
    const ev = newEvent({
      id: uid(),
      createdAt: todayKey(data.settings.timezone),
      kind: 'evenement',
      title: e.title,
      date: e.date,
      time: e.time,
      duration: e.duration,
      repeat: 'none',
      reminders: [60],
      description: [e.description, `Network · ${place}`].filter(Boolean).join('\n\n'),
      networkEventId: e.id,
    });
    update((d) => ({ ...d, agenda: { ...d.agenda, events: [...d.agenda.events, ev] } }));
  }

  if (existing) {
    return (
      <Link href="/calendrier" className="btn btn-ghost">
        ✓ Dans ton calendrier
      </Link>
    );
  }
  return (
    <button className="btn btn-ghost" onClick={add}>
      Ajouter à mon calendrier
    </button>
  );
}
