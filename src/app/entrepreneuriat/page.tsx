'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import CompanySheet, { type CompanyDraft } from '@/components/business/CompanySheet';
import { formatMoney, formatMoneyExact, monthKey, stageOf } from '@/lib/business';
import { caTrend, companyFlows, kpiForMonth, treasury } from '@/lib/company';
import { FLOW_COLORS } from '@/lib/finance';
import { todayKey, uid } from '@/lib/logic';
import type { Project } from '@/lib/types';

function Spark({ p, month }: { p: Project; month: string }) {
  const flows = companyFlows(p, month, 6);
  const max = Math.max(1, ...flows.flatMap((f) => [f.revenus, f.depenses]));
  return (
    <svg className="biz-spark" viewBox="0 0 120 36" aria-hidden>
      {flows.map((f, i) => {
        const x = i * 20 + 3;
        const hr = (f.revenus / max) * 32;
        const hd = (f.depenses / max) * 32;
        return (
          <g key={f.month}>
            <rect x={x} y={34 - hr} width={6} height={Math.max(hr, f.revenus > 0 ? 1.5 : 0)} rx={1.5} fill={FLOW_COLORS.revenus} />
            <rect x={x + 7} y={34 - hd} width={6} height={Math.max(hd, f.depenses > 0 ? 1.5 : 0)} rx={1.5} fill={FLOW_COLORS.depenses} />
          </g>
        );
      })}
    </svg>
  );
}

/** Every company at a glance; each opens its own dashboard. */
export default function BusinessPage() {
  const { data, update } = useData();
  const router = useRouter();
  const today = todayKey(data.settings.timezone);
  const month = monthKey(today);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const companies = data.projects.filter((p) => showArchived || !p.archived);
  const active = data.projects.filter((p) => !p.archived);
  const totals = useMemo(() => {
    let ca = 0;
    let depenses = 0;
    let cash = 0;
    for (const p of active) {
      const k = kpiForMonth(p, month);
      ca += k.ca;
      depenses += k.depenses;
      cash += treasury(p);
    }
    return { ca, depenses, benefice: ca - depenses, cash };
  }, [active, month]);

  function create(d: CompanyDraft) {
    const company: Project = { id: uid(), createdAt: today, subGoals: [], entries: [], goals: [], ...d };
    update((x) => ({ ...x, projects: [company, ...x.projects] }));
    setCreating(false);
    router.push(`/entrepreneuriat/${company.id}`);
  }

  return (
    <div className="biz">
      {creating ? (
        <CompanySheet
          initial={null}
          count={data.projects.length}
          today={today}
          onSave={create}
          onArchive={() => undefined}
          onDelete={() => undefined}
          onClose={() => setCreating(false)}
        />
      ) : null}

      <header className="topbar">
        <div>
          <h1>Business</h1>
          <p className="sub">
            {active.length} entreprise{active.length > 1 ? 's' : ''}
          </p>
        </div>
      </header>

      {active.length > 0 ? (
        <section className="biz-hero">
          <div className="fin-eyebrow">Toutes les entreprises · ce mois-ci</div>
          <div className="biz-hero-grid">
            <div>
              <span>Chiffre d’affaires</span>
              <b className="mono">{formatMoney(totals.ca)}</b>
            </div>
            <div>
              <span>Dépenses</span>
              <b className="mono">{formatMoney(totals.depenses)}</b>
            </div>
            <div>
              <span>Bénéfice estimé</span>
              <b className="mono" data-neg={totals.benefice < 0}>{formatMoney(totals.benefice)}</b>
            </div>
            <div>
              <span>Trésorerie</span>
              <b className="mono" data-neg={totals.cash < 0}>{formatMoney(totals.cash)}</b>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="row fin-head">
          <h2 className="section-title" style={{ margin: 0 }}>Entreprises</h2>
          <button className="link-sm" onClick={() => setCreating(true)}>+ Nouvelle</button>
        </div>
        {companies.length === 0 ? (
          <div className="card dash-empty">
            <b>Aucune entreprise.</b>
            <span>Crée ta première entreprise — Reda Studio, Windser… — pour suivre son CA, ses dépenses et sa trésorerie.</span>
            <button className="btn btn-accent" style={{ marginTop: 10 }} onClick={() => setCreating(true)}>Créer une entreprise</button>
          </div>
        ) : (
          <div className="biz-list">
            {companies.map((p) => {
              const k = kpiForMonth(p, month);
              const trend = caTrend(p, month);
              return (
                <Link key={p.id} href={`/entrepreneuriat/${p.id}`} className="card biz-card" style={{ ['--c' as string]: p.color ?? '#4d86ea' }} data-archived={p.archived}>
                  <div className="biz-card-top">
                    <span className="biz-avatar" aria-hidden>{p.name.slice(0, 1).toUpperCase()}</span>
                    <span className="biz-card-id">
                      <b>{p.name}</b>
                      <small>{p.type} · {stageOf(p.stage).label}{p.archived ? ' · archivée' : ''}</small>
                    </span>
                    <Spark p={p} month={month} />
                  </div>
                  <div className="biz-card-kpis">
                    <div>
                      <span>CA du mois</span>
                      <b className="mono">{formatMoneyExact(k.ca)}</b>
                      {trend !== null ? <small className="mono" data-neg={trend < 0}>{trend >= 0 ? '+' : ''}{Math.round(trend * 100)} %</small> : null}
                    </div>
                    <div>
                      <span>Bénéfice</span>
                      <b className="mono" data-neg={k.benefice < 0}>{formatMoneyExact(k.benefice)}</b>
                      {k.marge !== null ? <small className="mono">marge {Math.round(k.marge * 100)} %</small> : null}
                    </div>
                    <div>
                      <span>Trésorerie</span>
                      <b className="mono" data-neg={treasury(p) < 0}>{formatMoneyExact(treasury(p))}</b>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {data.projects.some((p) => p.archived) ? (
          <button className="link-sm" style={{ marginTop: 10 }} onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Masquer les entreprises archivées' : 'Voir les entreprises archivées'}
          </button>
        ) : null}
      </section>

      <p className="fin-disclaimer" style={{ marginTop: 16 }}>
        Business est réservé aux entreprises. Tes finances personnelles (comptes, épargne, investissements) sont dans{' '}
        <Link href="/finances" className="link-sm">Finances</Link>.
      </p>
    </div>
  );
}
