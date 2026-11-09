import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeSlots, planDay, stillFree, type Interval } from '../../src/lib/jarvis/planner';
import { DEFAULT_SETTINGS } from '../../src/lib/jarvis/settings';
import { hhmm, parisTime } from '../../src/lib/jarvis/time';

const s = { ...DEFAULT_SETTINGS, bufferMinutes: 0 };
const t = (day: string, h: number, m = 0) => parisTime(day, h, m).getTime();
const show = (items: { title: string; start: string; end: string }[]) => items.map((i) => `${i.title} ${hhmm(new Date(i.start))}-${hhmm(new Date(i.end))}`);

test('jeudi : cours 8h-18h, un rendez-vous 19h-20h', () => {
  const day = '2026-11-05'; // jeudi
  const busy: Interval[] = [{ start: t(day, 19), end: t(day, 20) }];
  const slots = freeSlots(day, busy, s, t(day, 6));
  assert.deepEqual(slots.map((x) => `${hhmm(new Date(x.start))}-${hhmm(new Date(x.end))}`), ['07:00-08:00', '18:00-19:00', '20:00-22:00']);
  const plan = planDay(day, [{ title: 'Sport', minutes: 60 }, { title: 'Mails', minutes: 30 }, { title: 'Compta', minutes: 90 }], busy, s, t(day, 6));
  assert.deepEqual(show(plan.items), ['Sport 07:00-08:00', 'Mails 18:00-18:30', 'Compta 20:00-21:30']);
  assert.deepEqual(plan.unplaced, []);
  for (const it of plan.items) assert.ok(stillFree(it, busy, day, s));
});

test('jamais sur un cours ni un événement, même avec une heure imposée', () => {
  const day = '2026-11-04'; // mercredi, cours jusqu'à 16h
  const plan = planDay(day, [{ title: 'Appel', minutes: 30, at: 15 * 60 }, { title: 'Lecture', minutes: 45, at: 16 * 60 + 30 }], [], s, t(day, 6));
  assert.deepEqual(show(plan.items), ['Lecture 16:30-17:15']);
  assert.equal(plan.unplaced[0].title, 'Appel');
});

test('créneau du soir demandé, tampon entre tâches, maintenant pris en compte', () => {
  const day = '2026-11-06'; // vendredi, cours 8h-15h
  const plan = planDay(
    day,
    [{ title: 'Vidéo', minutes: 60, earliest: 18 * 60 }, { title: 'Shop', minutes: 45 }, { title: 'Trop long', minutes: 600 }],
    [],
    { ...s, bufferMinutes: 10 },
    t(day, 14, 52),
  );
  assert.deepEqual(show(plan.items), ['Shop 15:10-15:55', 'Vidéo 18:00-19:00']);
  assert.deepEqual(plan.unplaced.map((u) => u.title), ['Trop long']);
});

test('week-end : pas de cours', () => {
  const day = '2026-11-07';
  assert.deepEqual(freeSlots(day, [], s, 0).map((x) => `${hhmm(new Date(x.start))}-${hhmm(new Date(x.end))}`), ['07:00-22:00']);
});
