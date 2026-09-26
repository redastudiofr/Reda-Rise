import type { AppData, CalTask, CompanyGoal, FinanceEntry, Project, AgendaProject } from './types';
import { monthKey, previousMonth } from './business';
import type { MonthFlow } from './finance';

/**
 * Company figures, computed from the revenue and expense entries the user
 * records. "Estimated" profit = revenue − expenses, before tax.
 */

const round2 = (v: number) => Math.round(v * 100) / 100;

export const COMPANY_COLORS = ['#4d86ea', '#c47a36', '#9a7cf0', '#4fb286', '#c47fb4', '#4bb3c4'];

export type Kpi = { ca: number; depenses: number; benefice: number; marge: number | null; count: number };

function kpiOf(entries: FinanceEntry[]): Kpi {
  let ca = 0;
  let depenses = 0;
  for (const e of entries) {
    if (e.kind === 'revenu') ca += e.amount;
    else depenses += e.amount;
  }
  const benefice = ca - depenses;
  return { ca: round2(ca), depenses: round2(depenses), benefice: round2(benefice), marge: ca > 0 ? benefice / ca : null, count: entries.length };
}

export function kpiForMonth(p: Project, month: string): Kpi {
  return kpiOf(p.entries.filter((e) => monthKey(e.date) === month));
}

export function kpiForYear(p: Project, year: string): Kpi {
  return kpiOf(p.entries.filter((e) => e.date.startsWith(year)));
}

export function kpiAll(p: Project): Kpi {
  return kpiOf(p.entries);
}

/** Cash: the recorded starting balance plus every entry from that day on. */
export function treasury(p: Project): number {
  const from = p.cashStart !== undefined && p.cashStartDate ? p.cashStartDate : '';
  const net = p.entries
    .filter((e) => e.date >= from)
    .reduce((a, e) => a + (e.kind === 'revenu' ? e.amount : -e.amount), 0);
  return round2((p.cashStart ?? 0) + net);
}

/** Revenue and expenses per month, oldest first, empty months included. */
export function companyFlows(p: Project, lastMonth: string, count: number): MonthFlow[] {
  const months = [lastMonth];
  while (months.length < count) months.unshift(previousMonth(months[0]));
  return months.map((m) => {
    const k = kpiForMonth(p, m);
    return { month: m, revenus: k.ca, depenses: k.depenses };
  });
}

/** Profit month by month, for the curve. */
export function profitSeries(p: Project, lastMonth: string, count: number): { date: string; value: number }[] {
  return companyFlows(p, lastMonth, count).map((f) => ({ date: `${f.month}-01`, value: round2(f.revenus - f.depenses) }));
}

/** Change of revenue against the previous month, as a ratio; null without a base. */
export function caTrend(p: Project, month: string): number | null {
  const now = kpiForMonth(p, month).ca;
  const before = kpiForMonth(p, previousMonth(month)).ca;
  return before > 0 ? (now - before) / before : null;
}

export function goalCurrent(g: CompanyGoal, p: Project, today: string): number {
  if (g.metric === 'custom') return g.current ?? 0;
  const k = g.period === 'mois' ? kpiForMonth(p, monthKey(today)) : kpiForYear(p, today.slice(0, 4));
  return g.metric === 'ca' ? k.ca : k.benefice;
}

export function goalRatio(g: CompanyGoal, p: Project, today: string): number {
  return g.target > 0 ? Math.max(0, goalCurrent(g, p, today)) / g.target : 0;
}

/* ---------- projets et tâches (partagés avec le calendrier) ---------- */

export function companyProjects(data: AppData, companyId: string): AgendaProject[] {
  return data.agenda.projects.filter((x) => x.companyId === companyId && !x.archived);
}

export function companyTasks(data: AppData, companyId: string): CalTask[] {
  const ids = new Set(data.agenda.projects.filter((x) => x.companyId === companyId).map((x) => x.id));
  return data.agenda.tasks.filter((t) => t.projectId && ids.has(t.projectId));
}
