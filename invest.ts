import type { AssetType, Holding } from './types';
import { simulate, type SimFrequency, type SimPoint } from './business';

/**
 * Portfolio maths.
 *
 * Every figure below comes from what the user typed in. No price is fetched
 * and none is guessed: a position whose current price was never set is valued
 * at its purchase price, which shows a flat result rather than a fake gain.
 */

export const ASSET_TYPES: { id: AssetType; label: string; color: string }[] = [
  { id: 'action', label: 'Action', color: '#4d86ea' },
  { id: 'etf', label: 'ETF', color: '#4ec38a' },
  { id: 'crypto', label: 'Crypto', color: '#e0a06f' },
  { id: 'immobilier', label: 'Immobilier', color: '#b47fe0' },
  { id: 'obligation', label: 'Obligation', color: '#5ec8d8' },
  { id: 'autre', label: 'Autre', color: '#767f8c' },
];

export function assetLabel(id: AssetType): string {
  return ASSET_TYPES.find((t) => t.id === id)?.label ?? 'Autre';
}

export function assetColor(id: AssetType): string {
  return ASSET_TYPES.find((t) => t.id === id)?.color ?? '#767f8c';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** What the position cost: quantity × prix d'achat, fees included. */
export function investedCapital(holding: Holding): number {
  return round2(holding.quantity * holding.buyPrice + (holding.fees ?? 0));
}

/** What it is worth now. Falls back to the purchase price when none was set. */
export function currentValue(holding: Holding): number {
  const price = typeof holding.currentPrice === 'number' ? holding.currentPrice : holding.buyPrice;
  return round2(holding.quantity * price);
}

export function holdingGain(holding: Holding): number {
  return round2(currentValue(holding) - investedCapital(holding));
}

/** Return on the position, 0 when nothing was invested. */
export function holdingReturn(holding: Holding): number {
  const invested = investedCapital(holding);
  if (invested <= 0) return 0;
  return holdingGain(holding) / invested;
}

/** True while the user has not given this position a current price. */
export function priceMissing(holding: Holding): boolean {
  return typeof holding.currentPrice !== 'number';
}

export type PortfolioTotals = {
  invested: number;
  value: number;
  gain: number;
  returnRate: number;
  /** Positions still valued at their purchase price, because no price was set. */
  stale: number;
};

export function portfolioTotals(holdings: Holding[]): PortfolioTotals {
  let invested = 0;
  let value = 0;
  let stale = 0;

  for (const holding of holdings) {
    invested += investedCapital(holding);
    value += currentValue(holding);
    if (priceMissing(holding)) stale += 1;
  }

  invested = round2(invested);
  value = round2(value);
  return {
    invested,
    value,
    gain: round2(value - invested),
    returnRate: invested > 0 ? (value - invested) / invested : 0,
    stale,
  };
}

export type Allocation = {
  type: AssetType;
  value: number;
  share: number;
  count: number;
};

/** Split of the portfolio by asset type, biggest first. */
export function allocation(holdings: Holding[]): Allocation[] {
  const totals = new Map<AssetType, { value: number; count: number }>();
  let total = 0;

  for (const holding of holdings) {
    const row = totals.get(holding.type) ?? { value: 0, count: 0 };
    const value = currentValue(holding);
    row.value += value;
    row.count += 1;
    totals.set(holding.type, row);
    total += value;
  }

  return [...totals.entries()]
    .map(([type, row]) => ({
      type,
      value: round2(row.value),
      share: total > 0 ? row.value / total : 0,
      count: row.count,
    }))
    .sort((a, b) => b.value - a.value);
}

/* ---------- projection long terme ---------- */

export type ScenarioId = 'pessimiste' | 'moyen' | 'optimiste';

export const SCENARIOS: { id: ScenarioId; label: string; color: string; offset: number }[] = [
  { id: 'pessimiste', label: 'Pessimiste', color: '#e0806f', offset: -3 },
  { id: 'moyen', label: 'Moyen', color: '#4d86ea', offset: 0 },
  { id: 'optimiste', label: 'Optimiste', color: '#4ec38a', offset: +3 },
];

export type Scenario = {
  id: ScenarioId;
  label: string;
  color: string;
  /** The annual rate actually used, after the offset — shown to the user. */
  rate: number;
  points: SimPoint[];
  versed: number;
  finalValue: number;
  gain: number;
};

export type Projection = {
  scenarios: Scenario[];
  /** Total paid in over the whole period, identical in the three scenarios. */
  versed: number;
  years: number;
};

/**
 * Three runs of the same compounding maths, at three annual rates: the one the
 * user entered, three points below, and three points above. The spread is a
 * plain assumption, not a forecast — the rate of each scenario is displayed so
 * the numbers can be checked by hand.
 */
export function project(
  initial: number,
  contribution: number,
  years: number,
  frequency: SimFrequency,
  annualRatePercent: number,
): Projection | null {
  if (years <= 0) return null;

  const scenarios = SCENARIOS.map((scenario) => {
    const rate = Math.round((annualRatePercent + scenario.offset) * 100) / 100;
    const result = simulate(initial, contribution, years, frequency, rate);
    return {
      id: scenario.id,
      label: scenario.label,
      color: scenario.color,
      rate,
      points: result.points,
      versed: result.versed,
      finalValue: result.finalValue,
      gain: result.gain,
    };
  });

  return { scenarios, versed: scenarios[1].versed, years };
}

export type ProjectionRow = {
  year: number;
  versed: number;
  values: Record<ScenarioId, number>;
};

/**
 * Year-by-year table behind the curve, so the projection can be read as
 * numbers rather than trusted as a drawing.
 */
export function projectionTable(projection: Projection, initial: number, contribution: number, frequency: SimFrequency): ProjectionRow[] {
  const [pessimiste, moyen, optimiste] = projection.scenarios;
  const perYear = frequency === 'mensuel' ? contribution * 12 : contribution;

  return moyen.points.map((point, index) => ({
    year: point.year,
    versed: Math.round(initial + perYear * point.year),
    values: {
      pessimiste: pessimiste.points[index]?.value ?? 0,
      moyen: point.value,
      optimiste: optimiste.points[index]?.value ?? 0,
    },
  }));
}
