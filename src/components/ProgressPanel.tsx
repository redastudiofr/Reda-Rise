'use client';

import { useMemo, useState } from 'react';
import { useData } from './DataProvider';
import ProgressChart, { type Threshold } from './ProgressChart';
import { dayXp, formatDate } from '@/lib/logic';
import {
  METRICS,
  RANGES,
  levelFromXp,
  series,
  totalXpOf,
  xpForLevel,
  type MetricId,
  type RangeId,
} from '@/lib/xp';

/**
 * The progression chart with its metric and period switches. Running totals
 * are drawn as a curve with the next levels as reference lines; per-day
 * values as bars.
 */
export default function ProgressPanel({ defaultRange = '30j' }: { defaultRange?: RangeId }) {
  const { data } = useData();
  const tz = data.settings.timezone;
  const [metric, setMetric] = useState<MetricId>('xpCumule');
  const [range, setRange] = useState<RangeId>(defaultRange);

  const points = useMemo(() => series(data, tz, metric, range, dayXp), [data, tz, metric, range]);
  const level = useMemo(() => levelFromXp(totalXpOf(data, dayXp)).level, [data]);

  const thresholds = useMemo<Threshold[]>(() => {
    if (metric !== 'xpCumule') return [];
    const out: Threshold[] = [];
    for (let l = 2; l <= level + 2; l++) out.push({ value: xpForLevel(l), label: `Niv. ${l}` });
    return out;
  }, [metric, level]);

  const kind = metric === 'xpJour' || metric === 'objectifs' ? 'bars' : 'line';
  const format =
    metric === 'niveau'
      ? (v: number) => `Niv. ${Math.round(v)}`
      : metric === 'objectifs'
        ? (v: number) => String(Math.round(v))
        : (v: number) =>
            Math.abs(v) >= 1000
              ? `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}k`
              : String(Math.round(v));
  const tooltip =
    metric === 'niveau'
      ? (v: number) => `Niveau ${Math.round(v)}`
      : metric === 'objectifs'
        ? (v: number) => `${Math.round(v)} objectif${Math.round(v) > 1 ? 's' : ''}`
        : (v: number) => `${Math.round(v).toLocaleString('fr-FR')} XP`;

  const first = points[0];
  const last = points[points.length - 1];
  const delta = first && last && metric === 'xpCumule' ? last.value - first.value : null;
  const periodLabel =
    points.length > 1 ? `${formatDate(first.date)} → ${formatDate(last.date)}` : undefined;

  return (
    <div className="card pchart-card">
      <div className="segmented pchart-metrics">
        {METRICS.map((m) => (
          <button key={m.id} data-on={m.id === metric} onClick={() => setMetric(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="pill-row pchart-ranges">
        {RANGES.map((r) => (
          <button key={r.id} className="pill" data-on={r.id === range} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
      {delta !== null && delta > 0 ? (
        <div className="pchart-delta">
          <b className="mono">+{delta.toLocaleString('fr-FR')} XP</b> sur la période
        </div>
      ) : null}
      <ProgressChart
        key={`${metric}-${range}`}
        points={points}
        kind={kind}
        format={format}
        formatTooltip={tooltip}
        thresholds={thresholds}
        periodLabel={periodLabel}
      />
    </div>
  );
}
