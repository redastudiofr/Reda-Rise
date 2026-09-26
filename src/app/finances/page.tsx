'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import QuickAmount from '@/components/QuickAmount';
import FlowChart from '@/components/finance/FlowChart';
import AccountSheet from '@/components/finance/AccountSheet';
import TxSheet from '@/components/finance/TxSheet';
import SubSheet from '@/components/finance/SubSheet';
import GoalSheet from '@/components/finance/GoalSheet';
import { formatShort, shiftKey, todayKey, uid } from '@/lib/logic';
import {
  checkGoalAchievements,
  expensesByCategory,
  formatMoney,
  formatMoneyExact,
  investedTotal,
  monthKey,
  previousMonth,
  savedTotal,
} from '@/lib/business';
import {
  FREQUENCIES,
  VERDICT_LABEL,
  accountType,
  analyseSubscription,
  applyEntryToAccounts,
  availableTotal,
  contribute,
  frequencyOf,
  goalProgress,
  monthlyFlows,
  monthlyNeeded,
  nextCharge,
  priceOf,
  savingsTips,
  subMonthly,
  subsMonthlyTotal,
  subsYearlyTotal,
  totalsByType,
} from '@/lib/finance';
import type { FinanceEntry, MoneyAccount, SavingsGoal, Subscription } from '@/lib/types';

type Tab = 'apercu' | 'depenses' | 'abonnements' | 'epargne';

const TABS: { id: Tab; label: string }[] = [
  { id: 'apercu', label: 'Aperçu' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'abonnements', label: 'Abonnements' },
  { id: 'epargne', label: 'Épargne' },
];

const TAB_KEY = 'telos:finances-tab';

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === 'left' ? 'M14.5 5.5 8 12l6.5 6.5' : 'M9.5 5.5 16 12l-6.5 6.5'} />
    </svg>
  );
}

