'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import FlowChart from '@/components/finance/FlowChart';
import ProgressChart from '@/components/ProgressChart';
import CompanySheet, { type CompanyDraft } from '@/components/business/CompanySheet';
import CompanyEntrySheet from '@/components/business/CompanyEntrySheet';
import CompanyGoalSheet from '@/components/business/CompanyGoalSheet';
import ProjectSheet from '@/components/agenda/ProjectSheet';
import ItemSheet, { type SheetResult } from '@/components/agenda/ItemSheet';
import TaskRow from '@/components/agenda/TaskRow';
import { formatMoney, formatMoneyExact, monthKey, previousMonth, stageOf, STAGES } from '@/lib/business';
import {
  companyFlows,
  companyProjects,
  companyTasks,
  goalCurrent,
  goalRatio,
  kpiForMonth,
  kpiForYear,
  profitSeries,
  treasury,
} from '@/lib/company';
import { priorityOf, projectProgress } from '@/lib/agenda';
import { formatShort, todayKey, uid } from '@/lib/logic';
import type { AgendaProject, CalTask, CompanyGoal, FinanceEntry, Project } from '@/lib/types';

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)} %`);

/** One company's dashboard: figures, charts, goals, projects, tasks and entries. */
export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, update } = useData();
  const today = todayKey(data.settings.timezone);
  const company = data.projects.find((p) => p.id === id);

  const [month, setMonth] = useState(monthKey(today));
  const [span, setSpan] = useState<6 | 12>(6);
  const [editing, setEditing] = useState(false);
  const [entrySheet, setEntrySheet] = useState<{ entry: FinanceEntry | null; kind: 'revenu' | 'depense' } | null>(null);
  const [goalSheet, setGoalSheet] = useState<CompanyGoal | 'new' | null>(null);
  const [projectSheet, setProjectSheet] = useState<AgendaProject | 'new' | null>(null);
  const [taskSheet, setTaskSheet] = useState<CalTask | null>(null);
  const [quickTask, setQuickTask] = useState('');
  const [quickProject, setQuickProject] = useState('');
  const [newStep, setNewStep] = useState('');

  const flows = useMemo(() => (company ? companyFlows(company, month, span) : []), [company, month, span]);
  const profit = useMemo(() => (company ? profitSeries(company, month, span) : []), [company, month, span]);

  if (!company) {
    return (
      <div className="biz">
        <header className="topbar">
          <div>
            <h1>Entreprise introuvable</h1>
            <p className="sub">Elle a peut-être été supprimée.</p>
          </div>
        </header>
        <Link href="/entrepreneuriat" className="btn btn-accent">Retour au Business</Link>
      </div>
    );
  }
  const c: Project = company;

  const k = kpiForMonth(c, month);
  const prev = kpiForMonth(c, previousMonth(month));
  const year = kpiForYear(c, month.slice(0, 4));
  const cash = treasury(c);
  const projects = companyProjects(data, c.id);
  const tasks = companyTasks(data, c.id);
  const openTasks = tasks
    .filter((t) => t.status !== 'termine')
    .sort((a, b) => priorityOf(a.priority).rank - priorityOf(b.priority).rank || (a.date ?? '9').localeCompare(b.date ?? '9'));
  const entries = c.entries.filter((e) => monthKey(e.date) === month).sort((a, b) => (a.date < b.date ? 1 : -1));
  const isCurrent = month === monthKey(today);
  const delta = (now: number, before: number) =>
    before !== 0 ? `${now >= before ? '+' : '−'}${Math.abs(Math.round(((now - before) / Math.abs(before)) * 100))} %` : null;

  function patch(fn: (p: Project) => Project) {
    update((d) => ({ ...d, projects: d.projects.map((p) => (p.id === c.id ? fn(p) : p)) }));
  }

  function saveCompany(v: CompanyDraft) {
    patch((p) => ({ ...p, ...v }));
    setEditing(false);
  }

  function deleteCompany() {
    update((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== c.id),
      agenda: { ...d.agenda, projects: d.agenda.projects.map((x) => (x.companyId === c.id ? { ...x, companyId: undefined } : x)) },
    }));
    router.push('/entrepreneuriat');
  }

  function saveEntry(v: Omit<FinanceEntry, 'id'>) {
    const old = entrySheet?.entry;
    patch((p) => ({
      ...p,
      entries: old ? p.entries.map((e) => (e.id === old.id ? { ...v, id: old.id } : e)) : [{ ...v, id: uid() }, ...p.entries],
    }));
    if (monthKey(v.date) !== month) setMonth(monthKey(v.date));
    setEntrySheet(null);
  }

  function saveGoal(v: Omit<CompanyGoal, 'id' | 'createdAt'>) {
    patch((p) => {
      const goals = p.goals ?? [];
      return {
        ...p,
        goals: goalSheet && goalSheet !== 'new'
          ? goals.map((g) => (g.id === goalSheet.id ? { ...g, ...v } : g))
          : [...goals, { ...v, id: uid(), createdAt: today }],
      };
    });
    setGoalSheet(null);
  }

  function patchAgenda(fn: (a: typeof data.agenda) => typeof data.agenda) {
    update((d) => ({ ...d, agenda: fn(d.agenda) }));
  }

  function toggleTask(t: CalTask) {
    const done = t.status === 'termine';
    patchAgenda((a) => ({
      ...a,
      tasks: a.tasks.map((x) => (x.id === t.id ? { ...x, status: done ? 'a-faire' : 'termine', doneAt: done ? undefined : today } : x)),
    }));
  }

  function addQuickTask() {
    const title = quickTask.trim();
    const projectId = quickProject || projects[0]?.id;
    if (!title || !projectId) return;
    patchAgenda((a) => ({
      ...a,
      tasks: [...a.tasks, { id: uid(), title, projectId, priority: 'normale', status: 'a-faire', category: 'entrepreneuriat', reminders: [], createdAt: today }],
    }));
    setQuickTask('');
  }

  function addStep() {
    if (!newStep.trim()) return;
    patch((p) => ({ ...p, subGoals: [...p.subGoals, { id: uid(), label: newStep.trim(), done: false }] }));
    setNewStep('');
  }

  return (
    <div className="biz" style={{ ['--c' as string]: c.color ?? '#4d86ea' }}>
      {editing ? (
        <CompanySheet
          initial={c}
          count={data.projects.length}
          today={today}
          onSave={saveCompany}
          onArchive={() => {
            patch((p) => ({ ...p, archived: !p.archived }));
            setEditing(false);
          }}
          onDelete={deleteCompany}
          onClose={() => setEditing(false)}
        />
      ) : null}
      {entrySheet ? (
        <CompanyEntrySheet
          initial={entrySheet.entry}
          kind={entrySheet.kind}
          today={today}
          onSave={saveEntry}
          onDelete={() => {
            const old = entrySheet.entry;
            if (old) patch((p) => ({ ...p, entries: p.entries.filter((e) => e.id !== old.id) }));
            setEntrySheet(null);
          }}
          onClose={() => setEntrySheet(null)}
        />
      ) : null}
      {goalSheet ? (
        <CompanyGoalSheet
          initial={goalSheet === 'new' ? null : goalSheet}
          onSave={saveGoal}
          onDelete={() => {
            if (goalSheet !== 'new') patch((p) => ({ ...p, goals: (p.goals ?? []).filter((g) => g.id !== goalSheet.id) }));
            setGoalSheet(null);
          }}
          onClose={() => setGoalSheet(null)}
        />
      ) : null}
      {projectSheet && !taskSheet ? (
        <ProjectSheet
          data={data}
          project={projectSheet === 'new' ? null : (data.agenda.projects.find((p) => p.id === projectSheet.id) ?? projectSheet)}
          today={today}
          onSaveProject={(p) => {
            const withCompany = { ...p, companyId: c.id };
            patchAgenda((a) => ({
              ...a,
              projects: a.projects.some((x) => x.id === p.id) ? a.projects.map((x) => (x.id === p.id ? withCompany : x)) : [...a.projects, withCompany],
            }));
            if (projectSheet === 'new') setProjectSheet(withCompany);
          }}
          onDeleteProject={(p, withTasks) => {
            patchAgenda((a) => ({
              ...a,
              projects: a.projects.filter((x) => x.id !== p.id),
              tasks: withTasks ? a.tasks.filter((t) => t.projectId !== p.id) : a.tasks.map((t) => (t.projectId === p.id ? { ...t, projectId: undefined } : t)),
            }));
            setProjectSheet(null);
          }}
          onAddTask={(t) => patchAgenda((a) => ({ ...a, tasks: [...a.tasks, { ...t, category: 'entrepreneuriat' }] }))}
          onToggleTask={toggleTask}
          onOpenTask={(t) => setTaskSheet(t)}
          onClose={() => setProjectSheet(null)}
        />
      ) : null}
      {taskSheet ? (
        <ItemSheet
          target={{ mode: 'edit', type: 'task', task: taskSheet }}
          today={today}
          projects={data.agenda.projects}
          onSave={(r: SheetResult) => {
            if (r.type === 'task') patchAgenda((a) => ({ ...a, tasks: a.tasks.map((t) => (t.id === r.task.id ? r.task : t)) }));
            setTaskSheet(null);
          }}
          onDelete={() => {
            patchAgenda((a) => ({ ...a, tasks: a.tasks.filter((t) => t.id !== taskSheet.id) }));
            setTaskSheet(null);
          }}
          onClose={() => setTaskSheet(null)}
        />
      ) : null}

      <header className="topbar biz-top">
        <div className="biz-title">
          <Link href="/entrepreneuriat" className="link-sm">← Business</Link>
          <h1>{c.name}</h1>
          <p className="sub">
            {c.type} · {stageOf(c.stage).label}
            {c.archived ? ' · archivée' : ''}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Modifier</button>
      </header>

      <div className="bk-monthnav">
        <button className="fin-nav" onClick={() => setMonth(previousMonth(month))} aria-label="Mois précédent">‹</button>
        <b>{monthLabel(month)}</b>
        <button className="fin-nav" onClick={() => setMonth(nextMonth(month))} aria-label="Mois suivant" disabled={isCurrent}>›</button>
      </div>

      <div className="biz-kpis">
        <div className="biz-kpi">
          <span>Chiffre d’affaires</span>
          <b className="mono">{formatMoneyExact(k.ca)}</b>
          {delta(k.ca, prev.ca) ? <small className="mono" data-neg={k.ca < prev.ca}>{delta(k.ca, prev.ca)} vs mois préc.</small> : null}
        </div>
        <div className="biz-kpi">
          <span>Dépenses</span>
          <b className="mono">{formatMoneyExact(k.depenses)}</b>
          {delta(k.depenses, prev.depenses) ? <small className="mono">{delta(k.depenses, prev.depenses)} vs mois préc.</small> : null}
        </div>
        <div className="biz-kpi">
          <span>Bénéfice estimé</span>
          <b className="mono" data-neg={k.benefice < 0}>{formatMoneyExact(k.benefice)}</b>
          <small>avant impôts</small>
        </div>
        <div className="biz-kpi">
          <span>Marge</span>
          <b className="mono" data-neg={(k.marge ?? 0) < 0}>{pct(k.marge)}</b>
          <small className="mono">année : {pct(year.marge)}</small>
        </div>
        <div className="biz-kpi biz-kpi-wide">
          <span>Trésorerie</span>
          <b className="mono" data-neg={cash < 0}>{formatMoneyExact(cash)}</b>
          <small>
            {c.cashStart !== undefined && c.cashStartDate
              ? `depuis ${formatMoney(c.cashStart)} au ${formatShort(c.cashStartDate)}`
              : 'somme des opérations — ajoute la trésorerie de départ dans Modifier'}
          </small>
        </div>
      </div>
      <div className="money-actions">
        <button className="btn btn-accent" onClick={() => setEntrySheet({ entry: null, kind: 'revenu' })}>+ Chiffre d’affaires</button>
        <button className="btn btn-ghost" onClick={() => setEntrySheet({ entry: null, kind: 'depense' })}>+ Dépense</button>
      </div>

      <div className="biz-grid">
        <div>
          <section className="section">
            <div className="row fin-head">
              <h2 className="section-title" style={{ margin: 0 }}>Évolution</h2>
              <div className="fin-span">
                <button data-on={span === 6} onClick={() => setSpan(6)}>6 mois</button>
                <button data-on={span === 12} onClick={() => setSpan(12)}>12 mois</button>
              </div>
            </div>
            <div className="card">
              <FlowChart flows={flows} labels={{ revenus: 'Chiffre d’affaires', depenses: 'Dépenses' }} />
            </div>
          </section>
          <section className="section">
            <h2 className="section-title">Bénéfice mensuel</h2>
            <div className="card">
              <ProgressChart
                points={profit}
                format={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}k` : String(Math.round(v)))}
                formatTooltip={(v) => formatMoneyExact(v)}
                height={170}
                emptyLabel="Le bénéfice apparaît dès deux mois d’activité."
              />
            </div>
          </section>

          <section className="section">
            <div className="row fin-head">
              <h2 className="section-title" style={{ margin: 0 }}>Objectifs</h2>
              <button className="link-sm" onClick={() => setGoalSheet('new')}>+ Objectif</button>
            </div>
            {(c.goals ?? []).length === 0 ? (
              <div className="card dash-empty"><span>Fixe un objectif de CA, de bénéfice ou autre (clients, ventes…).</span></div>
            ) : (
              <div className="card biz-goals">
                {(c.goals ?? []).map((g) => {
                  const r = goalRatio(g, c, today);
                  const cur = goalCurrent(g, c, today);
                  return (
                    <button key={g.id} className="biz-goal" onClick={() => setGoalSheet(g)} data-done={r >= 1}>
                      <div className="row">
                        <span>{g.label}</span>
                        <b className="mono">{Math.round(r * 100)} %</b>
                      </div>
                      <div className="bar"><i style={{ width: `${Math.min(1, r) * 100}%` }} /></div>
                      <small className="mono">
                        {g.metric === 'custom' ? `${cur} / ${g.target}` : `${formatMoneyExact(cur)} / ${formatMoneyExact(g.target)}`}
                        {' · '}
                        {g.period === 'mois' ? 'ce mois-ci' : 'cette année'}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="card biz-steps">
              <div className="fi-sub-h">Étapes · {stageOf(c.stage).label}</div>
              <div className="biz-stage">
                {STAGES.map((s) => (
                  <button key={s.id} data-on={s.level <= stageOf(c.stage).level} onClick={() => patch((p) => ({ ...p, stage: s.id }))} title={s.hint} aria-label={`Stade ${s.label}`}>
                    <i />
                    <small>{s.label}</small>
                  </button>
                ))}
              </div>
              {c.subGoals.map((g) => (
                <button key={g.id} className="check" data-on={g.done} onClick={() => patch((p) => ({ ...p, subGoals: p.subGoals.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)) }))}>
                  <span className="box">{g.done ? '✓' : null}</span>
                  <span className="check-main"><span className="check-label">{g.label}</span></span>
                </button>
              ))}
              <div className="ag-quickadd">
                <input className="input" value={newStep} placeholder="Nouvelle étape, puis Entrée" onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addStep()} aria-label="Nouvelle étape" />
              </div>
            </div>
          </section>
        </div>

        <div>
          <section className="section">
            <div className="row fin-head">
              <h2 className="section-title" style={{ margin: 0 }}>Projets · {projects.length}</h2>
              <button className="link-sm" onClick={() => setProjectSheet('new')}>+ Projet</button>
            </div>
            {projects.length === 0 ? (
              <div className="card dash-empty"><span>Un projet regroupe des tâches — ex. « Lancement collection hiver ». Il apparaît aussi dans le calendrier.</span></div>
            ) : (
              <div className="ag-proj-grid" style={{ marginTop: 0 }}>
                {projects.map((p) => {
                  const pr = projectProgress(data, p.id);
                  return (
                    <button key={p.id} className="ag-proj card" style={{ ['--pc' as string]: p.color }} onClick={() => setProjectSheet(p)}>
                      <div className="row">
                        <b className="ag-proj-title">{p.title}</b>
                        <span className="mono ag-proj-pct">{Math.round(pr.ratio * 100)} %</span>
                      </div>
                      <div className="bar"><i style={{ width: `${pr.ratio * 100}%` }} /></div>
                      <div className="ag-proj-meta">{pr.done} / {pr.total} tâche{pr.total > 1 ? 's' : ''}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="section">
            <h2 className="section-title">Tâches · {openTasks.length} à faire</h2>
            {projects.length > 0 ? (
              <div className="ag-quickadd" style={{ marginTop: 0 }}>
                <input className="input" value={quickTask} placeholder="Nouvelle tâche, puis Entrée" onChange={(e) => setQuickTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addQuickTask()} aria-label="Nouvelle tâche de l’entreprise" />
                {projects.length > 1 ? (
                  <select className="input biz-proj-select" value={quickProject || projects[0].id} onChange={(e) => setQuickProject(e.target.value)} aria-label="Projet">
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                ) : null}
              </div>
            ) : null}
            {openTasks.length === 0 ? (
              <div className="card dash-empty"><span>{projects.length === 0 ? 'Crée un projet pour y ajouter des tâches.' : 'Aucune tâche en cours.'}</span></div>
            ) : (
              <div className="card ag-tasklist">
                {openTasks.slice(0, 12).map((t) => (
                  <TaskRow key={t.id} task={t} today={today} project={data.agenda.projects.find((p) => p.id === t.projectId)} onToggle={() => toggleTask(t)} onOpen={() => setTaskSheet(t)} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2 className="section-title">Opérations · {monthLabel(month)}</h2>
            {entries.length === 0 ? (
              <div className="card dash-empty"><span>Aucune opération ce mois-ci.</span></div>
            ) : (
              <div className="card fin-list">
                {entries.map((e) => (
                  <button key={e.id} className="fin-tx" data-kind={e.kind} onClick={() => setEntrySheet({ entry: e, kind: e.kind })}>
                    <span className="fin-tx-date mono">{formatShort(e.date)}</span>
                    <span className="fin-acc-main">
                      <b>{e.label || e.category}</b>
                      <small>{e.label ? e.category : e.kind === 'revenu' ? 'Chiffre d’affaires' : 'Dépense'}</small>
                    </span>
                    <b className="mono">{e.kind === 'revenu' ? '+' : '−'}{formatMoneyExact(e.amount)}</b>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
