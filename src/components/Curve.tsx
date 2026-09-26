'use client';

import { useId, useMemo, useState } from 'react';
import { compactNumber, formatDate, formatShort } from '@/lib/logic';
import type { Point } from '@/lib/xp';

const W = 340;
const H = 180;
const PAD_L = 46;
const PAD_R = 10;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

/** A round-ish step so the axis reads 0 / 250 / 500 rather than 0 / 237 / 474. */
function niceStep(span: number): number {
  const raw = span / 2;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Area + line chart used for every progression metric and for the money curve.
 * Hover — or drag a finger — anywhere on it to read the exact value on a date.
 */
export default function Curve({
  points,
  suffix = '',
  format,
  formatTooltip,
  periodLabel,
  color = '#3874dc',
  emptyLabel = 'Encore un peu de données et la courbe apparaît.',
}: {
  points: Point[];
  suffix?: string;
  /** Overrides the default "rounded value + suffix" rendering on the axis. */
  format?: (value: number) => string;
  /** Tooltip rendering when it should be more precise than the axis. */
  formatTooltip?: (value: number) => string;
  /** Shown above the chart, e.g. "1 mars → 30 mars". */
  periodLabel?: string;
  color?: string;
  emptyLabel?: string;
}) {
  const gradientId = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const fmt = useMemo(
    () => format ?? ((v: number) => `${compactNumber(v)}${suffix}`),
    [format, suffix],
  );

  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    // A flat line still needs a band to sit in the middle of.
    let min = rawMin;
    let max = rawMax;
    if (min === max) {
      const pad = Math.abs(min) * 0.1 || 1;
      min -= pad;
      max += pad;
    } else {
      const pad = (max - min) * 0.12;
      min -= pad;
      max += pad;
    }
    const span = max - min || 1;

    const x = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / (points.length - 1);
    const y = (v: number) => PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);

    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
      .join(' ');
    const baseline = H - PAD_BOTTOM;
    const area = `${line} L${x(points.length - 1).toFixed(1)} ${baseline} L${x(0).toFixed(1)} ${baseline} Z`;

    // Two to four horizontal guides, on round values inside the visible band.
    const step = niceStep(rawMax - rawMin || Math.abs(rawMax) || 1);
    const ticks: number[] = [];
    const firstTick = Math.ceil(min / step) * step;
    for (let v = firstTick; v <= max + step * 0.001 && ticks.length < 4; v += step) {
      ticks.push(Math.round(v * 1e6) / 1e6);
    }
    if (ticks.length === 0) ticks.push(rawMin);

    return { x, y, line, area, ticks, baseline };
  }, [points]);

  if (!geometry) return <div className="empty">{emptyLabel}</div>;

  const { x, y, line, area, ticks, baseline } = geometry;
  const lastIndex = points.length - 1;
  const active = hover === null ? null : Math.min(lastIndex, Math.max(0, hover));
  const activePoint = active === null ? null : points[active];

  /** Turns a pointer position into the nearest plotted index. */
  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const localX = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = (localX - PAD_L) / (W - PAD_L - PAD_R);
    setHover(Math.round(ratio * lastIndex));
  }

  const tooltipValue = activePoint ? (formatTooltip ?? fmt)(activePoint.value) : '';
  const tooltipDate = activePoint ? formatDate(activePoint.date) : '';
  const tooltipWidth = Math.max(tooltipValue.length, tooltipDate.length) * 5.3 + 18;
  // Kept inside the viewBox whichever point is hovered.
  const tooltipX =
    active === null
      ? 0
      : Math.max(2, Math.min(W - tooltipWidth - 2, x(active) - tooltipWidth / 2));

  const midIndex = Math.floor(lastIndex / 2);

  return (
    <div className="chart-wrap">
      {periodLabel ? <div className="chart-period">{periodLabel}</div> : null}
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Courbe du ${formatDate(points[0].date)} au ${formatDate(points[lastIndex].date)}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border-soft)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text x={PAD_L - 7} y={y(t) + 3} fill="var(--muted-2)" fontSize="8.5" textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}

        <path className="curve-area" d={area} fill={`url(#fill-${gradientId})`} />
        <path
          className="curve-line"
          d={line}
          pathLength={1}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {active === null ? (
          <circle cx={x(lastIndex)} cy={y(points[lastIndex].value)} r="3.2" fill={color} />
        ) : null}

        <text x={PAD_L} y={H - 6} fill="var(--muted-2)" fontSize="8.5">
          {formatShort(points[0].date)}
        </text>
        {lastIndex >= 4 ? (
          <text x={x(midIndex)} y={H - 6} fill="var(--muted-2)" fontSize="8.5" textAnchor="middle">
            {formatShort(points[midIndex].date)}
          </text>
        ) : null}
        <text x={W - PAD_R} y={H - 6} fill="var(--muted-2)" fontSize="8.5" textAnchor="end">
          {formatShort(points[lastIndex].date)}
        </text>

        {activePoint && active !== null ? (
          <g className="chart-cursor">
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD_TOP}
              y2={baseline}
              stroke={color}
              strokeOpacity="0.45"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={x(active)}
              cy={y(activePoint.value)}
              r="4"
              fill={color}
              stroke="var(--surface)"
              strokeWidth="2"
            />
            <rect
              x={tooltipX}
              y={4}
              width={tooltipWidth}
              height={30}
              rx="7"
              fill="var(--surface-2)"
              stroke="var(--border)"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={tooltipX + tooltipWidth / 2}
              y={17}
              fill="var(--text)"
              fontSize="10"
              fontWeight="600"
              textAnchor="middle"
            >
              {tooltipValue}
            </text>
            <text
              x={tooltipX + tooltipWidth / 2}
              y={28}
              fill="var(--muted)"
              fontSize="8"
              textAnchor="middle"
            >
              {tooltipDate}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
