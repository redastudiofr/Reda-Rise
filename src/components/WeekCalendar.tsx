'use client';

import { useRef, useState } from 'react';
import { addDays, dayKey, MONTHS_SHORT, parseKey, startOfWeek, WEEKDAYS_SHORT } from '@/lib/dates';

type Props = {
  selected: string; // clé YYYY-MM-DD
  today: string; // clé YYYY-MM-DD
  onSelect: (key: string) => void;
  /** Avancement d'un jour, entre 0 et 1 (anneau autour du numéro). */
  progressOf: (key: string) => number;
};

const RING_R = 18;
const RING_C = 2 * Math.PI * RING_R;
const SWIPE_PX = 48;

export function WeekCalendar({ selected, today, onSelect, progressOf }: Props) {
  const selDate = parseKey(selected);
  const monday = startOfWeek(selDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  // Direction du dernier changement de semaine, pour l'animation d'entrée.
  const [dir, setDir] = useState<'next' | 'prev' | null>(null);
  const [tick, setTick] = useState(0);

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  function shiftWeek(n: number) {
    // Garde le même jour de semaine, décalé de 7 jours.
    const next = addDays(selDate, n * 7);
    setDir(n > 0 ? 'next' : 'prev');
    setTick((t) => t + 1);
    onSelect(dayKey(next));
  }

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startY.current = e.clientY;
  }

  function onPointerUp(e: React.PointerEvent) {
    if (startX.current === null || startY.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    startX.current = null;
    startY.current = null;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.4) {
      shiftWeek(dx < 0 ? 1 : -1);
    }
  }

  const monthLabel = MONTHS_SHORT[selDate.getMonth()];
  const year = selDate.getFullYear();

  return (
    <div className="cal" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <div className="cal-month" aria-label={`${monthLabel} ${year}`}>
        <strong>{monthLabel}</strong>
        <span>{year}</span>
      </div>

      <div className="cal-track">
        <div
          key={`${monday.getTime()}-${tick}`}
          className={`cal-week ${dir === 'next' ? 'is-entering-next' : dir === 'prev' ? 'is-entering-prev' : ''}`}
          role="listbox"
          aria-label="Semaine"
        >
          {days.map((d, i) => {
            const key = dayKey(d);
            const isSel = key === selected;
            const isToday = key === today;
            const isFuture = key > today;
            const p = isFuture ? 0 : progressOf(key);
            const offset = RING_C * (1 - p);
            return (
              <button
                key={key}
                role="option"
                aria-selected={isSel}
                aria-label={`${WEEKDAYS_SHORT[i]} ${d.getDate()}`}
                className={[
                  'cal-day',
                  isSel && 'is-selected',
                  isToday && 'is-today',
                  isFuture && 'is-future',
                  p >= 1 && 'is-complete',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelect(key)}
              >
                <span className="cal-dow">{WEEKDAYS_SHORT[i]}</span>
                <span className="cal-num">
                  {p > 0 && (
                    <svg viewBox="0 0 42 42" aria-hidden="true">
                      <circle className="track" cx="21" cy="21" r={RING_R} fill="none" strokeWidth="2" />
                      <circle
                        className="bar"
                        cx="21"
                        cy="21"
                        r={RING_R}
                        fill="none"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={RING_C}
                        strokeDashoffset={offset}
                      />
                    </svg>
                  )}
                  <b>{d.getDate()}</b>
                </span>
                <span className="cal-dot" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
