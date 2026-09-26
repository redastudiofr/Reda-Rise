'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import QuickAmount from '@/components/QuickAmount';
import Curve from '@/components/Curve';
import ConfirmDialog from '@/components/ConfirmDialog';
import EntrySheet, { type EntryDraft } from '@/components/EntrySheet';
import InlineMoney from '@/components/InlineMoney';
import SubscriptionSheet, { type SubscriptionDraft } from '@/components/SubscriptionSheet';
import { compactNumber, formatDate, todayKey, uid } from '@/lib/logic';
import {
  EXPENSE_CATEGORIES,
  MONEY_METRICS,
  MONEY_RANGES,
  analyse,
  PROJECT_TYPES,
  REVENUE_CATEGORIES,
  STAGES,
  billingLabel,
  checkGoalAchievements,
  formatMoney,
  formatMoneyExact,
  formatMonth,
  hasMoneyHistory,
  investedTotal,
  moneySeries,
  monthKey,
  monthlySeries,
  projectProgress,
  projection,
  savedTotal,
  savingsDueThisMonth,
  savingsProgress,
  stageOf,
  subscriptionsMonthly,
  subscriptionsYearly,
  suggestGoalXp,
  totals,
  totalsForMonth,
  type MoneyMetricId,
  type MoneyRangeId,
} from '@/lib/business';
import { portfolioTotals } from '@/lib/invest';
import type {
  FinanceEntry,
  FinancialGoal,
  Project,
  ProjectStage,
  Subscription,
} from '@/lib/types';

/** Short euro labels for the chart gutter, so the axis never runs into the curve. */
const moneyAxis = (value: number) => `${compactNumber(value)} €`;

