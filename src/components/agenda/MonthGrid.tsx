'use client';

import { shiftKey, weekdayOf } from '@/lib/logic';
import type { AgendaItem } from '@/lib/agenda';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Six weeks starting on the Monday on or before the first of the month. */
export function monthGrid(anchor: string): string[] {
  const first = `${anchor.slice(0, 7)}-01`;
  const wd = weekdayOf(first);
  const start = shiftKey(first, wd === 0 ? -6 : 1 - wd);
  return Array.from({ length: 42 }, (_, i) => shiftKey(start, i));
}

/**
 * Month at a glance. On a phone each day shows coloured dots; on a wider
 * screen, the first items by name. Tap selects the day, a second tap opens it.
 */
export default function MonthGrid({
  anchor,
  today,
  selected,
  itemsByDay,
  xpByDay,
  onSelect,
  onOpenDay,
}: {
  anchor: string;
  today: string;
  selected: string;
  itemsByDay: Record<string, AgendaItem[]>;
  xpByDay: Record<string, number>;
  onSelect: (date: string) => void;
  onOpenDay: (date: string) => void;
}) {
  const month = anchor.slice(0, 7);
  const cells = monthGrid(anchor);
  return (
    <div className="cal ag-month">
      <div className="cal-head">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((date) => {
          const items = itemsByDay[date] ?? [];
          const objs = items.filter((i) => i.type === 'objective');
          const allObjDone = objs.length > 0 && objs.every((o) => o.done);
          const shown = items.slice(0, 3);
          return (
            <button
              key={date}
              className="cal-cell ag-mcell"
              data-out={date.slice(0, 7) !== month}
              data-today={date === today}
              data-selected={date === selected}
              onClick={() => (date === selected ? onOpenDay(date) : onSelect(date))}
              aria-label={`${date}, ${items.length} élément${items.length > 1 ? 's' : ''}`}
            >
              <span className="cal-num mono">{Number(date.slice(8))}</span>
              <span className="ag-mdots">
                {items.slice(0, 4).map((it) => (
                  <i key={it.key} style={{ background: it.color }} data-done={it.done} />
                ))}
                {items.length === 0 && (xpByDay[date] ?? 0) > 0 ? <i className="m-xp" /> : null}
              </span>
              <span className="ag-mitems">
                {shown.map((it) => (
                  <span key={it.key} className="ag-mitem" data-done={it.done} style={{ ['--c' as string]: it.color }}>
                    {it.title}
                  </span>
                ))}
                {items.length > shown.length ? <span className="ag-mmore">+{items.length - shown.length}</span> : null}
              </span>
              {allObjDone ? <span className="ag-mall" aria-label="Objectifs tous validés" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
