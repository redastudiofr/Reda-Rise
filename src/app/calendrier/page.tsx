'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/components/DataProvider';
import TimeGrid from '@/components/agenda/TimeGrid';
import MonthGrid, { monthGrid } from '@/components/agenda/MonthGrid';
import DayList from '@/components/agenda/DayList';
import TaskRow from '@/components/agenda/TaskRow';
import ItemSheet, { type SheetResult, type SheetTarget } from '@/components/agenda/ItemSheet';
import ProjectSheet from '@/components/agenda/ProjectSheet';
import { dayXp, formatDate, shiftKey, todayKey, weekdayOf } from '@/lib/logic';
import { xpOnDate } from '@/lib/xp';
import { localNow } from '@/lib/schedule';
import {
  DEFAULT_FILTERS,
  PRIORITIES,
  dayIndex,
  fromMin,
  itemsForDay,
  newTask,
  priorityOf,
  projectProgress,
  projectTasks,
  searchAgenda,
  type AgendaFilters,
  type AgendaItem,
  type SearchHit,
} from '@/lib/agenda';
import { uid } from '@/lib/logic';
import type { AgendaProject, AppData, CalTask, DailyEntry } from '@/lib/types';

type View = 'jour' | '3j' | 'semaine' | 'mois';
type Tab = 'agenda' | 'taches' | 'projets';

const VIEWS: { id: View; label: string; days: number }[] = [
  { id: 'jour', label: 'Jour', days: 1 },
  { id: '3j', label: '3 jours', days: 3 },
  { id: 'semaine', label: 'Semaine', days: 7 },
  { id: 'mois', label: 'Mois', days: 0 },
];

const VIEW_KEY = 'telos:cal-view';
const FILTER_KEY = 'telos:cal-filters';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* preference only */
  }
}

function mondayOf(date: string): string {
  const wd = weekdayOf(date);
  return shiftKey(date, wd === 0 ? -6 : 1 - wd);
}

function Icon({ name }: { name: 'left' | 'right' | 'search' | 'filter' | 'plus' | 'close' }) {
  const paths = {
    left: 'M14.5 5.5 8 12l6.5 6.5',
    right: 'M9.5 5.5 16 12l-6.5 6.5',
    search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.8-1.7L20 20',
    filter: 'M4 6.5h16M7 12h10M10 17.5h4',
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6 6 18',
  };
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}

