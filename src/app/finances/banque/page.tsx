'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/components/DataProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import FlowChart from '@/components/finance/FlowChart';
import { formatDate, formatShort, todayKey, uid } from '@/lib/logic';
import { formatMoneyExact, monthKey, previousMonth } from '@/lib/business';
import {
  SPEND_CATEGORIES,
  accountsTotal,
  categoryColor,
  categoryLabel,
  mergeSync,
  spendByCategory,
  type BankStatus,
  type SyncPayload,
} from '@/lib/bank';
import { bankMonthlyFlows, monthTotals, savingsRatio, topExpenses, weekTotals } from '@/lib/bankAnalysis';
import { dedupeAgainst, parseTransactionsCsv, type ImportResult } from '@/lib/bankImport';
import type { BankAccount, BankAccountKind, BankConnection, BankTransaction, SpendCategory } from '@/lib/types';

const ACCOUNT_KINDS: { id: BankAccountKind; label: string }[] = [
  { id: 'courant', label: 'Compte courant' },
  { id: 'epargne', label: 'Épargne' },
  { id: 'carte', label: 'Carte' },
  { id: 'titres', label: 'Titres' },
  { id: 'autre', label: 'Autre' },
];

const COUNTRIES = [
  { id: 'FR', label: 'France' },
  { id: 'BE', label: 'Belgique' },
  { id: 'LU', label: 'Luxembourg' },
  { id: 'DE', label: 'Allemagne' },
  { id: 'ES', label: 'Espagne' },
  { id: 'IT', label: 'Italie' },
  { id: 'NL', label: 'Pays-Bas' },
  { id: 'PT', label: 'Portugal' },
];

/** What the bank redirect reports, in plain words. Never shows a raw provider error. */
const RETURN_MESSAGES: Record<string, string> = {
  connected: 'Banque connectée. Récupération des comptes…',
  state: 'Le retour de la banque n’a pas pu être vérifié (lien expiré ou ouvert dans un autre navigateur). Recommence la connexion.',
  refused: 'La connexion a été annulée ou refusée sur le site de la banque. Rien n’a été enregistré.',
  not_ready: 'La connexion bancaire n’est pas disponible sur ce déploiement.',
  consent_expired: 'La banque a refusé la session. Recommence la connexion.',
  unauthorized: 'Le fournisseur bancaire a refusé l’accès. Vérifie la configuration de l’application.',
  rate_limited: 'Trop de demandes auprès de la banque. Réessaie dans quelques minutes.',
  network: 'Le fournisseur bancaire est injoignable. Réessaie plus tard.',
  timeout: 'La banque n’a pas répondu à temps. Réessaie plus tard.',
  bad_request: 'La banque a refusé la demande. Recommence la connexion.',
  provider: 'Le fournisseur bancaire rencontre un problème. Réessaie plus tard.',
};

type StatusState = { kind: 'loading' } | { kind: 'ready'; status: BankStatus } | { kind: 'error' };

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

