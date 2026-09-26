'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/components/DataProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import Curve from '@/components/Curve';
import Donut from '@/components/Donut';
import { formatDate, todayKey, uid } from '@/lib/logic';
import { formatMoneyExact } from '@/lib/business';
import {
  PERIODS,
  SPEND_CATEGORIES,
  accountsTotal,
  balanceSeries,
  categoryColor,
  categoryLabel,
  periodRange,
  previousRange,
  spendByCategory,
  summarize,
  transactionsOf,
  type BankStatus,
  type PeriodId,
} from '@/lib/bank';
import { dedupeAgainst, parseTransactionsCsv, type ImportResult } from '@/lib/bankImport';
import type { BankAccount, BankAccountKind, BankTransaction, SpendCategory } from '@/lib/types';

const ACCOUNT_KINDS: { id: BankAccountKind; label: string }[] = [
  { id: 'courant', label: 'Compte courant' },
  { id: 'epargne', label: 'Épargne' },
  { id: 'carte', label: 'Carte' },
  { id: 'titres', label: 'Titres' },
  { id: 'autre', label: 'Autre' },
];

type StatusState =
  | { kind: 'loading' }
  | { kind: 'ready'; status: BankStatus }
  | { kind: 'error'; message: string };

export default function BankPage() {
  const { data, update } = useData();
  const today = todayKey(data.settings.timezone);
  const bank = data.bank;

  const [status, setStatus] = useState<StatusState>({ kind: 'loading' });
  const [connectMessage, setConnectMessage] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [period, setPeriod] = useState<PeriodId>('mois');
  const [accountId, setAccountId] = useState<string | null>(null);

  const [addingAccount, setAddingAccount] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountKind, setAccountKind] = useState<BankAccountKind>('courant');
  const [accountBalance, setAccountBalance] = useState('');

  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importTarget, setImportTarget] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<BankTransaction | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<BankAccount | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/bank/status', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as BankStatus;
        if (!cancelled) setStatus({ kind: 'ready', status: json });
      } catch {
        if (!cancelled) {
          setStatus({
            kind: 'error',
            message: 'Impossible de savoir si un agrégateur est configuré. Réessaie plus tard.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const range = useMemo(() => periodRange(period, today), [period, today]);
  const before = useMemo(() => previousRange(period, today), [period, today]);

  const transactions = useMemo(() => transactionsOf(bank, accountId), [bank, accountId]);
  const summary = useMemo(() => summarize(transactions, range), [transactions, range]);
  const summaryBefore = useMemo(() => summarize(transactions, before), [transactions, before]);
  const categories = useMemo(() => spendByCategory(transactions, range), [transactions, range]);
  // The month and year windows run past today; the curve stops at today rather
  // than trailing a flat line across dates that have not happened yet.
  const curveRange = useMemo(
    () => ({ ...range, to: range.to > today ? today : range.to }),
    [range, today],
  );
  const curve = useMemo(() => balanceSeries(transactions, curveRange), [transactions, curveRange]);

  const visible = transactions.filter((t) => t.date >= range.from && t.date <= range.to);
  const totalBalance = accountsTotal(bank.accounts);
  const delta = summary.spent - summaryBefore.spent;

  async function connect() {
    setConnecting(true);
    setConnectMessage('');
    try {
      const res = await fetch('/api/bank/connect', { method: 'POST' });
      const json = (await res.json()) as { message?: string };
      setConnectMessage(
        json.message ?? 'La connexion bancaire n’est pas encore disponible sur ce déploiement.',
      );
    } catch {
      setConnectMessage('La requête a échoué. Vérifie ta connexion et réessaie.');
    } finally {
      setConnecting(false);
    }
  }

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
    const text = await file.text();
    setPreview(parseTransactionsCsv(text, importTarget));
  }

  function confirmImport() {
    if (!preview) return;
    update((d) => {
      const fresh = dedupeAgainst(preview.transactions, d.bank.transactions);
      return {
        ...d,
        bank: {
          ...d.bank,
          transactions: [...d.bank.transactions, ...fresh],
          lastSyncAt: new Date().toISOString(),
        },
      };
    });
    setPreview(null);
    setImportTarget(null);
  }

  function setCategory(transactionId: string, category: SpendCategory) {
    update((d) => ({
      ...d,
      bank: {
        ...d.bank,
        transactions: d.bank.transactions.map((t) =>
          t.id === transactionId ? { ...t, category, manualCategory: true } : t,
        ),
      },
    }));
    setEditing(null);
  }

  function removeTransaction(id: string) {
    update((d) => ({
      ...d,
      bank: { ...d.bank, transactions: d.bank.transactions.filter((t) => t.id !== id) },
    }));
    setEditing(null);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Comptes bancaires</h1>
          <p className="sub">
            {bank.accounts.length} compte{bank.accounts.length > 1 ? 's' : ''} ·{' '}
            {bank.transactions.length} opération{bank.transactions.length > 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/entrepreneuriat" className="link-sm">
          Business
        </Link>
      </header>

      {/* ---------- connexion ---------- */}

      <section className="section" style={{ marginTop: 4 }}>
        <h2 className="section-title">Connexion</h2>
        {status.kind === 'loading' ? (
          <div className="card empty">Vérification de la configuration…</div>
        ) : status.kind === 'error' ? (
          <div className="card">
            <div className="banner warn">{status.message}</div>
          </div>
        ) : status.status.configured ? (
          <div className="card">
            <div className="row">
              <div>
                <div className="ex-name">Agrégateur configuré</div>
                <div className="ex-meta">{status.status.provider}</div>
              </div>
              <button className="btn btn-sm btn-accent" onClick={() => void connect()} disabled={connecting}>
                {connecting ? 'Ouverture…' : 'Connecter une banque'}
              </button>
            </div>
            {connectMessage ? <div className="banner warn" style={{ marginTop: 12 }}>{connectMessage}</div> : null}
          </div>
        ) : (
          <div className="card">
            <div className="ex-name">Aucune banque connectée</div>
            <div className="ex-meta" style={{ marginTop: 4 }}>
              La connexion bancaire passe obligatoirement par un agrégateur agréé : tu
              t&apos;authentifies sur le site de ta banque, et l&apos;application ne voit jamais
              tes identifiants. Aucun agrégateur n&apos;est configuré sur ce déploiement.
            </div>

            <div className="field">
              <span>À configurer pour activer la connexion</span>
              <div className="env-list">
                {status.status.missing.map((v) => (
                  <code key={v} className="env-var">
                    {v}
                  </code>
                ))}
              </div>
            </div>

            <div className="field">
              <span>Fournisseurs prévus</span>
              {status.status.providers.map((p) => (
                <div key={p.id} className="rec">
                  <div style={{ minWidth: 0 }}>
                    <div className="ex-name">{p.label}</div>
                    <div className="ex-meta">{p.note}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hint" style={{ marginTop: 12 }}>
              En attendant, importe l&apos;export CSV que ta banque te propose : les opérations
              sont réelles et le classement par catégorie fonctionne de la même façon.
            </div>
          </div>
        )}
      </section>

      {/* ---------- comptes ---------- */}

      <section className="section">
        <h2 className="section-title">Comptes</h2>

        {totalBalance !== null ? (
          <div className="patrimoine-total" style={{ marginBottom: 10 }}>
            <span>Solde disponible</span>
            <b className="mono">{formatMoneyExact(totalBalance)}</b>
          </div>
        ) : null}

        {bank.accounts.length === 0 ? (
          <div className="card empty">
            Aucun compte. Ajoute-en un pour y rattacher tes opérations.
          </div>
        ) : (
          <div className="card">
            {bank.accounts.map((a) => (
              <div key={a.id} className="rec">
                <div style={{ minWidth: 0 }}>
                  <div className="ex-name">{a.name}</div>
                  <div className="ex-meta">
                    {ACCOUNT_KINDS.find((k) => k.id === a.kind)?.label}
                    {typeof a.balance === 'number' ? ` · ${formatMoneyExact(a.balance)}` : ' · solde non renseigné'}
                  </div>
                </div>
                <div className="rec-val">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setImportTarget(a.id);
                      setPreview(null);
                      fileInput.current?.click();
                    }}
                  >
                    Importer
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAccountToDelete(a)}>
                    Retirer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" onChange={onPickFile} hidden />

        {addingAccount ? (
          <div className="card" style={{ marginTop: 10 }}>
            <label className="field" style={{ marginTop: 0 }}>
              <span>Nom du compte</span>
              <input
                className="input"
                placeholder="Compte courant"
                maxLength={40}
                autoFocus
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </label>
            <div className="field">
              <span>Type</span>
              <div className="chip-grid">
                {ACCOUNT_KINDS.map((k) => (
                  <button
                    key={k.id}
                    className="chip"
                    data-on={accountKind === k.id}
                    onClick={() => setAccountKind(k.id)}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Solde actuel — facultatif</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="Laisser vide si tu ne veux pas le suivre"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
              />
            </label>
            <div className="grid-2" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setAddingAccount(false)}>
                Annuler
              </button>
              <button className="btn btn-accent" onClick={addAccount} disabled={accountName.trim() === ''}>
                Ajouter
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-accent add-objective" onClick={() => setAddingAccount(true)}>
            + Ajouter un compte
          </button>
        )}
      </section>

      {/* ---------- import ---------- */}

      {preview ? (
        <section className="section">
          <h2 className="section-title">Import à confirmer</h2>
          <div className="card">
            <div className="row">
              <div>
                <div className="ex-name">
                  {preview.transactions.length} opération{preview.transactions.length > 1 ? 's' : ''} lue
                  {preview.transactions.length > 1 ? 's' : ''}
                </div>
                <div className="ex-meta">
                  Colonnes : {preview.columns.date} · {preview.columns.label} · {preview.columns.amount}
                </div>
              </div>
            </div>

            {preview.errors.length > 0 ? (
              <div className="field">
                <span>{preview.errors.length} ligne(s) ignorée(s)</span>
                <div className="import-errors">
                  {preview.errors.slice(0, 6).map((e, i) => (
                    <div key={i} className="ex-meta">
                      {e}
                    </div>
                  ))}
                  {preview.errors.length > 6 ? (
                    <div className="ex-meta">et {preview.errors.length - 6} de plus…</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid-2" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>
                Annuler
              </button>
              <button
                className="btn btn-accent"
                onClick={confirmImport}
                disabled={preview.transactions.length === 0}
              >
                Importer
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- résumé ---------- */}

      <section className="section">
        <h2 className="section-title">Résumé</h2>

        {bank.accounts.length > 1 ? (
          <div className="pill-row" style={{ marginBottom: 10 }}>
            <button className="pill" data-on={accountId === null} onClick={() => setAccountId(null)}>
              Tous
            </button>
            {bank.accounts.map((a) => (
              <button
                key={a.id}
                className="pill"
                data-on={accountId === a.id}
                onClick={() => setAccountId(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="segmented">
          {PERIODS.map((p) => (
            <button key={p.id} data-on={period === p.id} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="ex-meta" style={{ margin: '10px 2px' }}>
          {range.label} · du {formatDate(range.from)} au {formatDate(range.to)}
        </div>

        {summary.count === 0 ? (
          <div className="card empty">
            Aucune opération sur cette période. Importe un relevé pour commencer.
          </div>
        ) : (
          <>
            <div className="stat-row" style={{ marginTop: 0 }}>
              <div className="stat">
                <b className="mono money-out">{formatMoneyExact(summary.spent)}</b>
                <span>Dépenses</span>
              </div>
              <div className="stat">
                <b className="mono money-in">{formatMoneyExact(summary.earned)}</b>
                <span>Revenus</span>
              </div>
              <div className="stat">
                <b className="mono">{formatMoneyExact(summary.saved)}</b>
                <span>Épargne</span>
              </div>
            </div>

            <div className="patrimoine-total" style={{ marginTop: 10 }}>
              <span>Solde de la période</span>
              <b className="mono">{formatMoneyExact(summary.net)}</b>
            </div>

            {summaryBefore.count > 0 ? (
              <div className="ex-meta" style={{ margin: '8px 2px' }}>
                {delta > 0
                  ? `${formatMoneyExact(delta)} de dépenses de plus que la période précédente.`
                  : delta < 0
                    ? `${formatMoneyExact(-delta)} de dépenses de moins que la période précédente.`
                    : 'Autant de dépenses que la période précédente.'}
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* ---------- où part l'argent ---------- */}

      {categories.length > 0 ? (
        <section className="section">
          <h2 className="section-title">Où part l&apos;argent</h2>
          <div className="card">
            <div className="split-chart">
              <Donut
                slices={categories.map((c) => ({
                  key: c.category,
                  label: categoryLabel(c.category),
                  value: c.amount,
                  color: categoryColor(c.category),
                }))}
                total={formatMoneyExact(summary.spent)}
                caption="dépensés"
              />
              <div className="split-legend">
                {categories.slice(0, 6).map((c) => (
                  <div key={c.category} className="split-row">
                    <span className="split-dot" style={{ background: categoryColor(c.category) }} />
                    <span className="split-name">{categoryLabel(c.category)}</span>
                    <span className="split-value mono">{Math.round(c.share * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              {categories.map((c) => (
                <div key={c.category} className="cat-row">
                  <div className="row">
                    <span className="cat-name">{categoryLabel(c.category)}</span>
                    <b className="mono cat-amount">{formatMoneyExact(c.amount)}</b>
                  </div>
                  <div className="bar cat-bar">
                    <i
                      style={{
                        width: `${Math.round(c.share * 100)}%`,
                        background: categoryColor(c.category),
                      }}
                    />
                  </div>
                  <div className="ex-meta">
                    {c.count} opération{c.count > 1 ? 's' : ''} · {Math.round(c.share * 100)} % des
                    dépenses
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {curve.length > 1 && summary.count > 0 ? (
        <section className="section">
          <h2 className="section-title">Évolution sur la période</h2>
          <div className="card">
            <Curve
              points={curve}
              format={(v) => `${Math.round(v)} €`}
              formatTooltip={formatMoneyExact}
              periodLabel={`${formatDate(curveRange.from)} → ${formatDate(curveRange.to)}`}
              emptyLabel="Pas assez d’opérations pour tracer la courbe."
            />
            <div className="ex-meta" style={{ marginTop: 6 }}>
              Cumul des entrées et sorties depuis le début de la période.
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- opérations ---------- */}

      {visible.length > 0 ? (
        <section className="section">
          <h2 className="section-title">Opérations · {visible.length}</h2>
          <div className="card">
            {visible.slice(0, 60).map((t) => (
              <button key={t.id} className="tx" onClick={() => setEditing(t)}>
                <span className="tx-main">
                  <span className="tx-label">{t.label}</span>
                  <span className="tx-meta">
                    <i className="tx-dot" style={{ background: categoryColor(t.category) }} />
                    {categoryLabel(t.category)} · {formatDate(t.date)}
                  </span>
                </span>
                <b className="mono tx-amount" data-in={t.amount > 0}>
                  {t.amount > 0 ? '+' : '−'}
                  {formatMoneyExact(Math.abs(t.amount))}
                </b>
              </button>
            ))}
            {visible.length > 60 ? (
              <div className="ex-meta" style={{ paddingTop: 12 }}>
                60 opérations affichées sur {visible.length}.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {editing ? (
        <div className="sheet-backdrop" onClick={() => setEditing(null)} role="presentation">
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="sheet-grip" />
            <div className="sheet-title">{editing.label}</div>
            <div className="ex-meta" style={{ marginBottom: 14 }}>
              {formatDate(editing.date)} ·{' '}
              {editing.amount > 0 ? '+' : '−'}
              {formatMoneyExact(Math.abs(editing.amount))}
            </div>

            <div className="field" style={{ marginTop: 0 }}>
              <span>Catégorie</span>
              <div className="chip-grid">
                {SPEND_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    className="chip"
                    data-on={editing.category === c.id}
                    onClick={() => setCategory(editing.id, c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Fermer
              </button>
              <button className="btn btn-danger" onClick={() => removeTransaction(editing.id)}>
                Supprimer
              </button>
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
    </>
  );
}