export default function FinancesPage() {
  const { data, update } = useData();
  const today = todayKey(data.settings.timezone);
  const thisMonth = monthKey(today);

  const [tab, setTab] = useState<Tab>('apercu');
  const [month, setMonth] = useState(thisMonth);
  const [span, setSpan] = useState<6 | 12>(6);
  const [txFilter, setTxFilter] = useState<'tout' | 'depense' | 'revenu'>('tout');
  const [accountSheet, setAccountSheet] = useState<MoneyAccount | 'new' | null>(null);
  const [txSheet, setTxSheet] = useState<{ entry: FinanceEntry | null; kind: 'revenu' | 'depense' } | null>(null);
  const [subSheet, setSubSheet] = useState<Subscription | 'new' | null>(null);
  const [goalSheet, setGoalSheet] = useState<SavingsGoal | 'new' | null>(null);
  const [contributing, setContributing] = useState<SavingsGoal | null>(null);
  const [pot, setPot] = useState<'epargne' | 'investissement' | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved);
    } catch {
      /* preference only */
    }
  }, []);

  function changeTab(t: Tab) {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* preference only */
    }
  }

  /* ---------- chiffres ---------- */

  const accounts = data.accounts.filter((a) => !a.archived);
  const available = availableTotal(data.accounts);
  const byType = totalsByType(data.accounts);
  const monthFlow = monthlyFlows(data.finances, month, 1)[0];
  const prevFlow = monthlyFlows(data.finances, previousMonth(month), 1)[0];
  const flows = useMemo(() => monthlyFlows(data.finances, month, span), [data.finances, month, span]);
  const cats = useMemo(() => expensesByCategory(data.finances, month), [data.finances, month]);
  const catMax = Math.max(1, ...cats.map((c) => c.amount));
  const monthEntries = useMemo(
    () =>
      data.finances
        .filter((e) => monthKey(e.date) === month && (txFilter === 'tout' || e.kind === txFilter))
        .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)),
    [data.finances, month, txFilter],
  );
  const subsM = subsMonthlyTotal(data.subscriptions);
  const subsY = subsYearlyTotal(data.subscriptions);
  const upcoming = data.subscriptions
    .map((s) => ({ s, next: nextCharge(s, today) }))
    .filter((x): x is { s: Subscription; next: string } => x.next !== null && x.next <= shiftKey(today, 30))
    .sort((a, b) => a.next.localeCompare(b.next));
  const goalsSaved = data.savingsGoals.reduce((a, g) => a + g.current, 0);
  const goalsTarget = data.savingsGoals.reduce((a, g) => a + g.target, 0);
  const tips = useMemo(() => savingsTips(data, thisMonth), [data, thisMonth]);
  const accountName = (id?: string) => data.accounts.find((a) => a.id === id)?.name;
  const trend =
    prevFlow.depenses > 0 ? Math.round(((monthFlow.depenses - prevFlow.depenses) / prevFlow.depenses) * 100) : null;

  /* ---------- modifications ---------- */

  function saveAccount(v: { name: string; type: MoneyAccount['type']; bank?: string; balance: number }) {
    update((d) => {
      if (accountSheet && accountSheet !== 'new') {
        return { ...d, accounts: d.accounts.map((a) => (a.id === accountSheet.id ? { ...a, ...v, updatedAt: today } : a)) };
      }
      return { ...d, accounts: [...d.accounts, { id: uid(), ...v, createdAt: today, updatedAt: today }] };
    });
    setAccountSheet(null);
  }

  function deleteAccount(id: string) {
    update((d) => ({
      ...d,
      accounts: d.accounts.filter((a) => a.id !== id),
      finances: d.finances.map((e) => (e.accountId === id ? { ...e, accountId: undefined } : e)),
      subscriptions: d.subscriptions.map((s) => (s.accountId === id ? { ...s, accountId: undefined } : s)),
    }));
    setAccountSheet(null);
  }

  function saveEntry(v: Omit<FinanceEntry, 'id'>) {
    const old = txSheet?.entry ?? null;
    const next: FinanceEntry = { ...v, id: old?.id ?? uid() };
    update((d) => ({
      ...d,
      finances: old ? d.finances.map((e) => (e.id === old.id ? next : e)) : [next, ...d.finances],
      accounts: applyEntryToAccounts(d.accounts, old, next, today),
    }));
    if (monthKey(next.date) !== month && tab === 'depenses') setMonth(monthKey(next.date));
    setTxSheet(null);
  }

  function deleteEntry(e: FinanceEntry) {
    update((d) => ({
      ...d,
      finances: d.finances.filter((x) => x.id !== e.id),
      accounts: applyEntryToAccounts(d.accounts, e, null, today),
    }));
    setTxSheet(null);
  }

  function saveSub(v: Omit<Subscription, 'id' | 'createdAt'>) {
    update((d) => {
      if (subSheet && subSheet !== 'new') {
        return { ...d, subscriptions: d.subscriptions.map((s) => (s.id === subSheet.id ? { ...s, ...v } : s)) };
      }
      return { ...d, subscriptions: [{ id: uid(), createdAt: today, ...v }, ...d.subscriptions] };
    });
    setSubSheet(null);
  }

  function deleteSub(id: string) {
    update((d) => ({ ...d, subscriptions: d.subscriptions.filter((s) => s.id !== id) }));
    setSubSheet(null);
  }

  /** The user's own call on a subscription. Tapping the chosen one again clears it. */
  function decide(s: Subscription, decision: 'conserver' | 'resilier') {
    update((d) => ({
      ...d,
      subscriptions: d.subscriptions.map((x) =>
        x.id === s.id ? { ...x, decision: x.decision === decision ? undefined : decision } : x,
      ),
    }));
  }

  function saveGoal(v: { label: string; target: number; current: number; deadline?: string; color: string }) {
    update((d) => {
      if (goalSheet && goalSheet !== 'new') {
        return {
          ...d,
          savingsGoals: d.savingsGoals.map((g) =>
            g.id === goalSheet.id ? contribute({ ...g, ...v, current: 0 }, v.current, today) : g,
          ),
        };
      }
      const g = contribute({ id: uid(), createdAt: today, ...v, current: 0 }, v.current, today);
      return { ...d, savingsGoals: [...d.savingsGoals, g] };
    });
    setGoalSheet(null);
  }

  /** General savings pot and simple investment tracking (moved here from Business). */
  function addToPot(kind: 'epargne' | 'investissement', amount: number) {
    update((d) => {
      if (kind === 'investissement') {
        return { ...d, investments: { ...d.investments, entries: [{ id: uid(), date: today, amount }, ...d.investments.entries] } };
      }
      const entries = [{ id: uid(), date: today, amount }, ...d.savings.entries];
      return {
        ...d,
        savings: { ...d.savings, entries },
        financialGoals: checkGoalAchievements(d.financialGoals, entries.reduce((a, e) => a + e.amount, 0), today),
      };
    });
    setPot(null);
  }

  function addToGoal(goal: SavingsGoal, amount: number) {
    update((d) => ({
      ...d,
      savingsGoals: d.savingsGoals.map((g) => (g.id === goal.id ? contribute(g, amount, today) : g)),
      // Also logged as savings, like every other contribution in the app.
      savings: { ...d.savings, entries: [{ id: uid(), date: today, amount }, ...d.savings.entries] },
    }));
    setContributing(null);
  }

  return (
    <div className="fin">
      {accountSheet ? (
        <AccountSheet
          initial={accountSheet === 'new' ? null : accountSheet}
          onSave={saveAccount}
          onDelete={() => accountSheet !== 'new' && deleteAccount(accountSheet.id)}
          onClose={() => setAccountSheet(null)}
        />
      ) : null}
      {txSheet ? (
        <TxSheet
          initial={txSheet.entry}
          kind={txSheet.kind}
          today={today}
          accounts={data.accounts}
          onSave={saveEntry}
          onDelete={() => txSheet.entry && deleteEntry(txSheet.entry)}
          onClose={() => setTxSheet(null)}
        />
      ) : null}
      {subSheet ? (
        <SubSheet
          initial={subSheet === 'new' ? null : subSheet}
          accounts={data.accounts}
          onSave={saveSub}
          onDelete={() => subSheet !== 'new' && deleteSub(subSheet.id)}
          onClose={() => setSubSheet(null)}
        />
      ) : null}
      {goalSheet ? (
        <GoalSheet
          initial={goalSheet === 'new' ? null : goalSheet}
          count={data.savingsGoals.length}
          onSave={saveGoal}
          onDelete={() => {
            if (goalSheet !== 'new') update((d) => ({ ...d, savingsGoals: d.savingsGoals.filter((g) => g.id !== goalSheet.id) }));
            setGoalSheet(null);
          }}
          onClose={() => setGoalSheet(null)}
        />
      ) : null}
      {pot ? (
        <QuickAmount
          title={pot === 'epargne' ? 'Épargne générale' : 'Investissements'}
          allowWithdraw
          onConfirm={(amount) => addToPot(pot, amount)}
          onClose={() => setPot(null)}
        />
      ) : null}
      {contributing ? (
        <QuickAmount
          title={`Épargne · ${contributing.label}`}
          allowWithdraw
          onConfirm={(amount) => addToGoal(contributing, amount)}
          onClose={() => setContributing(null)}
        />
      ) : null}

      <header className="topbar">
        <div>
          <h1>Finances</h1>
          <p className="sub">Finances personnelles</p>
        </div>
      </header>

      <div className="segmented fin-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} data-on={tab === t.id} onClick={() => changeTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------- aperçu ---------- */}
      {tab === 'apercu' ? (
        <div className="fin-grid">
          <div>
            <section className="fin-hero">
              <div className="fin-eyebrow">Patrimoine disponible</div>
              <div className="fin-total mono">{formatMoneyExact(available)}</div>
              <div className="fin-hero-sub">
                {accounts.length === 0
                  ? 'Ajoute tes comptes pour voir ton total.'
                  : `${accounts.length} compte${accounts.length > 1 ? 's' : ''}`}
              </div>
              {byType.length > 0 ? (
                <div className="fin-split">
                  {byType.map((t) => {
                    const def = accountType(t.type);
                    return (
                      <span key={t.type} style={{ ['--c' as string]: def.color }}>
                        <i />
                        {def.label} <b className="mono">{formatMoney(t.amount)}</b>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </section>

            <Link href="/finances/banque" className="card fin-bank-card">
              <span>
                <b>Banque &amp; analyse</b>
                <small>
                  {data.bank.connections.length > 0
                    ? `${data.bank.connections.length} banque${data.bank.connections.length > 1 ? 's' : ''} connectée${data.bank.connections.length > 1 ? 's' : ''} · ${data.bank.transactions.length} opérations`
                    : 'Connecter une banque ou importer un relevé, puis analyser'}
                </small>
              </span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5.5 15.5 12 9 18.5" />
              </svg>
            </Link>

            <section className="section">
              <div className="row fin-head">
                <h2 className="section-title" style={{ margin: 0 }}>Comptes</h2>
                <button className="link-sm" onClick={() => setAccountSheet('new')}>+ Ajouter</button>
              </div>
              {accounts.length === 0 ? (
                <div className="card dash-empty">
                  <b>Aucun compte.</b>
                  <span>Compte bancaire, livret d’épargne, espèces… Les soldes se saisissent à la main.</span>
                  <button className="btn btn-accent" style={{ marginTop: 10 }} onClick={() => setAccountSheet('new')}>
                    Ajouter un compte
                  </button>
                </div>
              ) : (
                <div className="card fin-list">
                  {accounts.map((a) => {
                    const t = accountType(a.type);
                    return (
                      <button key={a.id} className="fin-acc" style={{ ['--c' as string]: t.color }} onClick={() => setAccountSheet(a)}>
                        <i className="fin-acc-dot" />
                        <span className="fin-acc-main">
                          <b>{a.name}</b>
                          <small>
                            {t.label}
                            {a.bank ? ` · ${a.bank}` : ''}
                          </small>
                        </span>
                        <b className="mono" data-neg={a.balance < 0}>{formatMoneyExact(a.balance)}</b>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div>
            <section className="section fin-first">
              <h2 className="section-title">Ce mois-ci · {monthLabel(thisMonth)}</h2>
              <div className="fin-kpis">
                <div>
                  <span>Revenus</span>
                  <b className="mono">+{formatMoneyExact(monthlyFlows(data.finances, thisMonth, 1)[0].revenus)}</b>
                </div>
                <div>
                  <span>Dépenses</span>
                  <b className="mono">−{formatMoneyExact(monthlyFlows(data.finances, thisMonth, 1)[0].depenses)}</b>
                </div>
                <div>
                  <span>Abonnements</span>
                  <b className="mono">−{formatMoneyExact(subsM)}</b>
                </div>
              </div>
              <div className="money-actions">
                <button className="btn btn-accent" onClick={() => setTxSheet({ entry: null, kind: 'depense' })}>+ Dépense</button>
                <button className="btn btn-ghost" onClick={() => setTxSheet({ entry: null, kind: 'revenu' })}>+ Revenu</button>
              </div>
            </section>

            <section className="section">
              <h2 className="section-title">Évolution · 6 mois</h2>
              <div className="card">
                <FlowChart flows={monthlyFlows(data.finances, thisMonth, 6)} />
              </div>
            </section>

            {data.savingsGoals.length > 0 ? (
              <section className="section">
                <div className="row fin-head">
                  <h2 className="section-title" style={{ margin: 0 }}>Épargne</h2>
                  <button className="link-sm" onClick={() => changeTab('epargne')}>Voir</button>
                </div>
                <div className="card fin-list">
                  {data.savingsGoals.slice(0, 3).map((g) => (
                    <div key={g.id} className="fin-mini-goal" style={{ ['--c' as string]: g.color }}>
                      <div className="row">
                        <span>{g.label}</span>
                        <b className="mono">{Math.round(goalProgress(g) * 100)} %</b>
                      </div>
                      <div className="bar"><i style={{ width: `${goalProgress(g) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ---------- dépenses ---------- */}
      {tab === 'depenses' ? (
        <div className="fin-grid">
          <div>
            <div className="fin-monthnav">
              <button className="fin-nav" onClick={() => setMonth(previousMonth(month))} aria-label="Mois précédent"><Arrow dir="left" /></button>
              <b>{monthLabel(month)}</b>
              <button className="fin-nav" onClick={() => setMonth(nextMonth(month))} aria-label="Mois suivant" disabled={month >= thisMonth}><Arrow dir="right" /></button>
            </div>
            <div className="fin-kpis">
              <div>
                <span>Revenus</span>
                <b className="mono">+{formatMoneyExact(monthFlow.revenus)}</b>
              </div>
              <div>
                <span>Dépenses</span>
                <b className="mono">−{formatMoneyExact(monthFlow.depenses)}</b>
                {trend !== null && trend !== 0 ? (
                  <small className="mono">{trend > 0 ? '+' : ''}{trend} % vs mois préc.</small>
                ) : null}
              </div>
              <div>
                <span>Solde</span>
                <b className="mono" data-neg={monthFlow.revenus - monthFlow.depenses < 0}>
                  {formatMoneyExact(monthFlow.revenus - monthFlow.depenses)}
                </b>
              </div>
            </div>
            <div className="money-actions">
              <button className="btn btn-accent" onClick={() => setTxSheet({ entry: null, kind: 'depense' })}>+ Dépense</button>
              <button className="btn btn-ghost" onClick={() => setTxSheet({ entry: null, kind: 'revenu' })}>+ Revenu</button>
            </div>

            <section className="section">
              <div className="row fin-head">
                <h2 className="section-title" style={{ margin: 0 }}>Évolution mensuelle</h2>
                <div className="fin-span">
                  <button data-on={span === 6} onClick={() => setSpan(6)}>6 mois</button>
                  <button data-on={span === 12} onClick={() => setSpan(12)}>12 mois</button>
                </div>
              </div>
              <div className="card">
                <FlowChart flows={flows} />
              </div>
            </section>

            <section className="section">
              <h2 className="section-title">Dépenses par catégorie</h2>
              {cats.length === 0 ? (
                <div className="card dash-empty"><span>Aucune dépense ce mois-ci.</span></div>
              ) : (
                <div className="card fin-cats">
                  {cats.map((c) => (
                    <div key={c.category} className="fin-cat">
                      <div className="row">
                        <span>{c.category}</span>
                        <span className="mono">
                          <b>{formatMoneyExact(c.amount)}</b> · {Math.round((c.amount / monthFlow.depenses) * 100)} %
                        </span>
                      </div>
                      <div className="fin-cat-bar"><i style={{ width: `${(c.amount / catMax) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="section fin-first">
            <div className="row fin-head">
              <h2 className="section-title" style={{ margin: 0 }}>Opérations · {monthEntries.length}</h2>
              <div className="fin-span">
                {(['tout', 'depense', 'revenu'] as const).map((f) => (
                  <button key={f} data-on={txFilter === f} onClick={() => setTxFilter(f)}>
                    {f === 'tout' ? 'Tout' : f === 'depense' ? 'Dépenses' : 'Revenus'}
                  </button>
                ))}
              </div>
            </div>
            {monthEntries.length === 0 ? (
              <div className="card dash-empty"><span>Rien d’enregistré pour ce filtre.</span></div>
            ) : (
              <div className="card fin-list">
                {monthEntries.map((e) => (
                  <button key={e.id} className="fin-tx" data-kind={e.kind} onClick={() => setTxSheet({ entry: e, kind: e.kind })}>
                    <span className="fin-tx-date mono">{formatShort(e.date)}</span>
                    <span className="fin-acc-main">
                      <b>{e.label || e.category}</b>
                      <small>
                        {e.label ? e.category : e.kind === 'revenu' ? 'Revenu' : 'Dépense'}
                        {accountName(e.accountId) ? ` · ${accountName(e.accountId)}` : ''}
                      </small>
                    </span>
                    <b className="mono">{e.kind === 'revenu' ? '+' : '−'}{formatMoneyExact(e.amount)}</b>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {/* ---------- abonnements ---------- */}
      {tab === 'abonnements' ? (
        <div className="fin-grid">
          <div>
            <div className="fin-kpis fin-kpis-2">
              <div>
                <span>Total mensuel</span>
                <b className="mono">{formatMoneyExact(subsM)}</b>
              </div>
              <div>
                <span>Total annuel</span>
                <b className="mono">{formatMoneyExact(subsY)}</b>
              </div>
            </div>
            <button className="btn btn-accent" style={{ marginTop: 10 }} onClick={() => setSubSheet('new')}>+ Ajouter un abonnement</button>

            <section className="section">
              <h2 className="section-title">Prochains prélèvements · 30 jours</h2>
              {upcoming.length === 0 ? (
                <div className="card dash-empty"><span>Aucun prélèvement daté dans les 30 jours.</span></div>
              ) : (
                <div className="card fin-list">
                  {upcoming.map(({ s, next }) => (
                    <div key={s.id} className="fin-tx">
                      <span className="fin-tx-date mono">{next === today ? 'Auj.' : formatShort(next)}</span>
                      <span className="fin-acc-main">
                        <b>{s.name}</b>
                        <small>{accountName(s.accountId) ?? 'Sans compte'}</small>
                      </span>
                      <b className="mono">−{formatMoneyExact(priceOf(s))}</b>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="section fin-first">
            <h2 className="section-title">Analyse · {data.subscriptions.length} abonnement{data.subscriptions.length > 1 ? 's' : ''}</h2>
            <p className="hint fin-disclaimer">
              Lecture neutre à partir de ce que tu indiques (utilisation, prix, importance, alternative). Ce sont des
              suggestions : la décision t’appartient.
            </p>
            {data.subscriptions.length === 0 ? (
              <div className="card dash-empty"><span>Aucun abonnement enregistré.</span></div>
            ) : (
              <div className="fin-subs">
                {[...data.subscriptions]
                  .sort((a, b) => subMonthly(b) - subMonthly(a))
                  .map((s) => {
                    const a = analyseSubscription(s);
                    const f = FREQUENCIES.find((x) => x.id === frequencyOf(s))!;
                    const next = nextCharge(s, today);
                    const open = openSub === s.id;
                    return (
                      <div key={s.id} className="card fin-sub" data-verdict={a.verdict ?? 'none'}>
                        <div className="row">
                          <button className="fin-sub-name" onClick={() => setSubSheet(s)}>
                            <b>{s.name}</b>
                            <small>
                              {s.category ?? 'Autre'}
                              {accountName(s.accountId) ? ` · ${accountName(s.accountId)}` : ''}
                              {next ? ` · prochain ${formatShort(next)}` : ''}
                            </small>
                          </button>
                          <span className="fin-sub-price mono">
                            <b>{formatMoneyExact(priceOf(s))}</b>
                            <small>{f.short}</small>
                          </span>
                        </div>
                        <div className="fin-sub-analysis">
                          <span>{a.headline}</span>
                          {a.costPerUse !== null ? <small className="mono">≈ {formatMoneyExact(a.costPerUse)} par utilisation</small> : null}
                        </div>
                        <div className="fin-sub-foot">
                          {a.verdict ? (
                            <span className="fin-verdict" data-v={a.verdict}>Suggestion : {VERDICT_LABEL[a.verdict]}</span>
                          ) : (
                            <button className="link-sm" onClick={() => setSubSheet(s)}>Compléter l’analyse</button>
                          )}
                          {a.reasons.length > 0 ? (
                            <button className="link-sm" onClick={() => setOpenSub(open ? null : s.id)} aria-expanded={open}>
                              {open ? 'Masquer' : 'Pourquoi ?'}
                            </button>
                          ) : null}
                        </div>
                        {open ? (
                          <ul className="fin-reasons">
                            {a.reasons.map((r) => <li key={r}>{r}</li>)}
                          </ul>
                        ) : null}
                        <div className="fin-decision" role="group" aria-label={`Ta décision pour ${s.name}`}>
                          <span>Ta décision</span>
                          <button data-on={s.decision === 'conserver'} aria-pressed={s.decision === 'conserver'} onClick={() => decide(s, 'conserver')}>Conserver</button>
                          <button data-on={s.decision === 'resilier'} aria-pressed={s.decision === 'resilier'} onClick={() => decide(s, 'resilier')}>À résilier</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {/* ---------- épargne ---------- */}
      {tab === 'epargne' ? (
        <div className="fin-grid">
          <div>
            <div className="fin-kpis fin-kpis-2">
              <div>
                <span>Mis de côté</span>
                <b className="mono">{formatMoneyExact(goalsSaved)}</b>
              </div>
              <div>
                <span>Objectifs</span>
                <b className="mono">{formatMoneyExact(goalsTarget)}</b>
              </div>
            </div>
            <button className="btn btn-accent" style={{ marginTop: 10 }} onClick={() => setGoalSheet('new')}>+ Nouvel objectif</button>

            {data.savingsGoals.length === 0 ? (
              <div className="card dash-empty" style={{ marginTop: 12 }}>
                <b>Aucun objectif d’épargne.</b>
                <span>Voyage, fonds d’urgence, permis… Fixe un montant et suis ta progression.</span>
              </div>
            ) : (
              <div className="fin-goals">
                {data.savingsGoals.map((g) => {
                  const p = goalProgress(g);
                  const need = monthlyNeeded(g, today);
                  const done = g.current >= g.target;
                  return (
                    <div key={g.id} className="card fin-goal" style={{ ['--c' as string]: g.color }} data-done={done}>
                      <div className="fin-goal-top">
                        <div className="fin-ring" style={{ ['--p' as string]: p }} role="img" aria-label={`${Math.round(p * 100)} %`}>
                          <svg viewBox="0 0 44 44" aria-hidden>
                            <circle cx="22" cy="22" r="19" className="fin-ring-track" />
                            <circle cx="22" cy="22" r="19" className="fin-ring-fill" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={2 * Math.PI * 19 * (1 - p)} />
                          </svg>
                          <b className="mono">{Math.round(p * 100)}%</b>
                        </div>
                        <button className="fin-goal-id" onClick={() => setGoalSheet(g)}>
                          <b>{g.label}</b>
                          <span className="mono">
                            Objectif : {formatMoneyExact(g.target)}
                          </span>
                          <span className="mono">
                            Actuel : <strong>{formatMoneyExact(g.current)}</strong>
                          </span>
                        </button>
                      </div>
                      <div className="bar fin-goal-bar"><i style={{ width: `${p * 100}%` }} /></div>
                      <div className="fin-goal-foot">
                        <span>
                          {done
                            ? `Objectif atteint${g.achievedAt ? ` le ${formatShort(g.achievedAt)}` : ''}.`
                            : `Reste ${formatMoneyExact(g.target - g.current)}`}
                          {need !== null ? ` · ${formatMoneyExact(need)}/mois jusqu’au ${formatShort(g.deadline!)}` : ''}
                        </span>
                        <button className="btn btn-sm btn-ghost" onClick={() => setContributing(g)}>+ Ajouter</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <section className="section fin-first">
            <h2 className="section-title">Suivi global</h2>
            <div className="card fin-list">
              <div className="fin-tx">
                <span className="fin-acc-main">
                  <b>Épargne générale</b>
                  <small>Tous les versements, objectifs compris</small>
                </span>
                <b className="mono">{formatMoneyExact(savedTotal(data.savings))}</b>
                <button className="btn btn-sm btn-ghost" onClick={() => setPot('epargne')}>±</button>
              </div>
              <div className="fin-tx">
                <span className="fin-acc-main">
                  <b>Investissements</b>
                  <small>
                    Suivi simple · <Link href="/finances/investir" className="link-sm">portefeuille détaillé</Link>
                  </small>
                </span>
                <b className="mono">{formatMoneyExact(investedTotal(data.investments))}</b>
                <button className="btn btn-sm btn-ghost" onClick={() => setPot('investissement')}>±</button>
              </div>
            </div>
            {data.financialGoals.length > 0 ? (
              <div className="card fin-list" style={{ marginTop: 10 }}>
                <div className="fi-sub-h" style={{ paddingTop: 10 }}>Objectifs financiers (épargne générale)</div>
                {data.financialGoals.map((g) => {
                  const p = Math.min(1, Math.max(0, savedTotal(data.savings) / g.target));
                  return (
                    <div key={g.id} className="fin-mini-goal" style={{ ['--c' as string]: '#4fb286' }}>
                      <div className="row">
                        <span>{g.label}</span>
                        <b className="mono">{g.achievedAt ? 'Atteint' : `${Math.round(p * 100)} %`}</b>
                      </div>
                      <div className="bar"><i style={{ width: `${p * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="section">
            <h2 className="section-title">Pistes pour épargner</h2>
            <div className="card fin-tips">
              <ul>
                {tips.map((t) => <li key={t.id}>{t.text}</li>)}
              </ul>
              <p className="fin-disclaimer">
                Idées générales pour t’aider à épargner, calculées à partir de tes propres chiffres. Ce n’est pas un
                conseil financier personnalisé.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