export default function CalendarPage() {
  const { data, update } = useData();
  const tz = data.settings.timezone;
  const today = todayKey(tz);

  const [tab, setTab] = useState<Tab>('agenda');
  const [view, setView] = useState<View>('jour');
  const [anchor, setAnchor] = useState(today);
  const [filters, setFilters] = useState<AgendaFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [projectSheet, setProjectSheet] = useState<AgendaProject | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [taskQuick, setTaskQuick] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(() => localNow(tz).minutes);
  const [wide, setWide] = useState(false);

  // Remembered view and filters; a date from a notification link wins.
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 640px)').matches;
    setWide(!narrow);
    const saved = load<{ view?: View }>(VIEW_KEY, {}).view;
    setView(saved && VIEWS.some((v) => v.id === saved) ? saved : narrow ? 'jour' : 'semaine');
    setFilters(load(FILTER_KEY, DEFAULT_FILTERS));
    const d = new URLSearchParams(window.location.search).get('d');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setAnchor(d);
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setWide(!mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMinutes(localNow(tz).minutes), 60_000);
    return () => clearInterval(t);
  }, [tz]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  function changeView(v: View) {
    setView(v);
    store(VIEW_KEY, { view: v });
  }

  function changeFilters(next: AgendaFilters) {
    setFilters(next);
    store(FILTER_KEY, next);
  }

  /* ---------- plage affichée ---------- */

  const days = useMemo(() => {
    if (view === 'jour') return [anchor];
    if (view === '3j') return [anchor, shiftKey(anchor, 1), shiftKey(anchor, 2)];
    if (view === 'semaine') {
      const m = mondayOf(anchor);
      return Array.from({ length: 7 }, (_, i) => shiftKey(m, i));
    }
    return monthGrid(anchor);
  }, [view, anchor]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {};
    for (const d of days) map[d] = itemsForDay(data, d, filters);
    if (view === 'mois' && !map[anchor]) map[anchor] = itemsForDay(data, anchor, filters);
    return map;
  }, [data, days, filters, view, anchor]);

  const xpByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of days) map[d] = xpOnDate(data, d, dayXp);
    return map;
  }, [data, days]);

  function shift(dir: -1 | 1) {
    if (view === 'mois') {
      const [y, m] = anchor.split('-').map(Number);
      const target = new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
      // Keep the same day of month when it exists.
      const day = Math.min(Number(anchor.slice(8)), new Date(Date.UTC(Number(target.slice(0, 4)), Number(target.slice(5, 7)), 0)).getUTCDate());
      setAnchor(`${target.slice(0, 8)}${String(day).padStart(2, '0')}`);
    } else {
      setAnchor(shiftKey(anchor, dir * (view === 'jour' ? 1 : view === '3j' ? 3 : 7)));
    }
  }

  const rangeLabel = (() => {
    const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('fr-FR', { ...o, timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
    if (view === 'jour') return fmt(anchor, { weekday: 'long', day: 'numeric', month: 'long' });
    if (view === 'mois') return fmt(anchor, { month: 'long', year: 'numeric' });
    const a = days[0];
    const b = days[days.length - 1];
    return a.slice(0, 7) === b.slice(0, 7)
      ? `${Number(a.slice(8))} – ${fmt(b, { day: 'numeric', month: 'long' })}`
      : `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(b, { day: 'numeric', month: 'short' })}`;
  })();

  /* ---------- modifications ---------- */

  function patchAgenda(fn: (a: AppData['agenda']) => AppData['agenda']) {
    update((d) => ({ ...d, agenda: fn(d.agenda) }));
  }

  function toggleObjective(item: AgendaItem) {
    const o = item.objective!;
    if (!item.done && o.requiresProof && !data.proofs[`${item.date}|${o.id}`]) {
      setNotice('Cet objectif se valide avec une photo, depuis l’onglet Aujourd’hui.');
      return;
    }
    update((d) => {
      const e: DailyEntry = d.daily[item.date] ?? { tasks: {} };
      const list = e.objectives ?? [];
      return {
        ...d,
        daily: {
          ...d.daily,
          [item.date]: { ...e, objectives: list.includes(o.id) ? list.filter((x) => x !== o.id) : [...list, o.id] },
        },
      };
    });
  }

  function toggleTask(t: CalTask) {
    const done = t.status === 'termine';
    patchAgenda((a) => ({
      ...a,
      tasks: a.tasks.map((x) =>
        x.id === t.id ? { ...x, status: done ? 'a-faire' : 'termine', doneAt: done ? undefined : today } : x,
      ),
    }));
  }

  function toggle(item: AgendaItem) {
    if (item.type === 'objective') toggleObjective(item);
    else if (item.type === 'task') toggleTask(item.task!);
  }

  function open(item: AgendaItem) {
    if (item.type === 'event') setSheet({ mode: 'edit', type: 'event', event: item.event!, occurrence: item.date });
    else if (item.type === 'task') setSheet({ mode: 'edit', type: 'task', task: item.task! });
    else toggleObjective(item);
  }

  function move(item: AgendaItem, date: string, start: number) {
    const time = fromMin(start);
    if (item.type === 'event') {
      const delta = dayIndex(date) - dayIndex(item.date);
      patchAgenda((a) => ({
        ...a,
        // A repeating event moves as a whole series.
        events: a.events.map((e) => (e.id === item.id ? { ...e, date: shiftKey(e.date, delta), time } : e)),
      }));
    } else if (item.type === 'task') {
      patchAgenda((a) => ({ ...a, tasks: a.tasks.map((t) => (t.id === item.id ? { ...t, date, time } : t)) }));
    }
  }

  function resize(item: AgendaItem, duration: number) {
    if (item.type === 'event') {
      patchAgenda((a) => ({ ...a, events: a.events.map((e) => (e.id === item.id ? { ...e, duration } : e)) }));
    } else if (item.type === 'task') {
      patchAgenda((a) => ({ ...a, tasks: a.tasks.map((t) => (t.id === item.id ? { ...t, duration } : t)) }));
    }
  }

  function saveSheet(r: SheetResult) {
    if (r.type === 'event') {
      patchAgenda((a) => ({
        ...a,
        events: a.events.some((e) => e.id === r.event.id)
          ? a.events.map((e) => (e.id === r.event.id ? r.event : e))
          : [...a.events, r.event],
        // Switching an existing task into an event is not offered, so nothing to drop.
      }));
      if (r.event.date !== anchor && tab === 'agenda' && !days.includes(r.event.date)) setAnchor(r.event.date);
    } else {
      patchAgenda((a) => ({
        ...a,
        tasks: a.tasks.some((t) => t.id === r.task.id)
          ? a.tasks.map((t) => (t.id === r.task.id ? r.task : t))
          : [...a.tasks, r.task],
      }));
    }
    setSheet(null);
  }

  function deleteFromSheet(scope: 'occurrence' | 'all') {
    if (!sheet || sheet.mode !== 'edit') return;
    if (sheet.type === 'event') {
      const { event, occurrence } = sheet;
      patchAgenda((a) => ({
        ...a,
        events:
          scope === 'occurrence'
            ? a.events.map((e) => (e.id === event.id ? { ...e, exceptions: [...(e.exceptions ?? []), occurrence] } : e))
            : a.events.filter((e) => e.id !== event.id),
      }));
    } else {
      const id = sheet.task.id;
      patchAgenda((a) => ({ ...a, tasks: a.tasks.filter((t) => t.id !== id) }));
    }
    setSheet(null);
  }

  function createAt(date: string, minute?: number) {
    const time =
      minute !== undefined
        ? fromMin(minute)
        : fromMin(date === today ? Math.min(23 * 60, Math.ceil((nowMinutes + 1) / 60) * 60) : 9 * 60);
    setSheet({ mode: 'create', type: 'event', date, time });
  }

  function addQuickTask() {
    const title = taskQuick.trim();
    if (!title) return;
    patchAgenda((a) => ({ ...a, tasks: [...a.tasks, newTask({ id: uid(), createdAt: today, title, date: today })] }));
    setTaskQuick('');
  }

  function openHit(h: SearchHit) {
    setSearching(false);
    setQuery('');
    if (h.type === 'project') {
      setTab('projets');
      setProjectSheet(data.agenda.projects.find((p) => p.id === h.id) ?? null);
      return;
    }
    if (h.date) {
      setTab('agenda');
      setAnchor(h.date);
    }
    if (h.type === 'event') {
      const e = data.agenda.events.find((x) => x.id === h.id);
      if (e) setSheet({ mode: 'edit', type: 'event', event: e, occurrence: h.date ?? e.date });
    } else if (h.type === 'task') {
      const t = data.agenda.tasks.find((x) => x.id === h.id);
      if (t) {
        if (!t.date) setTab('taches');
        setSheet({ mode: 'edit', type: 'task', task: t });
      }
    }
  }

  /* ---------- navigation : clavier et balayage ---------- */

  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (sheet || projectSheet || el.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft' && tab === 'agenda') shift(-1);
      else if (e.key === 'ArrowRight' && tab === 'agenda') shift(1);
      else if (e.key === 't') setAnchor(today);
      else if (e.key === 'n') createAt(anchor);
      else if (e.key === '/') {
        e.preventDefault();
        setSearching(true);
      } else return;
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    swipe.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // A quick horizontal flick; a held gesture is a drag in the grid.
    if (Date.now() - s.t < 450 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) shift(dx < 0 ? 1 : -1);
  }

  /* ---------- tâches ---------- */

  const taskGroups = useMemo(() => {
    const visible = data.agenda.tasks.filter(
      (t) => filters.priorities.length === 0 || filters.priorities.includes(t.priority),
    );
    const open = visible.filter((t) => t.status !== 'termine');
    const byPrio = (a: CalTask, b: CalTask) =>
      priorityOf(a.priority).rank - priorityOf(b.priority).rank ||
      (a.date ?? '').localeCompare(b.date ?? '') ||
      (a.time ?? '99').localeCompare(b.time ?? '99');
    const tomorrow = shiftKey(today, 1);
    return [
      { id: 'retard', label: 'En retard', tasks: open.filter((t) => t.date && t.date < today).sort(byPrio) },
      { id: 'auj', label: 'Aujourd’hui', tasks: open.filter((t) => t.date === today).sort(byPrio) },
      { id: 'demain', label: 'Demain', tasks: open.filter((t) => t.date === tomorrow).sort(byPrio) },
      { id: 'plus', label: 'Plus tard', tasks: open.filter((t) => t.date && t.date > tomorrow).sort(byPrio) },
      { id: 'sans', label: 'Sans date', tasks: open.filter((t) => !t.date).sort(byPrio) },
      {
        id: 'faites',
        label: 'Terminées',
        tasks: filters.showDone
          ? visible.filter((t) => t.status === 'termine').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
          : [],
      },
    ].filter((g) => g.tasks.length > 0);
  }, [data.agenda.tasks, filters, today]);

  const projects = data.agenda.projects.filter((p) => showArchived || !p.archived);
  const hits = useMemo(() => searchAgenda(data, query, today), [data, query, today]);
  const selectedItems = itemsByDay[anchor] ?? itemsForDay(data, anchor, filters);
  const activeFilters =
    Number(!filters.events) + Number(!filters.tasks) + Number(!filters.objectives) + Number(!filters.showDone) + filters.priorities.length;
  const dayObjectives = selectedItems.filter((i) => i.type === 'objective');

  const editingProject =
    projectSheet && projectSheet !== 'new'
      ? (data.agenda.projects.find((p) => p.id === projectSheet.id) ?? projectSheet)
      : null;

  return (
    <div className="agenda">
      {sheet ? (
        <ItemSheet
          key={sheet.mode === 'edit' ? (sheet.type === 'event' ? sheet.event.id : sheet.task.id) : 'new'}
          target={sheet}
          today={today}
          projects={data.agenda.projects}
          onSave={saveSheet}
          onDelete={deleteFromSheet}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {projectSheet && !sheet ? (
        <ProjectSheet
          data={data}
          project={editingProject}
          today={today}
          onSaveProject={(p) => {
            patchAgenda((a) => ({
              ...a,
              projects: a.projects.some((x) => x.id === p.id) ? a.projects.map((x) => (x.id === p.id ? p : x)) : [...a.projects, p],
            }));
            if (projectSheet === 'new') setProjectSheet(p);
          }}
          onDeleteProject={(p, withTasks) => {
            patchAgenda((a) => ({
              ...a,
              projects: a.projects.filter((x) => x.id !== p.id),
              tasks: withTasks
                ? a.tasks.filter((t) => t.projectId !== p.id)
                : a.tasks.map((t) => (t.projectId === p.id ? { ...t, projectId: undefined } : t)),
            }));
            setProjectSheet(null);
          }}
          onAddTask={(t) => patchAgenda((a) => ({ ...a, tasks: [...a.tasks, t] }))}
          onToggleTask={toggleTask}
          onOpenTask={(t) => setSheet({ mode: 'edit', type: 'task', task: t })}
          onClose={() => setProjectSheet(null)}
        />
      ) : null}

      <header className="topbar ag-top">
        <div>
          <h1>Calendrier</h1>
          <p className="sub ag-range">{tab === 'agenda' ? rangeLabel : tab === 'taches' ? 'Tâches' : 'Projets'}</p>
        </div>
        <div className="week-nav">
          <button onClick={() => setSearching(!searching)} aria-label="Rechercher" data-on={searching}>
            <Icon name="search" />
          </button>
          <button onClick={() => setShowFilters(!showFilters)} aria-label="Filtres" data-on={showFilters || activeFilters > 0}>
            <Icon name="filter" />
            {activeFilters > 0 ? <em className="ag-badge">{activeFilters}</em> : null}
          </button>
        </div>
      </header>

      {searching ? (
        <div className="ag-search">
          <input
            className="input"
            placeholder="Rechercher un événement, une tâche, un projet…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearching(false);
                setQuery('');
              }
              if (e.key === 'Enter' && hits[0]) openHit(hits[0]);
            }}
            aria-label="Rechercher"
          />
          {query.trim() ? (
            <div className="ag-hits card">
              {hits.length === 0 ? (
                <div className="hint">Aucun résultat.</div>
              ) : (
                hits.map((h) => (
                  <button key={`${h.type}-${h.id}`} className="ag-hit" onClick={() => openHit(h)}>
                    <span>
                      <b>{h.title}</b>
                      <small>{h.detail}</small>
                    </span>
                    {h.date ? <span className="mono">{formatDate(h.date)}</span> : null}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {showFilters ? (
        <div className="card ag-filters">
          <div className="chip-grid">
            {(
              [
                ['events', 'Événements'],
                ['tasks', 'Tâches'],
                ['objectives', 'Objectifs'],
                ['showDone', 'Terminés visibles'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className="chip" data-on={filters[k]} onClick={() => changeFilters({ ...filters, [k]: !filters[k] })}>
                {label}
              </button>
            ))}
          </div>
          <div className="chip-grid" style={{ marginTop: 8 }}>
            {PRIORITIES.map((p) => {
              const on = filters.priorities.includes(p.id);
              return (
                <button
                  key={p.id}
                  className="chip ag-prio-chip"
                  data-on={on}
                  style={{ ['--p' as string]: p.color }}
                  onClick={() =>
                    changeFilters({
                      ...filters,
                      priorities: on ? filters.priorities.filter((x) => x !== p.id) : [...filters.priorities, p.id],
                    })
                  }
                >
                  {p.label}
                </button>
              );
            })}
            {activeFilters > 0 ? (
              <button className="link-sm" onClick={() => changeFilters(DEFAULT_FILTERS)}>
                Tout afficher
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="segmented ag-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'agenda'} data-on={tab === 'agenda'} onClick={() => setTab('agenda')}>
          Agenda
        </button>
        <button role="tab" aria-selected={tab === 'taches'} data-on={tab === 'taches'} onClick={() => setTab('taches')}>
          Tâches
        </button>
        <button role="tab" aria-selected={tab === 'projets'} data-on={tab === 'projets'} onClick={() => setTab('projets')}>
          Projets
        </button>
      </div>

      {notice ? <div className="banner warn ag-notice">{notice}</div> : null}

      {tab === 'agenda' ? (
        <>
          <div className="ag-toolbar">
            <div className="ag-views" role="tablist" aria-label="Vue">
              {VIEWS.map((v) => (
                <button key={v.id} role="tab" aria-selected={view === v.id} data-on={view === v.id} onClick={() => changeView(v.id)}>
                  {v.label}
                </button>
              ))}
            </div>
            <div className="week-nav">
              <button onClick={() => shift(-1)} aria-label="Précédent">
                <Icon name="left" />
              </button>
              <button className="week-today" onClick={() => setAnchor(today)} data-on={days.includes(today) || anchor === today}>
                Auj.
              </button>
              <button onClick={() => shift(1)} aria-label="Suivant">
                <Icon name="right" />
              </button>
            </div>
          </div>

          <div className="ag-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {view === 'mois' ? (
              <div className="ag-month-wrap">
                <MonthGrid
                  anchor={anchor}
                  today={today}
                  selected={anchor}
                  itemsByDay={itemsByDay}
                  xpByDay={xpByDay}
                  onSelect={setAnchor}
                  onOpenDay={(d) => {
                    setAnchor(d);
                    changeView('jour');
                  }}
                />
                <section className="ag-daypanel">
                  <div className="row ag-daypanel-head">
                    <h2 className="section-title" style={{ margin: 0 }}>
                      {formatDate(anchor)}
                    </h2>
                    <span className="ag-dayxp mono">
                      {dayObjectives.length > 0
                        ? `${dayObjectives.filter((o) => o.done).length}/${dayObjectives.length} obj. · `
                        : ''}
                      +{xpOnDate(data, anchor, dayXp)} XP
                    </span>
                  </div>
                  <DayList items={selectedItems} onOpen={open} onToggle={toggle} />
                  <button className="btn btn-ghost ag-add-day" onClick={() => createAt(anchor)}>
                    + Ajouter le {Number(anchor.slice(8))}
                  </button>
                </section>
              </div>
            ) : (
              <>
                {view === 'jour' ? (
                  <div className="ag-daysum">
                    <span>
                      {selectedItems.length} élément{selectedItems.length > 1 ? 's' : ''}
                      {dayObjectives.length > 0
                        ? ` · ${dayObjectives.filter((o) => o.done).length}/${dayObjectives.length} objectifs`
                        : ''}
                    </span>
                    <b className="mono">+{xpOnDate(data, anchor, dayXp)} XP</b>
                  </div>
                ) : null}
                <TimeGrid
                  days={days}
                  today={today}
                  nowMinutes={nowMinutes}
                  itemsByDay={itemsByDay}
                  hourHeight={wide ? 52 : 48}
                  onCreate={(d, m) => createAt(d, m)}
                  onOpen={open}
                  onToggle={toggle}
                  onMove={move}
                  onResize={resize}
                  onPickDay={(d) => {
                    setAnchor(d);
                    if (view !== 'jour') changeView('jour');
                  }}
                />
                <p className="ag-tip">
                  Touche un créneau pour créer · maintiens puis fais glisser pour déplacer · tire le bas d’un bloc pour
                  changer sa durée
                </p>
              </>
            )}
          </div>
        </>
      ) : null}

      {tab === 'taches' ? (
        <section className="ag-tasks">
          <div className="ag-quickadd">
            <input
              className="input"
              placeholder="Nouvelle tâche pour aujourd’hui, puis Entrée"
              value={taskQuick}
              onChange={(e) => setTaskQuick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addQuickTask();
                }
              }}
              aria-label="Ajout rapide d’une tâche"
            />
            <button className="btn btn-sm btn-ghost" onClick={() => setSheet({ mode: 'create', type: 'task', date: today })}>
              Détails
            </button>
          </div>
          {taskGroups.length === 0 ? (
            <div className="card dash-empty">
              <b>Aucune tâche.</b>
              <span>Ajoute-en une ci-dessus, ou crée un projet pour découper un gros chantier.</span>
            </div>
          ) : (
            taskGroups.map((g) => (
              <div key={g.id} className="section ag-group" data-group={g.id}>
                <h2 className="section-title">
                  {g.label} · {g.tasks.length}
                </h2>
                <div className="ag-tasklist card">
                  {g.tasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      today={today}
                      project={data.agenda.projects.find((p) => p.id === t.projectId)}
                      onToggle={() => toggleTask(t)}
                      onOpen={() => setSheet({ mode: 'edit', type: 'task', task: t })}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      {tab === 'projets' ? (
        <section className="ag-projects">
          <button className="btn btn-accent" onClick={() => setProjectSheet('new')}>
            + Nouveau projet
          </button>
          {projects.length === 0 ? (
            <div className="card dash-empty" style={{ marginTop: 12 }}>
              <b>Pas encore de projet.</b>
              <span>Un projet regroupe des tâches — ex. « Lancement Reda Studio » : photos, produits, publicités, stock, TikTok.</span>
            </div>
          ) : (
            <div className="ag-proj-grid">
              {projects.map((p) => {
                const prog = projectProgress(data, p.id);
                const next = projectTasks(data, p.id).filter((t) => t.status !== 'termine').slice(0, 3);
                const daysLeft = p.deadline ? dayIndex(p.deadline) - dayIndex(today) : null;
                return (
                  <button key={p.id} className="ag-proj card" style={{ ['--pc' as string]: p.color }} onClick={() => setProjectSheet(p)} data-archived={p.archived}>
                    <div className="row">
                      <b className="ag-proj-title">{p.title}</b>
                      <span className="mono ag-proj-pct">{Math.round(prog.ratio * 100)} %</span>
                    </div>
                    <div className="bar">
                      <i style={{ width: `${prog.ratio * 100}%` }} />
                    </div>
                    <div className="ag-proj-meta">
                      {prog.done} / {prog.total} tâche{prog.total > 1 ? 's' : ''}
                      {daysLeft !== null
                        ? ` · ${daysLeft < 0 ? `échéance dépassée de ${-daysLeft} j` : daysLeft === 0 ? 'échéance aujourd’hui' : `J-${daysLeft}`}`
                        : ''}
                      {p.archived ? ' · archivé' : ''}
                    </div>
                    {next.length > 0 ? (
                      <ul className="ag-proj-next">
                        {next.map((t) => (
                          <li key={t.id}>
                            <i style={{ background: priorityOf(t.priority).color }} />
                            {t.title}
                          </li>
                        ))}
                      </ul>
                    ) : prog.total > 0 ? (
                      <div className="ag-proj-done">Tout est fait.</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
          {data.agenda.projects.some((p) => p.archived) ? (
            <button className="link-sm" style={{ marginTop: 12 }} onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? 'Masquer les projets archivés' : 'Voir les projets archivés'}
            </button>
          ) : null}
        </section>
      ) : null}

      {sheet || projectSheet ? null : (
      <button
        className="ag-fab"
        aria-label={tab === 'projets' ? 'Nouveau projet' : tab === 'taches' ? 'Nouvelle tâche' : 'Nouvel événement'}
        onClick={() =>
          tab === 'projets'
            ? setProjectSheet('new')
            : tab === 'taches'
              ? setSheet({ mode: 'create', type: 'task', date: today })
              : createAt(anchor)
        }
      >
        <Icon name="plus" />
      </button>
      )}
    </div>
  );
}
