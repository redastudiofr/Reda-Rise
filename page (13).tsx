'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useData } from '@/components/DataProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import Donut from '@/components/Donut';
import DualCurve from '@/components/DualCurve';
import HoldingSheet, { type HoldingDraft } from '@/components/HoldingSheet';
import { formatDate, todayKey, uid } from '@/lib/logic';
import { formatMoney, formatMoneyExact, type SimFrequency } from '@/lib/business';
import {
  allocation,
  assetColor,
  assetLabel,
  currentValue,
  holdingGain,
  holdingReturn,
  investedCapital,
  portfolioTotals,
  priceMissing,
  project,
  projectionTable,
} from '@/lib/invest';
import type { Holding } from '@/lib/types';

/** Long-run averages people commonly cite, offered as a starting point only. */
const RATE_PRESETS = [
  { label: 'Livret A', rate: 2.4 },
  { label: 'CAC 40', rate: 6 },
  { label: 'S&P 500', rate: 8 },
];

function percent(value: number): string {
  const rounded = Math.round(value * 1000) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('fr-FR')} %`;
}

export default function InvestPage() {
  const { data, update } = useData();
  const today = todayKey(data.settings.timezone);
  const holdings = data.investments.holdings;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [toDelete, setToDelete] = useState<Holding | null>(null);

  const totals = useMemo(() => portfolioTotals(holdings), [holdings]);
  const split = useMemo(() => allocation(holdings), [holdings]);

  const [initial, setInitial] = useState('');
  const [monthly, setMonthly] = useState('200');
  const [years, setYears] = useState('10');
  const [rate, setRate] = useState('7');
  const [frequency, setFrequency] = useState<SimFrequency>('mensuel');

  const initialNum = initial.trim() === '' ? Math.round(totals.value) : Number(initial.replace(',', '.')) || 0;
  const monthlyNum = Number(monthly.replace(',', '.')) || 0;
  const yearsNum = Number(years.replace(',', '.')) || 0;
  const rateNum = Number(rate.replace(',', '.')) || 0;

  const projection = useMemo(
    () => project(initialNum, monthlyNum, yearsNum, frequency, rateNum),
    [initialNum, monthlyNum, yearsNum, frequency, rateNum],
  );

  const table = useMemo(
    () => (projection ? projectionTable(projection, initialNum, monthlyNum, frequency) : []),
    [projection, initialNum, monthlyNum, frequency],
  );

  function saveHolding(draft: HoldingDraft) {
    if (editing) {
      const id = editing.id;
      update((d) => ({
        ...d,
        investments: {
          ...d.investments,
          holdings: d.investments.holdings.map((h) =>
            h.id === id
              ? {
                  ...h,
                  ...draft,
                  priceUpdatedAt:
                    draft.currentPrice !== h.currentPrice ? today : h.priceUpdatedAt,
                }
              : h,
          ),
        },
      }));
    } else {
      const holding: Holding = {
        id: uid(),
        ...draft,
        priceUpdatedAt: typeof draft.currentPrice === 'number' ? today : undefined,
      };
      update((d) => ({
        ...d,
        investments: { ...d.investments, holdings: [holding, ...d.investments.holdings] },
      }));
    }
    setSheetOpen(false);
    setEditing(null);
  }

  function removeHolding(id: string) {
    update((d) => ({
      ...d,
      investments: { ...d.investments, holdings: d.investments.holdings.filter((h) => h.id !== id) },
    }));
    setToDelete(null);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Investissements</h1>
          <p className="sub">
            {holdings.length} position{holdings.length > 1 ? 's' : ''}
            {holdings.length > 0 ? ` · ${formatMoney(totals.value)}` : ''}
          </p>
        </div>
        <Link href="/entrepreneuriat" className="link-sm">
          Business
        </Link>
      </header>

      {/* ---------- portefeuille ---------- */}

      <section className="section" style={{ marginTop: 4 }}>
        <h2 className="section-title">Portefeuille</h2>

        {holdings.length === 0 ? (
          <div className="card empty">
            Aucune position enregistrée. Ajoute tes actions, ETF, cryptos ou biens immobiliers pour
            suivre ton capital.
          </div>
        ) : (
          <>
            <div className="stat-row" style={{ marginTop: 0 }}>
              <div className="stat">
                <b className="mono">{formatMoney(totals.invested)}</b>
                <span>Capital investi</span>
              </div>
              <div className="stat">
                <b className="mono">{formatMoney(totals.value)}</b>
                <span>Valeur actuelle</span>
              </div>
              <div className="stat">
                <b className="mono" style={{ color: totals.gain >= 0 ? '#4ec38a' : '#e0806f' }}>
                  {totals.gain >= 0 ? '+' : ''}
                  {formatMoney(totals.gain)}
                </b>
                <span>{totals.gain >= 0 ? 'Plus-value' : 'Moins-value'}</span>
              </div>
            </div>

            <div className="patrimoine-total" style={{ marginTop: 10 }}>
              <span>Rendement</span>
              <b className="mono" style={{ color: totals.gain >= 0 ? '#4ec38a' : '#e0806f' }}>
                {percent(totals.returnRate)}
              </b>
            </div>

            {totals.stale > 0 ? (
              <div className="banner warn" style={{ marginTop: 10 }}>
                {totals.stale} position{totals.stale > 1 ? 's sont comptées' : ' est comptée'} au prix
                d&apos;achat, faute de valeur actuelle renseignée. Aucun cours n&apos;est récupéré
                automatiquement.
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* ---------- répartition ---------- */}

      {split.length > 0 ? (
        <section className="section">
          <h2 className="section-title">Répartition</h2>
          <div className="card">
            <div className="split-chart">
              <Donut
                slices={split.map((s) => ({
                  key: s.type,
                  label: assetLabel(s.type),
                  value: s.value,
                  color: assetColor(s.type),
                }))}
                total={formatMoney(totals.value)}
                caption="au total"
              />
              <div className="split-legend">
                {split.map((s) => (
                  <div key={s.type} className="split-row">
                    <span className="split-dot" style={{ background: assetColor(s.type) }} />
                    <span className="split-name">{assetLabel(s.type)}</span>
                    <span className="split-value mono">{Math.round(s.share * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------- positions ---------- */}

      <section className="section">
        <h2 className="section-title">Positions</h2>

        {holdings.map((h) => {
          const gain = holdingGain(h);
          return (
            <div key={h.id} className="holding">
              <div className="row">
                <div style={{ minWidth: 0 }}>
                  <div className="holding-name">
                    {h.name}
                    {h.symbol ? <span className="holding-symbol">{h.symbol}</span> : null}
                  </div>
                  <div className="holding-meta">
                    {assetLabel(h.type)} · {h.quantity.toLocaleString('fr-FR')} ×{' '}
                    {formatMoneyExact(h.buyPrice)} · {formatDate(h.date)}
                  </div>
                </div>
                <div className="rec-val">
                  <b className="mono">{formatMoneyExact(currentValue(h))}</b>
                  <div className="ex-meta mono" style={{ color: gain >= 0 ? '#4ec38a' : '#e0806f' }}>
                    {gain >= 0 ? '+' : ''}
                    {formatMoneyExact(gain)} · {percent(holdingReturn(h))}
                  </div>
                </div>
              </div>

              <div className="holding-detail">
                <span>Investi {formatMoneyExact(investedCapital(h))}</span>
                <span>
                  {priceMissing(h)
                    ? 'Valeur actuelle non renseignée'
                    : `Valeur ${formatMoneyExact(h.currentPrice as number)} / unité${h.priceUpdatedAt ? ` · maj ${formatDate(h.priceUpdatedAt)}` : ''}`}
                </span>
              </div>

              {h.note ? <div className="ex-meta" style={{ marginTop: 6 }}>{h.note}</div> : null}

              <div className="obj-actions">
                <button
                  onClick={() => {
                    setEditing(h);
                    setSheetOpen(true);
                  }}
                >
                  Modifier
                </button>
                <button onClick={() => setToDelete(h)}>Supprimer</button>
              </div>
            </div>
          );
        })}

        <button
          className="btn btn-accent add-objective"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          + Ajouter un investissement
        </button>
      </section>

      {/* ---------- projection ---------- */}

      <section className="section">
        <h2 className="section-title">Projection long terme</h2>
        <div className="card">
          <div className="grid-2">
            <label className="field" style={{ marginTop: 0 }}>
              <span>Montant initial</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                placeholder={String(Math.round(totals.value))}
                value={initial}
                onChange={(e) => setInitial(e.target.value)}
              />
            </label>
            <label className="field" style={{ marginTop: 0 }}>
              <span>Versement</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
              />
            </label>
          </div>

          <div className="field">
            <span>Fréquence des versements</span>
            <div className="segmented">
              <button data-on={frequency === 'mensuel'} onClick={() => setFrequency('mensuel')}>
                Mensuel
              </button>
              <button data-on={frequency === 'annuel'} onClick={() => setFrequency('annuel')}>
                Annuel
              </button>
            </div>
          </div>

          <div className="grid-2">
            <label className="field">
              <span>Durée (années)</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min="1"
                value={years}
                onChange={(e) => setYears(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Rendement annuel estimé (%)</span>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
          </div>

          <div className="pill-row">
            {RATE_PRESETS.map((p) => (
              <button
                key={p.label}
                className="pill"
                data-on={Number(rate) === p.rate}
                onClick={() => setRate(String(p.rate))}
              >
                {p.label} · {p.rate} %
              </button>
            ))}
          </div>

          {projection ? (
            <>
              <div className="sim-legend" style={{ marginTop: 14 }}>
                {projection.scenarios.map((s) => (
                  <span key={s.id}>
                    <i className="sim-dot" style={{ background: s.color }} /> {s.label} · {s.rate} %
                  </span>
                ))}
              </div>

              <DualCurve
                suffix=" €"
                series={projection.scenarios.map((s) => ({
                  label: s.label,
                  color: s.color,
                  points: s.points,
                }))}
              />

              <div className="scenario-row">
                {projection.scenarios.map((s) => (
                  <div key={s.id} className="scenario">
                    <span className="scenario-label" style={{ color: s.color }}>
                      {s.label}
                    </span>
                    <b className="mono">{formatMoney(s.finalValue)}</b>
                    <span className="scenario-gain mono">
                      {s.gain >= 0 ? '+' : ''}
                      {formatMoney(s.gain)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="patrimoine-total" style={{ marginTop: 10 }}>
                <span>Total versé sur {projection.years} ans</span>
                <b className="mono">{formatMoney(projection.versed)}</b>
              </div>

              <div className="field">
                <span>Année par année</span>
                <div className="proj-table">
                  <div className="proj-row proj-head">
                    <span>Année</span>
                    <span>Versé</span>
                    <span>Moyen</span>
                    <span>Optimiste</span>
                  </div>
                  {table
                    .filter((row) => row.year > 0)
                    .map((row) => (
                      <div key={row.year} className="proj-row">
                        <span className="mono">{row.year}</span>
                        <span className="mono">{formatMoney(row.versed)}</span>
                        <span className="mono">{formatMoney(row.values.moyen)}</span>
                        <span className="mono">{formatMoney(row.values.optimiste)}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="hint" style={{ marginTop: 14 }}>
                Ce sont des <b>estimations, pas des rendements garantis</b>. Le calcul est simple et
                vérifiable : le capital est composé mois par mois au taux annuel converti en taux
                mensuel, et le versement est ajouté à chaque échéance. Les trois scénarios sont le
                taux que tu as saisi, ce taux moins 3 points et ce taux plus 3 points. Ni les frais,
                ni la fiscalité, ni l&apos;inflation ne sont pris en compte. Les performances
                passées ne préjugent pas des performances futures : la valeur réelle peut être très
                différente, et peut baisser. Ceci n&apos;est pas un conseil en investissement.
              </div>
            </>
          ) : (
            <div className="empty">Indique une durée pour lancer la projection.</div>
          )}
        </div>
      </section>

      {sheetOpen ? (
        <HoldingSheet
          initial={editing}
          today={today}
          onSave={saveHolding}
          onClose={() => {
            setSheetOpen(false);
            setEditing(null);
          }}
        />
      ) : null}

      {toDelete ? (
        <ConfirmDialog
          title="Supprimer cette position ?"
          detail={`${toDelete.name} — ${formatMoneyExact(currentValue(toDelete))}`}
          onConfirm={() => removeHolding(toDelete.id)}
          onClose={() => setToDelete(null)}
        />
      ) : null}
    </>
  );
}