export default function BusinessPage() {
  const { data, update } = useData();
  const tz = data.settings.timezone;
  const today = todayKey(tz);
  const month = monthKey(today);

  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState(PROJECT_TYPES[0]);
  const [mainGoal, setMainGoal] = useState('');

  const [entryKind, setEntryKind] = useState<'revenu' | 'depense'>('revenu');
  const [entryCat, setEntryCat] = useState(REVENUE_CATEGORIES[0]);
  const [entryAmount, setEntryAmount] = useState('');
  const [subGoal, setSubGoal] = useState('');

  const [savingTarget, setSavingTarget] = useState('');

  /** Which personal-entry sheet is open — the one-screen amount + category capture. */
  const [entrySheet, setEntrySheet] = useState<'revenu' | 'depense' | null>(null);

  // Which quick add/withdraw sheet is open, if any.
  const [quick, setQuick] = useState<'epargne' | 'investissement' | null>(null);

  const [moneyMetric, setMoneyMetric] = useState<MoneyMetricId>('disponible');
  const [moneyRange, setMoneyRange] = useState<MoneyRangeId>('30j');

  const [subSheet, setSubSheet] = useState(false);
  const [subToDelete, setSubToDelete] = useState<Subscription | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<FinancialGoal | null>(null);

  const [goalLabel, setGoalLabel] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalXp, setGoalXp] = useState('');

  const personalMonth = totalsForMonth(data.finances, month);
  const monthEntries = useMemo(
    () =>
      data.finances
        .filter((e) => monthKey(e.date) === month)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.finances, month],
  );
  const insights = useMemo(
    () => analyse(data.finances, month, data.savings, data.subscriptions),
    [data.finances, month, data.savings, data.subscriptions],
  );

  const subsMonthly = subscriptionsMonthly(data.subscriptions);
  const subsYearly = subscriptionsYearly(data.subscriptions);
  /** One-off balance of the month minus the recurring charges. */
  const available = Math.round((personalMonth.benefice - subsMonthly) * 100) / 100;

  const moneyPoints = useMemo(
    () => moneySeries(data, tz, moneyMetric, moneyRange),
    [data, tz, moneyMetric, moneyRange],
  );
  const moneyPeriod =
    moneyPoints.length > 1
      ? `${formatDate(moneyPoints[0].date)} → ${formatDate(moneyPoints[moneyPoints.length - 1].date)}`
      : undefined;

  /** Records a personal entry from the capture sheet — it shows up in the list at once. */
  function addPersonal(kind: 'revenu' | 'depense', draft: EntryDraft) {
    const entry: FinanceEntry = {
      id: uid(),
      date: today,
      kind,
      category: draft.category,
      label: draft.label,
      amount: draft.amount,
    };
    update((d) => ({ ...d, finances: [entry, ...d.finances] }));
    setEntrySheet(null);
  }

  function removePersonal(id: string) {
    update((d) => ({ ...d, finances: d.finances.filter((e) => e.id !== id) }));
  }

  function addSubscription(draft: SubscriptionDraft) {
    const sub: Subscription = {
      id: uid(),
      name: draft.name,
      amount: draft.amount,
      category: draft.category,
      dayOfMonth: draft.dayOfMonth,
      createdAt: today,
    };
    update((d) => ({ ...d, subscriptions: [sub, ...d.subscriptions] }));
    setSubSheet(false);
  }

  function removeSubscription(id: string) {
    update((d) => ({ ...d, subscriptions: d.subscriptions.filter((s) => s.id !== id) }));
    setSubToDelete(null);
  }

  const projects = data.projects.filter((p) => !p.archived);

  const allEntries = useMemo(() => projects.flatMap((p) => p.entries), [projects]);
  const global = totals(allEntries);

  const saved = savedTotal(data.savings);
  const invested = investedTotal(data.investments);
  const cash = totals(data.finances).benefice;
  /** The detailed portfolio is counted apart from the simple ledger — never both. */
  const portfolio = portfolioTotals(data.investments.holdings).value;
  const patrimoine = cash + saved + invested + portfolio;

  const savingsRatio = savingsProgress(data.savings);
  const savingsDue = savingsDueThisMonth(data.savings, today);
  const savingsHistory = useMemo(
    () => [...data.savings.entries].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5),
    [data.savings.entries],
  );
  const investmentsHistory = useMemo(
    () => [...data.investments.entries].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5),
    [data.investments.entries],
  );

  function createProject() {
    if (name.trim() === '') return;
    const project: Project = {
      id: uid(),
      name: name.trim(),
      type,
      mainGoal: mainGoal.trim() || undefined,
      subGoals: [],
      createdAt: today,
      stage: 'idee',
      entries: [],
    };
    update((d) => ({ ...d, projects: [project, ...d.projects] }));
    setName('');
    setMainGoal('');
    setCreating(false);
    setOpenId(project.id);
  }

  function patch(id: string, fn: (p: Project) => Project) {
    update((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? fn(p) : p)) }));
  }

  function setStage(id: string, stage: ProjectStage) {
    patch(id, (p) => ({ ...p, stage }));
  }

  function addSubGoal(id: string) {
    if (subGoal.trim() === '') return;
    patch(id, (p) => ({
      ...p,
      subGoals: [...p.subGoals, { id: uid(), label: subGoal.trim(), done: false }],
    }));
    setSubGoal('');
  }

  function addEntry(id: string) {
    const amount = Number(entryAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const entry: FinanceEntry = {
      id: uid(),
      date: today,
      kind: entryKind,
      category: entryCat,
      amount: Math.round(amount * 100) / 100,
    };
    patch(id, (p) => ({ ...p, entries: [entry, ...p.entries] }));
    setEntryAmount('');
  }

  /** Adds (or, if negative, withdraws) money to savings and checks goals. */
  function addToSavings(amount: number) {
    update((d) => {
      const entries = [{ id: uid(), date: today, amount }, ...d.savings.entries];
      const newTotal = entries.reduce((a, e) => a + e.amount, 0);
      return {
        ...d,
        savings: { ...d.savings, entries },
        financialGoals: checkGoalAchievements(d.financialGoals, newTotal, today),
      };
    });
    setQuick(null);
  }

  function addToInvestments(amount: number) {
    update((d) => ({
      ...d,
      investments: { ...d.investments, entries: [{ id: uid(), date: today, amount }, ...d.investments.entries] },
    }));
    setQuick(null);
  }

  /**
   * Sets the savings to an exact figure. The ledger is kept intact: the
   * difference is recorded as one adjustment entry, so history and XP stay
   * consistent with the new total.
   */
  function setSavingsTotal(next: number) {
    const delta = Math.round((next - saved) * 100) / 100;
    if (delta === 0) return;
    update((d) => {
      const entries = [{ id: uid(), date: today, amount: delta }, ...d.savings.entries];
      const newTotal = entries.reduce((a, e) => a + e.amount, 0);
      return {
        ...d,
        savings: { ...d.savings, entries },
        financialGoals: checkGoalAchievements(d.financialGoals, newTotal, today),
      };
    });
  }

  function setInvestmentsTotal(next: number) {
    const delta = Math.round((next - invested) * 100) / 100;
    if (delta === 0) return;
    update((d) => ({
      ...d,
      investments: { ...d.investments, entries: [{ id: uid(), date: today, amount: delta }, ...d.investments.entries] },
    }));
  }

  function removeSavingsEntry(id: string) {
    update((d) => ({
      ...d,
      savings: { ...d.savings, entries: d.savings.entries.filter((e) => e.id !== id) },
    }));
  }

  function removeInvestmentEntry(id: string) {
    update((d) => ({
      ...d,
      investments: { ...d.investments, entries: d.investments.entries.filter((e) => e.id !== id) },
    }));
  }

  function saveTarget() {
    const target = Number(savingTarget.replace(',', '.'));
    if (!Number.isFinite(target) || target < 0) return;
    update((d) => ({
      ...d,
      savings: { ...d.savings, target: Math.round(target) },
      financialGoals: checkGoalAchievements(d.financialGoals, savedTotal(d.savings), today),
    }));
    setSavingTarget('');
  }

  function createGoal() {
    const target = Number(goalTarget.replace(',', '.'));
    if (goalLabel.trim() === '' || !Number.isFinite(target) || target <= 0) return;
    const xpParsed = Number(goalXp);
    const xp = Number.isFinite(xpParsed) && xpParsed > 0 ? Math.round(xpParsed) : suggestGoalXp(target);
    const goal: FinancialGoal = {
      id: uid(),
      label: goalLabel.trim(),
      target: Math.round(target),
      xp,
      createdAt: today,
    };
    update((d) => ({
      ...d,
      financialGoals: checkGoalAchievements([goal, ...d.financialGoals], savedTotal(d.savings), today),
    }));
    setGoalLabel('');
    setGoalTarget('');
    setGoalXp('');
  }

  function removeGoal(id: string) {
    update((d) => ({ ...d, financialGoals: d.financialGoals.filter((g) => g.id !== id) }));
    setGoalToDelete(null);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Business</h1>
          <p className="sub">
            {projects.length} projet{projects.length > 1 ? 's' : ''} · {formatMoney(global.benefice)}{' '}
            de bénéfice
          </p>
        </div>
      </header>

      {/* ---------- patrimoine ---------- */}

      <section className="section" style={{ marginTop: 4 }}>
        <h2 className="section-title">Patrimoine</h2>
        <div className="stat-row" style={{ marginTop: 0 }}>
          <div className="stat">
            <b className="mono">{formatMoney(cash)}</b>
            <span>Cash</span>
          </div>
          <div className="stat">
            <b className="mono">{formatMoney(saved)}</b>
            <span>Épargne</span>
          </div>
          <div className="stat">
            <b className="mono">{formatMoney(invested)}</b>
            <span>Investi</span>
          </div>
        </div>
        {portfolio > 0 ? (
          <div className="patrimoine-total" style={{ borderBottom: '1px solid var(--border-soft)' }}>
            <span>Portefeuille</span>
            <b className="mono">{formatMoney(portfolio)}</b>
          </div>
        ) : null}
        <div className="patrimoine-total">
          <span>Total</span>
          <b className="mono">{formatMoney(patrimoine)}</b>
        </div>

        <div className="nav-cards">
          <Link href="/entrepreneuriat/banque" className="nav-card">
            <span className="nav-card-title">Comptes bancaires</span>
            <span className="nav-card-meta">
              {data.bank.accounts.length > 0
                ? `${data.bank.accounts.length} compte${data.bank.accounts.length > 1 ? 's' : ''} · ${data.bank.transactions.length} opérations`
                : 'Suivre automatiquement les dépenses'}
            </span>
          </Link>
          <Link href="/entrepreneuriat/investir" className="nav-card">
            <span className="nav-card-title">Investissements</span>
            <span className="nav-card-meta">
              {data.investments.holdings.length > 0
                ? `${data.investments.holdings.length} position${data.investments.holdings.length > 1 ? 's' : ''} · projection`
                : 'Portefeuille et projection long terme'}
            </span>
          </Link>
        </div>
      </section>

      {/* ---------- projets ---------- */}

      <section className="section">
        <h2 className="section-title">Projets</h2>

        {projects.length === 0 && !creating ? (
          <div className="card empty">
            Aucun projet. Crée le premier — marque, e-commerce, application, agence, ce que tu veux
            faire grandir.
          </div>
        ) : null}

        {projects.map((p) => {
          const ratio = projectProgress(p);
          const stage = stageOf(p.stage);
          const t = totals(p.entries);
          const isOpen = openId === p.id;
          return (
            <div key={p.id} className="project" data-open={isOpen}>
              <button className="project-head" onClick={() => setOpenId(isOpen ? null : p.id)}>
                <span className="project-main">
                  <span className="project-name">{p.name}</span>
                  <span className="project-meta">
                    {p.type} · Niveau {stage.level} — {stage.label}
                  </span>
                </span>
                <span className="project-pct mono">{Math.round(ratio * 100)}%</span>
              </button>
              <div className="bar" style={{ marginTop: 10 }}>
                <i style={{ width: `${Math.round(ratio * 100)}%` }} />
              </div>

              {isOpen ? (
                <div className="project-body">
                  {p.mainGoal ? <div className="hint">{p.mainGoal}</div> : null}

                  <div className="field">
                    <span>Étape</span>
                    <div className="stage-row">
                      {STAGES.map((s) => (
                        <button
                          key={s.id}
                          className="stage"
                          data-on={stage.level >= s.level}
                          data-current={p.stage === s.id}
                          onClick={() => setStage(p.id, s.id)}
                        >
                          <span className="stage-level mono">{s.level}</span>
                          <span className="stage-label">{s.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="ex-meta" style={{ marginTop: 6 }}>
                      {stage.hint}
                    </div>
                  </div>

                  <div className="field">
                    <span>Objectifs du projet</span>
                    {p.subGoals.map((g) => (
                      <button
                        key={g.id}
                        className="check"
                        data-on={g.done}
                        onClick={() =>
                          patch(p.id, (x) => ({
                            ...x,
                            subGoals: x.subGoals.map((y) =>
                              y.id === g.id ? { ...y, done: !y.done } : y,
                            ),
                          }))
                        }
                      >
                        <span className="box">
                          {g.done ? (
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
                            </svg>
                          ) : null}
                        </span>
                        <span className="check-main">
                          <span className="check-label">{g.label}</span>
                        </span>
                      </button>
                    ))}
                    <div className="inline-add">
                      <input
                        className="input"
                        placeholder="Ajouter un objectif"
                        value={subGoal}
                        onChange={(e) => setSubGoal(e.target.value)}
                      />
                      <button className="btn btn-sm btn-accent" onClick={() => addSubGoal(p.id)}>
                        Ajouter
                      </button>
                    </div>
                  </div>

                  {/* finances du projet */}
                  <div className="field">
                    <span>Finances</span>
                    <div className="stat-row" style={{ marginTop: 0 }}>
                      <div className="stat">
                        <b className="mono">{formatMoney(t.revenus)}</b>
                        <span>Revenus</span>
                      </div>
                      <div className="stat">
                        <b className="mono">{formatMoney(t.depenses)}</b>
                        <span>Dépenses</span>
                      </div>
                      <div className="stat">
                        <b className="mono">{formatMoney(t.benefice)}</b>
                        <span>Bénéfice</span>
                      </div>
                    </div>

                    <div className="segmented" style={{ marginTop: 12 }}>
                      <button
                        data-on={entryKind === 'revenu'}
                        onClick={() => {
                          setEntryKind('revenu');
                          setEntryCat(REVENUE_CATEGORIES[0]);
                        }}
                      >
                        Revenu
                      </button>
                      <button
                        data-on={entryKind === 'depense'}
                        onClick={() => {
                          setEntryKind('depense');
                          setEntryCat(EXPENSE_CATEGORIES[0]);
                        }}
                      >
                        Dépense
                      </button>
                    </div>

                    <div className="chip-grid" style={{ marginTop: 10 }}>
                      {(entryKind === 'revenu' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES).map(
                        (c) => (
                          <button
                            key={c}
                            className="chip"
                            data-on={entryCat === c}
                            onClick={() => setEntryCat(c)}
                          >
                            {c}
                          </button>
                        ),
                      )}
                    </div>

                    <div className="inline-add">
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        placeholder="Montant"
                        value={entryAmount}
                        onChange={(e) => setEntryAmount(e.target.value)}
                      />
                      <button className="btn btn-sm btn-accent" onClick={() => addEntry(p.id)}>
                        Ajouter
                      </button>
                    </div>

                    {monthlySeries(p.entries).length > 0 ? (
                      <div style={{ marginTop: 12 }}>
                        {monthlySeries(p.entries)
                          .slice(-6)
                          .reverse()
                          .map((m) => (
                            <div key={m.month} className="rec">
                              <div className="ex-name">{formatMonth(m.month)}</div>
                              <div className="rec-val">
                                <b className="mono">{formatMoney(m.benefice)}</b>
                              </div>
                            </div>
                          ))}
                        {projection(p.entries) !== null ? (
                          <div className="hint" style={{ marginTop: 10 }}>
                            Sur la base des derniers mois enregistrés :{' '}
                            {formatMoney(projection(p.entries) as number)} par mois. Simple moyenne,
                            pas une prévision.
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => patch(p.id, (x) => ({ ...x, archived: true }))}
                  >
                    Archiver le projet
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {creating ? (
          <div className="card">
            <label className="field">
              <span>Nom du projet</span>
              <input
                className="input"
                placeholder="Reda Studio"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="field">
              <span>Type</span>
              <div className="chip-grid">
                {PROJECT_TYPES.map((t) => (
                  <button key={t} className="chip" data-on={type === t} onClick={() => setType(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Objectif principal</span>
              <input
                className="input"
                placeholder="Lancer la marque"
                value={mainGoal}
                onChange={(e) => setMainGoal(e.target.value)}
              />
            </label>
            <div className="grid-2" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>
                Annuler
              </button>
              <button className="btn btn-accent" onClick={createProject} disabled={name.trim() === ''}>
                Créer
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-accent add-objective" onClick={() => setCreating(true)}>
            + Nouveau projet
          </button>
        )}
      </section>

      {/* ---------- gestion de finance ---------- */}

      <section className="section">
        <h2 className="section-title">Gestion de finance · {formatMonth(month)}</h2>

        <div className="money-card">
          <div className="money-split">
            <button className="money-tap" onClick={() => setEntrySheet('revenu')}>
              <span>Gagné ce mois</span>
              <b className="mono money-in">+{formatMoneyExact(personalMonth.revenus)}</b>
            </button>
            <button className="money-tap" onClick={() => setEntrySheet('depense')}>
              <span>Dépensé ce mois</span>
              <b className="mono money-out">−{formatMoneyExact(personalMonth.depenses)}</b>
            </button>
          </div>
          {subsMonthly > 0 ? (
            <div className="money-balance" style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <span>Abonnements</span>
              <b className="mono money-out">−{formatMoneyExact(subsMonthly)}</b>
            </div>
          ) : null}
          <div className="money-balance">
            <span>Il te reste</span>
            <b className="mono" data-negative={available < 0}>
              {formatMoneyExact(available)}
            </b>
          </div>
        </div>

        <div className="money-actions">
          <button className="btn btn-accent" onClick={() => setEntrySheet('depense')}>
            + Ajouter une dépense
          </button>
          <button className="btn btn-ghost" onClick={() => setEntrySheet('revenu')}>
            + Revenu
          </button>
        </div>

        {monthEntries.length > 0 ? (
          <div className="card" style={{ marginTop: 12 }}>
            {monthEntries.map((e) => (
              <div key={e.id} className="rec">
                <div style={{ minWidth: 0 }}>
                  <div className="ex-name">{e.label || e.category}</div>
                  <div className="ex-meta">
                    {e.label ? `${e.category} · ` : ''}
                    {formatDate(e.date)}
                  </div>
                </div>
                <div className="rec-val">
                  <b className="mono" style={{ color: e.kind === 'revenu' ? '#4ec38a' : undefined }}>
                    {e.kind === 'revenu' ? '+' : '−'}
                    {formatMoneyExact(e.amount)}
                  </b>
                  <button className="btn btn-ghost btn-sm" onClick={() => removePersonal(e.id)}>
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card empty" style={{ marginTop: 12 }}>
            Rien enregistré ce mois-ci. Ajoute ta première dépense — montant, catégorie, c&apos;est
            tout.
          </div>
        )}
      </section>

      {/* ---------- courbe financière ---------- */}

      <section className="section">
        <h2 className="section-title">Évolution</h2>
        <div className="card">
          <div className="segmented">
            {MONEY_METRICS.map((m) => (
              <button
                key={m.id}
                data-on={m.id === moneyMetric}
                onClick={() => setMoneyMetric(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="pill-row" style={{ marginTop: 12 }}>
            {MONEY_RANGES.map((r) => (
              <button
                key={r.id}
                className="pill"
                data-on={r.id === moneyRange}
                onClick={() => setMoneyRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          {hasMoneyHistory(data) ? (
            <>
              <div className="chart-legend" style={{ marginTop: 14 }}>
                <b className="mono">
                  {formatMoneyExact(moneyPoints[moneyPoints.length - 1]?.value ?? 0)}
                </b>
                <span>
                  {moneyMetric === 'disponible'
                    ? 'Disponible aujourd’hui'
                    : moneyMetric === 'epargne'
                      ? 'Épargne aujourd’hui'
                      : 'Patrimoine aujourd’hui'}
                </span>
              </div>
              <Curve
                points={moneyPoints}
                periodLabel={moneyPeriod}
                format={moneyAxis}
                formatTooltip={formatMoneyExact}
                emptyLabel="Pas encore assez de mouvements sur cette période."
              />
            </>
          ) : (
            <div className="empty">
              Enregistre une dépense, un revenu ou une mise de côté : la courbe se construit toute
              seule.
            </div>
          )}
        </div>
      </section>

      {/* ---------- abonnements ---------- */}

      <section className="section">
        <h2 className="section-title">Abonnements mensuels</h2>

        {data.subscriptions.length === 0 ? (
          <div className="card empty">
            Aucun abonnement enregistré. Ajoute ceux que tu paies chaque mois pour voir ce qu&apos;ils
            te coûtent réellement.
          </div>
        ) : (
          <>
            <div className="card">
              {data.subscriptions.map((s) => {
                const billing = billingLabel(s);
                const meta = [s.category, billing].filter(Boolean).join(' · ');
                return (
                  <div key={s.id} className="subline">
                    <div className="subline-main">
                      <div className="subline-name">{s.name}</div>
                      {meta ? <div className="subline-meta">{meta}</div> : null}
                    </div>
                    <div className="subline-val">
                      <b className="mono">{formatMoneyExact(s.amount)}</b>
                      <i>/ mois</i>
                      <button
                        className="icon-btn-ghost"
                        onClick={() => setSubToDelete(s)}
                        aria-label={`Supprimer ${s.name}`}
                        title="Supprimer"
                      >
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
                          <path d="M6.6 7l.8 11.1A1.9 1.9 0 0 0 9.3 20h5.4a1.9 1.9 0 0 0 1.9-1.9L17.4 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sub-totals">
              <div className="sub-total">
                <span>Par mois</span>
                <b>{formatMoneyExact(subsMonthly)}</b>
              </div>
              <div className="sub-total">
                <span>Coût annuel estimé</span>
                <b>{formatMoneyExact(subsYearly)}</b>
              </div>
            </div>
          </>
        )}

        <button className="btn btn-accent add-objective" onClick={() => setSubSheet(true)}>
          + Ajouter un abonnement
        </button>
      </section>

      {/* ---------- analyse ---------- */}

      <section className="section">
        <h2 className="section-title">Analyse du mois</h2>
        <div className="card">
          {insights.map((i, n) => (
            <div key={n} className="insight" data-tone={i.tone}>
              <span className="insight-dot" />
              <span>{i.text}</span>
            </div>
          ))}
          <div className="ex-meta" style={{ marginTop: 12 }}>
            Observations calculées sur tes propres chiffres, sur ton appareil. Ce ne sont pas des
            conseils financiers.
          </div>
        </div>
      </section>

      {/* ---------- épargne ---------- */}

      <section className="section">
        <h2 className="section-title">Épargne</h2>
        <div className="card">
          <InlineMoney
            value={saved}
            hint={
              data.savings.target > 0
                ? `sur ${formatMoney(data.savings.target)} · tape pour modifier`
                : 'Tape le montant pour le modifier'
            }
            onSet={setSavingsTotal}
          />

          <div className="money-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setQuick('epargne')}>
              Ajouter ou retirer
            </button>
          </div>

          {data.savings.target > 0 ? (
            <>
              <div className="bar">
                <i style={{ width: `${Math.round(savingsRatio * 100)}%` }} />
              </div>
              {savingsDue ? (
                <div className="banner">Rien mis de côté ce mois-ci pour l&apos;instant.</div>
              ) : null}
            </>
          ) : (
            <div className="inline-add">
              <input
                className="input"
                type="number"
                inputMode="decimal"
                placeholder="Objectif rapide, ex. 5000"
                value={savingTarget}
                onChange={(e) => setSavingTarget(e.target.value)}
              />
              <button className="btn btn-sm btn-accent" onClick={saveTarget}>
                Définir
              </button>
            </div>
          )}

          {savingsHistory.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              {savingsHistory.map((e) => (
                <div key={e.id} className="rec">
                  <div className="ex-name">{formatDate(e.date)}</div>
                  <div className="rec-val">
                    <b className="mono" style={{ color: e.amount >= 0 ? '#4ec38a' : '#e0806f' }}>
                      {e.amount >= 0 ? '+' : ''}
                      {formatMoneyExact(e.amount)}
                    </b>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeSavingsEntry(e.id)}>
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------- investissements ---------- */}

      <section className="section">
        <h2 className="section-title">Investissements</h2>
        <div className="card">
          <InlineMoney
            value={invested}
            hint="Tape le montant pour le modifier"
            onSet={setInvestmentsTotal}
          />

          <div className="money-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setQuick('investissement')}>
              Ajouter ou retirer
            </button>
          </div>

          {investmentsHistory.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              {investmentsHistory.map((e) => (
                <div key={e.id} className="rec">
                  <div className="ex-name">{formatDate(e.date)}</div>
                  <div className="rec-val">
                    <b className="mono" style={{ color: e.amount >= 0 ? '#4ec38a' : '#e0806f' }}>
                      {e.amount >= 0 ? '+' : ''}
                      {formatMoneyExact(e.amount)}
                    </b>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeInvestmentEntry(e.id)}
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------- objectifs financiers ---------- */}

      <section className="section">
        <h2 className="section-title">Objectifs financiers</h2>

        {data.financialGoals.length === 0 ? (
          <div className="card empty">
            Fixe un objectif d&apos;épargne — atteint-le et tu gagnes de l&apos;XP.
          </div>
        ) : (
          data.financialGoals.map((g) => {
            const ratio = g.target > 0 ? Math.min(1, saved / g.target) : 0;
            return (
              <div key={g.id} className="goal" data-done={Boolean(g.achievedAt)}>
                <div className="row">
                  <div style={{ minWidth: 0 }}>
                    <div className="goal-title">{g.label}</div>
                    <div className="goal-detail">
                      {g.achievedAt
                        ? `Atteint le ${formatDate(g.achievedAt)}`
                        : `${formatMoney(saved)} sur ${formatMoney(g.target)}`}
                    </div>
                  </div>
                  <span className="xp-chip">+{g.xp} XP</span>
                </div>
                {!g.achievedAt ? (
                  <div className="bar" style={{ marginTop: 10 }}>
                    <i style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                ) : null}
                <div style={{ marginTop: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setGoalToDelete(g)}>
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })
        )}

        <div className="card" style={{ marginTop: 10 }}>
          <label className="field" style={{ marginTop: 0 }}>
            <span>Objectif</span>
            <input
              className="input"
              placeholder="Ex. Fonds d'urgence"
              value={goalLabel}
              onChange={(e) => setGoalLabel(e.target.value)}
            />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Montant</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                placeholder="5000"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
              />
            </label>
            <label className="field">
              <span>XP à la clé</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                placeholder={String(
                  suggestGoalXp(Number(goalTarget.replace(',', '.')) || 0) || 'auto',
                )}
                value={goalXp}
                onChange={(e) => setGoalXp(e.target.value)}
              />
            </label>
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              className="btn btn-accent"
              onClick={createGoal}
              disabled={goalLabel.trim() === '' || goalTarget === ''}
            >
              Fixer l&apos;objectif
            </button>
          </div>
        </div>
      </section>

      {entrySheet ? (
        <EntrySheet
          kind={entrySheet}
          onSave={(draft) => addPersonal(entrySheet, draft)}
          onClose={() => setEntrySheet(null)}
        />
      ) : null}
      {subSheet ? (
        <SubscriptionSheet onSave={addSubscription} onClose={() => setSubSheet(false)} />
      ) : null}
      {subToDelete ? (
        <ConfirmDialog
          title="Supprimer cet abonnement ?"
          detail={`${subToDelete.name} · ${formatMoneyExact(subToDelete.amount)} par mois`}
          onConfirm={() => removeSubscription(subToDelete.id)}
          onClose={() => setSubToDelete(null)}
        />
      ) : null}
      {goalToDelete ? (
        <ConfirmDialog
          title="Supprimer cet objectif ?"
          detail={goalToDelete.label}
          onConfirm={() => removeGoal(goalToDelete.id)}
          onClose={() => setGoalToDelete(null)}
        />
      ) : null}
      {quick === 'epargne' ? (
        <QuickAmount
          title="Épargne"
          allowWithdraw
          confirmLabel="Valider"
          onConfirm={addToSavings}
          onClose={() => setQuick(null)}
        />
      ) : null}
      {quick === 'investissement' ? (
        <QuickAmount
          title="Investissements"
          allowWithdraw
          confirmLabel="Valider"
          onConfirm={addToInvestments}
          onClose={() => setQuick(null)}
        />
      ) : null}
    </>
  );
}
