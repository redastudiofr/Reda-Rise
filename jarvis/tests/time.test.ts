import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayRange, hhmm, parisDay, parisIso, parisTime, weekdayOf } from '../src/lib/time';

test('heure de Paris, été comme hiver', () => {
  assert.equal(parisTime('2026-07-01', 9).toISOString(), '2026-07-01T07:00:00.000Z');
  assert.equal(parisTime('2026-12-01', 9).toISOString(), '2026-12-01T08:00:00.000Z');
  // jour du passage à l'heure d'hiver (25 octobre 2026) : la journée fait 25 h
  const r = dayRange('2026-10-25');
  assert.equal((r.end.getTime() - r.start.getTime()) / 3600000, 25);
  assert.equal(parisIso(parisTime('2026-12-01', 14, 30)), '2026-12-01T14:30:00+01:00');
  assert.equal(parisIso(parisTime('2026-07-01', 14, 30)), '2026-07-01T14:30:00+02:00');
  assert.equal(hhmm(new Date('2026-11-05T23:30:00Z')), '00:30');
  assert.equal(parisDay(new Date('2026-11-05T23:30:00Z')), '2026-11-06');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekdayOf('2026-11-05'), 4); // jeudi
});