export default function BankPage() {
  const { data, update } = useData();
  const today = todayKey(data.settings.timezone);
  const bank = data.bank;

  const [status, setStatus] = useState<StatusState>({ kind: 'loading' });
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [country, setCountry] = useState('FR');
  const [institutions, setInstitutions] = useState<{ name: string; logo?: string }[] | null>(null);
  const [instError, setInstError] = useState('');
  const [instQuery, setInstQuery] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  /** Logos that failed to load fall back to the bank's initial. */
  const [brokenLogos, setBrokenLogos] = useState<Set<string>>(() => new Set());
  const [toDisconnect, setToDisconnect] = useState<BankConnection | null>(null);

  const [month, setMonth] = useState(monthKey(today));
  const [span, setSpan] = useState<6 | 12>(6);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [targetDraft, setTargetDraft] = useState<string | null>(null);

  const [addingAccount, setAddingAccount] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountKind, setAccountKind] = useState<BankAccountKind>('courant');
  const [accountBalance, setAccountBalance] = useState('');
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importTarget, setImportTarget] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<BankTransaction | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);

  const ready = status.kind === 'ready' && status.status.implemented && status.status.blockers.length === 0;

  /* ---------- synchronisation ---------- */

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/bank/sync', { method: 'POST', cache: 'no-store' });
      const json = (await res.json()) as SyncPayload & { message?: string; unreadable?: number };
      if (!res.ok) {
        setNotice({ tone: 'warn', text: json.message ?? 'La synchronisation a échoué.' });
        return;
      }
      update((d) => ({ ...d, bank: mergeSync(d.bank, json) }));
      const failed = json.connections.filter((c) => c.error);
      setNotice(
        failed.length > 0
          ? { tone: 'warn', text: failed.map((c) => `${c.institution} : ${c.error}`).join(' ') }
          : { tone: 'ok', text: `Synchronisé · ${json.transactions.length} opération${json.transactions.length > 1 ? 's' : ''} reçue${json.transactions.length > 1 ? 's' : ''}.` },
      );
    } catch {
      setNotice({ tone: 'warn', text: 'Réseau indisponible : la synchronisation n’a pas pu se faire.' });
    } finally {
      setSyncing(false);
    }
  }, [update]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/bank/status', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as BankStatus;
        if (cancelled) return;
        setStatus({ kind: 'ready', status: json });
        // Back from the bank: say how it went, drop the query, then fetch the accounts.
        const q = new URLSearchParams(window.location.search);
        const outcome = q.get('bank');
        if (outcome) {
          window.history.replaceState(null, '', window.location.pathname);
          if (outcome === 'connected') {
            setNotice({ tone: 'ok', text: RETURN_MESSAGES.connected });
            void sync();
          } else {
            setNotice({ tone: 'warn', text: RETURN_MESSAGES[q.get('reason') ?? ''] ?? RETURN_MESSAGES.provider });
          }
        }
      } catch {
        if (!cancelled) setStatus({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sync]);

  async function openPicker(c = country) {
    setPicker(true);
    setInstitutions(null);
    setInstError('');
    try {
      const res = await fetch(`/api/bank/institutions?country=${c}`, { cache: 'no-store' });
      const json = (await res.json()) as { institutions?: { name: string; logo?: string }[]; message?: string };
      if (!res.ok) throw new Error(json.message ?? 'Liste des banques indisponible.');
      setInstitutions(json.institutions ?? []);
    } catch (err) {
      setInstError(err instanceof Error ? err.message : 'Liste des banques indisponible.');
    }
  }

  async function connect(institution: string) {
    setConnecting(institution);
    try {
      const res = await fetch('/api/bank/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ institution, country }),
      });
      const json = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !json.url) throw new Error(json.message ?? 'La connexion n’a pas pu démarrer.');
      // Off to the bank's own page: credentials are typed there, never here.
      window.location.assign(json.url);
    } catch (err) {
      setInstError(err instanceof Error ? err.message : 'La connexion n’a pas pu démarrer.');
      setConnecting(null);
    }
  }

  async function disconnect(c: BankConnection, keepHistory: boolean) {
    setToDisconnect(null);
    let revoked = false;
    try {
      const res = await fetch('/api/bank/disconnect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId: c.id }),
      });
      revoked = Boolean(((await res.json()) as { revoked?: boolean }).revoked);
    } catch {
      /* removed locally below; the server link is retried on the next visit */
    }
    update((d) => {
      const ids = new Set(d.bank.accounts.filter((a) => a.connectionId === c.id).map((a) => a.id));
      return {
        ...d,
        bank: {
          ...d.bank,
          connections: d.bank.connections.filter((x) => x.id !== c.id),
          // History kept: the accounts stay, detached from the bank.
          accounts: keepHistory
            ? d.bank.accounts.map((a) => (a.connectionId === c.id ? { ...a, connectionId: '' } : a))
            : d.bank.accounts.filter((a) => !ids.has(a.id)),
          transactions: keepHistory ? d.bank.transactions : d.bank.transactions.filter((t) => !ids.has(t.accountId)),
        },
      };
    });
    setNotice({ tone: 'ok', text: `${c.institution} déconnectée${revoked ? ' et autorisation retirée chez le fournisseur' : ''}.` });
  }

  /* ---------- comptes et import CSV (inchangés) ---------- */

  function addAccount() {
    if (accountName.trim() === '') return;
    const parsed = Number(accountBalance.replace(',', '.'));
    const account: BankAccount = {
      id: uid(),
      connectionId: '',
      name: accountName.trim(),
      kind: accountKind,
      balance: Number.isFinite(parsed) && accountBalance.trim() !== '' ? parsed : undefined,
      currency: 'EUR',
      updatedAt: today,
    };
    update((d) => ({ ...d, bank: { ...d.bank, accounts: [...d.bank.accounts, account] } }));
    setAccountName('');
    setAccountBalance('');
    setAddingAccount(false);
  }

  function removeAccount(id: string) {
    update((d) => ({
      ...d,
      bank: {
        ...d.bank,
        accounts: d.bank.accounts.filter((a) => a.id !== id),
        transactions: d.bank.transactions.filter((t) => t.accountId !== id),
      },
    }));
    if (accountId === id) setAccountId(null);
    setAccountToDelete(null);
  }

  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !importTarget) return;
    setPreview(parseTransactionsCsv(await file.text(), importTarget));
  }

  function confirmImport() {
    if (!preview) return;
    update((d) => ({
      ...d,
      bank: {
        ...d.bank,
        transactions: [...d.bank.transactions, ...dedupeAgainst(preview.transactions, d.bank.transactions)],
      },
    }));
    setPreview(null);
    setImportTarget(null);
  }

  function setCategory(id: string, category: SpendCategory) {
    update((d) => ({
      ...d,
      bank: { ...d.bank, transactions: d.bank.transactions.map((t) => (t.id === id ? { ...t, category, manualCategory: true } : t)) },
    }));
    setEditing(null);
  }

  function removeTransaction(id: string) {
    update((d) => ({ ...d, bank: { ...d.bank, transactions: d.bank.transactions.filter((t) => t.id !== id) } }));
    setEditing(null);
  }

  function saveTarget() {
    const n = Number((targetDraft ?? '').replace(/\s/g, '').replace(',', '.'));
    update((d) => ({ ...d, monthlySavingsTarget: Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0 }));
    setTargetDraft(null);
  }

  /* ---------- analyse ---------- */

  const txs = useMemo(
    () => (accountId ? bank.transactions.filter((t) => t.accountId === accountId) : bank.transactions),
    [bank.transactions, accountId],
  );
  const mt = useMemo(() => monthTotals(txs, month), [txs, month]);
  const prev = useMemo(() => monthTotals(txs, previousMonth(month)), [txs, month]);
  const wk = useMemo(() => weekTotals(txs, today), [txs, today]);
  const flows = useMemo(() => bankMonthlyFlows(txs, month, span), [txs, month, span]);
  const cats = useMemo(
    () => spendByCategory(txs, { from: `${month}-01`, to: `${month}-31`, label: month }),
    [txs, month],
  );
  const top = useMemo(() => topExpenses(txs, month, 5), [txs, month]);
  const target = data.monthlySavingsTarget;
  const ratio = savingsRatio(mt.saved, target);
  const monthTxs = txs.filter((t) => monthKey(t.date) === month).sort((a, b) => (a.date < b.date ? 1 : -1));
  const isCurrent = month === monthKey(today);
  const totalBalance = accountsTotal(bank.accounts);
  const catMax = Math.max(1, ...cats.map((c) => c.amount));
  const connectionOf = (id: string) => bank.connections.find((c) => c.id === id);
  const shownInstitutions = (institutions ?? []).filter((i) =>
    i.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(
      instQuery.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
    ),
  );

  return (
    <div className="bk">
      <header className="topbar">
        <div>
          <h1>Banque &amp; analyse</h1>
          <p className="sub">
            {bank.accounts.length} compte{bank.accounts.length > 1 ? 's' : ''} · {bank.transactions.length} opération
            {bank.transactions.length > 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/finances" className="link-sm">
          Finances
        </Link>
      </header>

      {notice ? (
        <div className={`banner ${notice.tone === 'warn' ? 'warn' : 'ok'} bk-notice`} role="status">
          {notice.text}
        </div>
      ) : null}

      {/* ---------- connexion ---------- */}
      <section className="section" style={{ marginTop: 4 }}>
        <h2 className="section-title">Connexion bancaire</h2>
        <div className="card bk-connect">
          <p className="bk-safe">
            Tu t’identifies sur le site de ta banque, via un prestataire agréé DSP2. L’app ne voit et ne stocke jamais
            tes identifiants bancaires ; elle reçoit seulement tes soldes et tes opérations, en lecture.
          </p>
          {status.kind === 'loading' ? <div className="hint">Vérification de la configuration…</div> : null}
          {status.kind === 'error' ? (
            <div className="hint">Impossible de vérifier la configuration. Réessaie plus tard.</div>
          ) : null}
          {status.kind === 'ready' && !status.status.configured ? (
            <div className="bk-state">
              <b>Aucun fournisseur bancaire configuré.</b>
              <span>
                La connexion s’active dès que les variables d’Enable Banking sont renseignées sur le serveur (
                <code>ENABLEBANKING_APP_ID</code>, <code>ENABLEBANKING_PRIVATE_KEY</code>). En attendant, l’import CSV
                ci-dessous fonctionne.
              </span>
            </div>
          ) : null}
          {status.kind === 'ready' && status.status.configured && !status.status.implemented ? (
            <div className="bk-state">
              <b>Fournisseur « {status.status.provider} » sans connecteur.</b>
              <span>Seul Enable Banking est branché dans l’app.</span>
            </div>
          ) : null}
          {status.kind === 'ready' && status.status.implemented && status.status.blockers.length > 0 ? (
            <div className="bk-state" data-tone="warn">
              <b>Connexion bloquée par sécurité</b>
              <ul>
                {status.status.blockers.map((b) => (
                  <li key={b.id}>{b.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {ready && status.kind === 'ready' && !status.status.durable ? (
            <div className="hint">
              Sans base de données, les connexions sont perdues au redémarrage du serveur : il faudra reconnecter.
            </div>
          ) : null}

          {bank.connections.length > 0 ? (
            <div className="bk-links">
              {bank.connections.map((c) => (
                <div key={c.id} className="bk-link" data-status={c.status}>
                  <div className="bk-link-main">
                    <b>{c.institution}</b>
                    <small>
                      {c.status === 'needs_action' ? 'À reconnecter' : 'Connectée'}
                      {c.lastSyncAt ? ` · synchro ${formatDate(c.lastSyncAt.slice(0, 10))}` : ''}
                      {c.validUntil ? ` · autorisation jusqu’au ${formatDate(c.validUntil)}` : ''}
                    </small>
                    {c.error ? <small className="bk-err">{c.error}</small> : null}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setToDisconnect(c)}>
                    Déconnecter
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {ready ? (
            <div className="money-actions">
              <button className="btn btn-accent" onClick={() => openPicker()}>
                + Connecter une banque
              </button>
              {bank.connections.length > 0 ? (
                <button className="btn btn-ghost" onClick={sync} disabled={syncing}>
                  {syncing ? 'Synchronisation…' : 'Synchroniser'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------- analyse ---------- */}
      <section className="section">
        <div className="bk-monthnav">
          <button className="fin-nav" onClick={() => setMonth(previousMonth(month))} aria-label="Mois précédent">‹</button>
          <b>{monthLabel(month)}</b>
          <button className="fin-nav" onClick={() => setMonth(nextMonth(month))} aria-label="Mois suivant" disabled={isCurrent}>›</button>
        </div>
        {bank.accounts.length > 1 ? (
          <div className="pill-row" style={{ marginBottom: 10 }}>
            <button className="pill" data-on={accountId === null} onClick={() => setAccountId(null)}>Tous les comptes</button>
            {bank.accounts.map((a) => (
              <button key={a.id} className="pill" data-on={accountId === a.id} onClick={() => setAccountId(a.id)}>{a.name}</button>
            ))}
          </div>
        ) : null}

        {bank.transactions.length === 0 ? (
          <div className="card dash-empty">
            <b>Pas encore d’opérations.</b>
            <span>Connecte une banque ou importe un relevé CSV : l’analyse apparaîtra ici.</span>
          </div>
        ) : (
          <>
            <div className="card bk-story">
              <p>
                {isCurrent ? 'Ce mois-ci' : `En ${monthLabel(month)}`}, tes dépenses sont de{' '}
                <b className="mono">{formatMoneyExact(mt.spent)}</b>.
              </p>
              <p>
                {mt.saved >= 0 ? (
                  <>
                    Tu as économisé <b className="mono">{formatMoneyExact(mt.saved)}</b>
                    <small> (revenus − dépenses)</small>.
                  </>
                ) : (
                  <>
                    Tes dépenses dépassent tes revenus de <b className="mono">{formatMoneyExact(-mt.saved)}</b>.
                  </>
                )}
              </p>
              {ratio !== null ? (
                <>
                  <p>
                    Ton objectif d’épargne est à <b className="mono">{Math.round(ratio * 100)} %</b>
                    <small> ({formatMoneyExact(Math.max(0, mt.saved))} sur {formatMoneyExact(target)})</small>.
                  </p>
                  <div className="bar bk-goal-bar" role="progressbar" aria-valuenow={Math.round(Math.min(1, ratio) * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <i style={{ width: `${Math.min(1, ratio) * 100}%` }} />
                  </div>
                </>
              ) : null}
              {targetDraft !== null ? (
                <div className="bk-target">
                  <input
                    className="input mono"
                    inputMode="decimal"
                    autoFocus
                    placeholder="Ex. 300"
                    value={targetDraft}
                    onChange={(e) => setTargetDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveTarget()}
                    aria-label="Objectif d’épargne mensuel en euros"
                  />
                  <button className="btn btn-sm btn-accent" onClick={saveTarget}>Enregistrer</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setTargetDraft(null)}>Annuler</button>
                </div>
              ) : (
                <button className="link-sm" onClick={() => setTargetDraft(target ? String(target) : '')}>
                  {target ? 'Modifier l’objectif d’épargne mensuel' : 'Définir un objectif d’épargne mensuel'}
                </button>
              )}
            </div>

            <div className="fin-kpis bk-kpis">
              <div>
                <span>Dépenses du mois</span>
                <b className="mono">{formatMoneyExact(mt.spent)}</b>
                {prev.spent > 0 ? (
                  <small className="mono">
                    {mt.spent >= prev.spent ? '+' : '−'}
                    {formatMoneyExact(Math.abs(mt.spent - prev.spent))} vs mois préc.
                  </small>
                ) : null}
              </div>
              <div>
                <span>Dépenses de la semaine</span>
                <b className="mono">{formatMoneyExact(wk.spent)}</b>
                <small className="mono">depuis le {formatShort(wk.from)}</small>
              </div>
              <div>
                <span>Revenus du mois</span>
                <b className="mono">{formatMoneyExact(mt.earned)}</b>
              </div>
              <div>
                <span>Vers l’épargne</span>
                <b className="mono">{formatMoneyExact(mt.toSavings)}</b>
                <small>virements du mois</small>
              </div>
            </div>

            <div className="row fin-head" style={{ marginTop: 18 }}>
              <h2 className="section-title" style={{ margin: 0 }}>Évolution mensuelle</h2>
              <div className="fin-span">
                <button data-on={span === 6} onClick={() => setSpan(6)}>6 mois</button>
                <button data-on={span === 12} onClick={() => setSpan(12)}>12 mois</button>
              </div>
            </div>
            <div className="card">
              <FlowChart flows={flows} />
            </div>

            <div className="bk-grid">
              <div>
                <h2 className="section-title" style={{ marginTop: 18 }}>Dépenses par catégorie</h2>
                {cats.length === 0 ? (
                  <div className="card dash-empty"><span>Aucune dépense ce mois-ci.</span></div>
                ) : (
                  <div className="card fin-cats">
                    {cats.map((c) => (
                      <div key={c.category} className="fin-cat">
                        <div className="row">
                          <span>{categoryLabel(c.category)}</span>
                          <span className="mono">
                            <b>{formatMoneyExact(c.amount)}</b> · {Math.round(c.share * 100)} %
                          </span>
                        </div>
                        <div className="fin-cat-bar"><i style={{ width: `${(c.amount / catMax) * 100}%` }} /></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h2 className="section-title" style={{ marginTop: 18 }}>Principales dépenses</h2>
                {top.length === 0 ? (
                  <div className="card dash-empty"><span>Aucune dépense ce mois-ci.</span></div>
                ) : (
                  <div className="card fin-list">
                    {top.map((t, i) => (
                      <button key={t.id} className="fin-tx" onClick={() => setEditing(t)}>
                        <span className="bk-rank mono">{i + 1}</span>
                        <span className="fin-acc-main">
                          <b>{t.label}</b>
                          <small>{categoryLabel(t.category)} · {formatShort(t.date)}</small>
                        </span>
                        <b className="mono">−{formatMoneyExact(-t.amount)}</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="fin-disclaimer" style={{ marginTop: 10 }}>
              Chiffres calculés à partir de tes opérations bancaires ; les virements vers l’épargne ne comptent pas comme
              des dépenses. Aucun conseil financier n’est donné ici.
            </p>
          </>
        )}
      </section>

      {/* ---------- comptes ---------- */}
      <section className="section">
        <h2 className="section-title">Comptes bancaires</h2>
        {totalBalance !== null ? (
          <div className="patrimoine-total" style={{ marginBottom: 10 }}>
            <span>Solde total</span>
            <b className="mono">{formatMoneyExact(totalBalance)}</b>
          </div>
        ) : null}
        {bank.accounts.length === 0 ? (
          <div className="card empty">Aucun compte. Connecte une banque, ou ajoute un compte pour y importer un relevé CSV.</div>
        ) : (
          <div className="card">
            {bank.accounts.map((a) => {
              const conn = connectionOf(a.connectionId);
              return (
                <div key={a.id} className="rec">
                  <div style={{ minWidth: 0 }}>
                    <div className="ex-name">{a.name}</div>
                    <div className="ex-meta">
                      {ACCOUNT_KINDS.find((k) => k.id === a.kind)?.label}
                      {a.iban4 ? ` · ••${a.iban4}` : ''}
                      {conn ? ` · ${conn.institution}` : ' · import manuel'}
                      {typeof a.balance === 'number' ? ` · ${formatMoneyExact(a.balance)}` : ''}
                    </div>
                  </div>
                  {conn ? null : (
                    <div className="rec-val">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setImportTarget(a.id);
                          setPreview(null);
                          fileInput.current?.click();
                        }}
                      >
                        Importer CSV
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAccountToDelete(a)}>Retirer</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" onChange={onPickFile} hidden />
        {addingAccount ? (
          <div className="card" style={{ marginTop: 10 }}>
            <label className="field" style={{ marginTop: 0 }}>
              <span>Nom du compte</span>
              <input className="input" placeholder="Compte courant" maxLength={40} autoFocus value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </label>
            <div className="field">
              <span>Type</span>
              <div className="chip-grid">
                {ACCOUNT_KINDS.map((k) => (
                  <button key={k.id} className="chip" data-on={accountKind === k.id} onClick={() => setAccountKind(k.id)}>{k.label}</button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Solde actuel — facultatif</span>
              <input className="input" type="number" inputMode="decimal" step="0.01" value={accountBalance} onChange={(e) => setAccountBalance(e.target.value)} />
            </label>
            <div className="grid-2" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setAddingAccount(false)}>Annuler</button>
              <button className="btn btn-accent" onClick={addAccount} disabled={accountName.trim() === ''}>Ajouter</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost add-objective" onClick={() => setAddingAccount(true)}>
            + Compte pour import CSV
          </button>
        )}
      </section>

      {preview ? (
        <section className="section">
          <h2 className="section-title">Import à confirmer</h2>
          <div className="card">
            <div className="ex-name">
              {preview.transactions.length} opération{preview.transactions.length > 1 ? 's' : ''} lue{preview.transactions.length > 1 ? 's' : ''}
            </div>
            <div className="ex-meta">Colonnes : {preview.columns.date} · {preview.columns.label} · {preview.columns.amount}</div>
            {preview.errors.length > 0 ? <div className="ex-meta">{preview.errors.length} ligne(s) ignorée(s)</div> : null}
            <div className="grid-2" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>Annuler</button>
              <button className="btn btn-accent" onClick={confirmImport} disabled={preview.transactions.length === 0}>Importer</button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- opérations ---------- */}
      {monthTxs.length > 0 ? (
        <section className="section">
          <h2 className="section-title">Opérations · {monthLabel(month)} · {monthTxs.length}</h2>
          <div className="card">
            {monthTxs.slice(0, 80).map((t) => (
              <button key={t.id} className="tx" onClick={() => setEditing(t)}>
                <span className="tx-main">
                  <span className="tx-label">{t.label}</span>
                  <span className="tx-meta">
                    <i className="tx-dot" style={{ background: categoryColor(t.category) }} />
                    {categoryLabel(t.category)} · {formatDate(t.date)}
                    {t.pending ? ' · en attente' : ''}
                  </span>
                </span>
                <b className="mono tx-amount" data-in={t.amount > 0}>
                  {t.amount > 0 ? '+' : '−'}
                  {formatMoneyExact(Math.abs(t.amount))}
                </b>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------- feuilles ---------- */}
      {picker ? (
        <div className="sheet-backdrop" onClick={() => setPicker(false)}>
          <div className="sheet" role="dialog" aria-label="Choisir sa banque" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div className="sheet-title">Choisir ta banque</div>
            <div className="grid-2">
              <select
                className="input"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  void openPicker(e.target.value);
                }}
                aria-label="Pays"
              >
                {COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <input className="input" placeholder="Rechercher" value={instQuery} onChange={(e) => setInstQuery(e.target.value)} aria-label="Rechercher une banque" />
            </div>
            {instError ? <div className="banner warn" style={{ marginTop: 10 }}>{instError}</div> : null}
            {institutions === null && !instError ? <div className="hint" style={{ marginTop: 12 }}>Chargement des banques…</div> : null}
            <div className="bk-banks">
              {shownInstitutions.map((i) => (
                <button key={i.name} className="bk-bank" onClick={() => connect(i.name)} disabled={connecting !== null}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.logo && !brokenLogos.has(i.name) ? (
                    <img
                      src={i.logo}
                      alt=""
                      width={28}
                      height={28}
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenLogos((prev) => new Set(prev).add(i.name))}
                    />
                  ) : (
                    <span className="bk-bank-ph" aria-hidden>{i.name[0]}</span>
                  )}
                  <span>{i.name}</span>
                  {connecting === i.name ? <small>Redirection…</small> : null}
                </button>
              ))}
              {institutions !== null && shownInstitutions.length === 0 ? <div className="hint">Aucune banque trouvée.</div> : null}
            </div>
            <p className="bk-safe" style={{ marginTop: 12 }}>
              Tu vas être redirigé vers ta banque pour t’identifier et autoriser l’accès en lecture pendant 90 jours.
            </p>
          </div>
        </div>
      ) : null}

      {toDisconnect ? (
        <div className="sheet-backdrop" onClick={() => setToDisconnect(null)}>
          <div className="sheet" role="dialog" aria-label="Déconnecter" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <div className="sheet-title">Déconnecter {toDisconnect.institution} ?</div>
            <p className="hint">L’autorisation est retirée chez le fournisseur et plus rien n’est récupéré.</p>
            <div className="ag-delete-actions">
              <button className="btn btn-ghost" onClick={() => setToDisconnect(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => disconnect(toDisconnect, true)}>Garder l’historique</button>
              <button className="btn btn-danger" onClick={() => disconnect(toDisconnect, false)}>Tout supprimer</button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="sheet-backdrop" onClick={() => setEditing(null)} role="presentation">
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="sheet-grip" />
            <div className="sheet-title">{editing.label}</div>
            <div className="ex-meta" style={{ marginBottom: 14 }}>
              {formatDate(editing.date)} · {editing.amount > 0 ? '+' : '−'}
              {formatMoneyExact(Math.abs(editing.amount))}
            </div>
            <div className="field" style={{ marginTop: 0 }}>
              <span>Catégorie</span>
              <div className="chip-grid">
                {SPEND_CATEGORIES.map((c) => (
                  <button key={c.id} className="chip" data-on={editing.category === c.id} onClick={() => setCategory(editing.id, c.id)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid-2" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Fermer</button>
              <button className="btn btn-danger" onClick={() => removeTransaction(editing.id)}>Supprimer</button>
            </div>
          </div>
        </div>
      ) : null}

      {accountToDelete ? (
        <ConfirmDialog
          title="Retirer ce compte ?"
          detail={`${accountToDelete.name} — ses opérations importées seront supprimées aussi.`}
          confirmLabel="Retirer"
          onConfirm={() => removeAccount(accountToDelete.id)}
          onClose={() => setAccountToDelete(null)}
        />
      ) : null}
    </div>
  );
}
