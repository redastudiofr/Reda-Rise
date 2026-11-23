'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fromMin, layoutDay, type AgendaItem } from '@/lib/agenda';

const SNAP = 15;
const LONG_PRESS = 320;
const MOVE_TOLERANCE = 8;

type Drag = {
  item: AgendaItem;
  mode: 'move' | 'resize';
  pointerId: number;
  x0: number;
  y0: number;
  dayIndex: number;
  active: boolean;
  timer: number | null;
  /** Current preview. */
  date: string;
  start: number;
  end: number;
};

function Tick({ on }: { on: boolean }) {
  return (
    <span className="ag-tick" data-on={on} aria-hidden>
      {on ? (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
        </svg>
      ) : null}
    </span>
  );
}

/**
 * Hour grid for one, three or seven days. Tap an empty slot to create, tap a
 * block to open it, hold then drag to move it (across days too), drag its
 * lower edge to change its length. Objectives are ticked in place.
 */
export default function TimeGrid({
  days,
  today,
  nowMinutes,
  itemsByDay,
  hourHeight,
  onCreate,
  onOpen,
  onToggle,
  onMove,
  onResize,
  onPickDay,
}: {
  days: string[];
  today: string;
  nowMinutes: number;
  itemsByDay: Record<string, AgendaItem[]>;
  hourHeight: number;
  onCreate: (date: string, minute: number) => void;
  onOpen: (item: AgendaItem) => void;
  onToggle: (item: AgendaItem) => void;
  onMove: (item: AgendaItem, date: string, start: number) => void;
  onResize: (item: AgendaItem, duration: number) => void;
  onPickDay: (date: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ key: string; date: string; start: number; end: number } | null>(null);
  const pxPerMin = hourHeight / 60;

  // Open on the morning, or on the earliest item when it is earlier.
  const firstKey = days[0];
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const starts = days.flatMap((d) => (itemsByDay[d] ?? []).map((i) => i.start).filter((s): s is number => s !== null));
    const earliest = Math.min(7 * 60, ...starts);
    const target = days.includes(today) ? Math.min(earliest, Math.max(0, nowMinutes - 90)) : earliest;
    el.scrollTop = Math.max(0, target * pxPerMin - 8);
    // Only when the range changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, days.length, pxPerMin]);

  // Once a drag is live, stop the page from scrolling under the finger.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (dragRef.current?.active) e.preventDefault();
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  function columnAt(clientX: number): number {
    const el = colsRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(days.length - 1, Math.floor(((clientX - r.left) / r.width) * days.length)));
  }

  function minuteAt(clientY: number): number {
    const el = colsRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return (clientY - r.top) / pxPerMin;
  }

  function activate(d: Drag) {
    d.active = true;
    setPreview({ key: d.item.key, date: d.date, start: d.start, end: d.end });
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function onBlockDown(e: React.PointerEvent, item: AgendaItem, dayIdx: number, mode: 'move' | 'resize') {
    if (item.type === 'objective' || item.start === null || item.end === null) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const d: Drag = {
      item,
      mode,
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      dayIndex: dayIdx,
      active: false,
      timer: null,
      date: item.date,
      start: item.start,
      end: item.end,
    };
    dragRef.current = d;
    // Touch needs a hold, so a swipe on a block still scrolls the grid.
    if (e.pointerType === 'touch' || mode === 'resize') {
      d.timer = window.setTimeout(() => {
        if (dragRef.current === d) activate(d);
      }, mode === 'resize' && e.pointerType !== 'touch' ? 0 : LONG_PRESS);
    }
  }

  function onBlockMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.hypot(dx, dy) < MOVE_TOLERANCE) return;
      if (e.pointerType === 'touch') {
        // Moved before the hold completed: it is a scroll, not a drag.
        if (d.timer) clearTimeout(d.timer);
        dragRef.current = null;
        return;
      }
      activate(d);
    }
    const len = d.item.end! - d.item.start!;
    if (d.mode === 'move') {
      const delta = Math.round(dy / pxPerMin / SNAP) * SNAP;
      const start = Math.max(0, Math.min(1440 - len, d.item.start! + delta));
      const col = columnAt(e.clientX);
      d.date = days[col];
      d.start = start;
      d.end = start + len;
    } else {
      const end = Math.round(minuteAt(e.clientY) / SNAP) * SNAP;
      d.end = Math.max(d.item.start! + SNAP, Math.min(1440, end));
    }
    setPreview({ key: d.item.key, date: d.date, start: d.start, end: d.end });
  }

  function onBlockUp(e: React.PointerEvent, item: AgendaItem) {
    const d = dragRef.current;
    if (d?.timer) clearTimeout(d.timer);
    dragRef.current = null;
    if (!d || d.pointerId !== e.pointerId) return;
    setPreview(null);
    if (!d.active) {
      onOpen(item);
      return;
    }
    if (d.mode === 'move') {
      if (d.date !== item.date || d.start !== item.start) onMove(item, d.date, d.start);
    } else if (d.end !== item.end) {
      onResize(item, d.end - item.start!);
    }
  }

  function onBlockCancel() {
    const d = dragRef.current;
    if (d?.timer) clearTimeout(d.timer);
    dragRef.current = null;
    setPreview(null);
  }

  function onColumnClick(e: React.MouseEvent, date: string) {
    const minute = Math.floor(minuteAt(e.clientY) / 30) * 30;
    onCreate(date, Math.max(0, Math.min(1410, minute)));
  }

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const allDay = days.map((d) => (itemsByDay[d] ?? []).filter((i) => i.start === null));
  const hasAllDay = allDay.some((l) => l.length > 0);
  const narrow = days.length >= 7;

  return (
    <div className="ag-grid" data-days={days.length}>
      <div className="ag-grid-head">
        <div className="ag-gutter" />
        {days.map((d) => {
          const dt = new Date(`${d}T12:00:00Z`);
          const wd = new Intl.DateTimeFormat('fr-FR', { weekday: narrow ? 'narrow' : 'short', timeZone: 'UTC' }).format(dt);
          return (
            <button key={d} className="ag-dayhead" data-today={d === today} onClick={() => onPickDay(d)}>
              <span>{wd.replace('.', '')}</span>
              <b className="mono">{Number(d.slice(8))}</b>
            </button>
          );
        })}
      </div>

      {hasAllDay ? (
        <div className="ag-allday-row">
          <div className="ag-gutter ag-gutter-label">jour</div>
          {days.map((d, i) => (
            <div key={d} className="ag-allday-cell">
              {allDay[i].map((it) => (
                <button
                  key={it.key}
                  className="ag-chip"
                  data-type={it.type}
                  data-done={it.done}
                  style={{ ['--c' as string]: it.color }}
                  onClick={() => (it.type === 'objective' ? onToggle(it) : onOpen(it))}
                  title={it.title}
                >
                  {it.type !== 'event' ? <Tick on={Boolean(it.done)} /> : null}
                  <span>{it.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className="ag-scroll" ref={scrollRef}>
        <div className="ag-body" style={{ height: 24 * hourHeight }}>
          <div className="ag-gutter ag-hours">
            {hours.map((h) => (
              <span key={h} style={{ top: h * hourHeight }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          <div className="ag-cols" ref={colsRef}>
            {hours.map((h) => (
              <i key={h} className="ag-line" style={{ top: h * hourHeight }} />
            ))}
            {days.map((d, dayIdx) => {
              const placed = layoutDay(itemsByDay[d] ?? []);
              return (
                <div
                  key={d}
                  className="ag-col"
                  data-today={d === today}
                  onClick={(e) => onColumnClick(e, d)}
                  role="presentation"
                >
                  {d === today ? (
                    <i className="ag-now" style={{ top: nowMinutes * pxPerMin }} aria-hidden />
                  ) : null}
                  {placed.map((it) => {
                    const pv = preview?.key === it.key ? preview : null;
                    // Stays mounted while dragged to another day (it keeps the pointer), shifted by whole columns.
                    const shift = pv ? days.indexOf(pv.date) - dayIdx : 0;
                    const start = pv ? pv.start : it.start!;
                    const end = pv ? pv.end : it.end!;
                    const height = Math.max(18, (end - start) * pxPerMin - 2);
                    const compact = height < 34;
                    const width = pv ? 100 : 100 / it.lanes;
                    return (
                      <div
                        key={it.key}
                        className="ag-block"
                        data-type={it.type}
                        data-done={it.done}
                        data-drag={Boolean(pv)}
                        data-compact={compact}
                        style={{
                          ['--c' as string]: it.color,
                          top: start * pxPerMin + 1,
                          height,
                          left: `${pv ? shift * 100 : it.lane * width}%`,
                          width: `calc(${width}% - 2px)`,
                        }}
                        onPointerDown={(e) => onBlockDown(e, it, dayIdx, 'move')}
                        onPointerMove={onBlockMove}
                        onPointerUp={(e) => onBlockUp(e, it)}
                        onPointerCancel={onBlockCancel}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (it.type === 'objective') onToggle(it);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (it.type === 'objective') onToggle(it);
                            else onOpen(it);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${it.label} : ${it.title}, ${fromMin(start)} à ${fromMin(end)}`}
                      >
                        <div className="ag-block-top">
                          {it.type !== 'event' ? (
                            <button
                              className="ag-tick-btn"
                              aria-label={it.done ? 'Marquer comme à faire' : 'Marquer comme fait'}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggle(it);
                              }}
                            >
                              <Tick on={Boolean(it.done)} />
                            </button>
                          ) : null}
                          <span className="ag-block-title">{it.title}</span>
                        </div>
                        {!compact ? (
                          <span className="ag-block-meta mono">
                            {fromMin(start)}–{fromMin(end)}
                            {!narrow ? ` · ${it.label}` : ''}
                          </span>
                        ) : null}
                        {it.type !== 'objective' ? (
                          <span
                            className="ag-resize"
                            onPointerDown={(e) => onBlockDown(e, it, dayIdx, 'resize')}
                            aria-hidden
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {preview ? (
        <div className="ag-drag-hint mono" aria-live="polite">
          {fromMin(preview.start)} – {fromMin(preview.end)}
        </div>
      ) : null}
    </div>
  );
}
