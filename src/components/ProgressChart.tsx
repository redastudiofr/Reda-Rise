'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { compactNumber, formatDate, formatShort } from '@/lib/logic';
import type { Point } from '@/lib/xp';

const PAD_L = 40;
const PAD_R = 14;
const PAD_TOP = 18;
const PAD_BOTTOM = 26;

export type Threshold = { value: number; label: string };

/** A round step so the axis reads 0 / 500 / 1 000 rather than 0 / 473 / 946. */
function niceStep(span: number, count = 3): number {
  const raw = span / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const n = raw / magnitude;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Monotone cubic path (Fritsch–Carlson): smooth, and never overshoots — a
 * cumulative curve never appears to dip between two days.
 */
function smoothPath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return '';
  if (n === 1) return `M${xs[0]} ${ys[0]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    slope.push((ys[i + 1] - ys[i]) / (dx[i] || 1));
  }
  const t: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    t.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  t.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / slope[i];
    const b = t[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * slope[i];
      t[i + 1] = k * b * slope[i];
    }
  }
  let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = xs[i] + dx[i] / 3;
    const c1y = ys[i] + (t[i] * dx[i]) / 3;
    const c2x = xs[i + 1] - dx[i] / 3;
    const c2y = ys[i + 1] - (t[i + 1] * dx[i]) / 3;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  return d;
}

/**
 * Progression chart: a smooth area curve for running totals, rounded bars for
 * per-day values. Drawn at the container's real width so text never stretches.
 * Hover, drag a finger or use the arrow keys to read any day.
 */
export default function ProgressChart({
  points,
  kind = 'line',
  format,
  formatTooltip,
  thresholds = [],
  periodLabel,
  height = 210,
  emptyLabel = 'Encore un peu d’activité et la courbe apparaît.',
}: {
  points: Point[];
  kind?: 'line' | 'bars';
  format?: (value: number) => string;
  formatTooltip?: (value: number) => string;
  /** Reference lines, e.g. the XP where the next levels start. */
  thresholds?: Threshold[];
  periodLabel?: string;
  height?: number;
  emptyLabel?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fmt = useMemo(() => format ?? ((v: number) => compactNumber(v)), [format]);
  const W = Math.max(240, width || 340);
  const H = height;

  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.value);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);

    // Only the reference lines that sit just above the data are worth showing.
    const reach = Math.max((dataMax - dataMin) * 0.6, 150);
    const refs = thresholds
      .filter((t) => t.value > dataMin && t.value <= dataMax + reach)
      .sort((a, b) => a.value - b.value)
      .slice(-2);
    const top = Math.max(dataMax, ...refs.map((r) => r.value));

    let min = kind === 'bars' ? 0 : dataMin;
    let max = top;
    if (max === min) max = min + (Math.abs(min) || 1);
    const step = niceStep(max - min);
    min = kind === 'bars' ? 0 : Math.floor(min / step) * step;
    max = Math.ceil((max + (max - min) * 0.08) / step) * step;
    const span = max - min || 1;

    const innerW = W - PAD_L - PAD_R;
    const base = H - PAD_BOTTOM;
    const slot = innerW / points.length;
    const x = (i: number) =>
      kind === 'bars' ? PAD_L + slot * i + slot / 2 : PAD_L + (i * innerW) / (points.length - 1);
    const y = (v: number) => PAD_TOP + (1 - (v - min) / span) * (base - PAD_TOP);

    // Two reference lines closer than a label's height would read as one: keep the lower.
    const shownRefs = refs.filter((r, i) => i === 0 || y(refs[i - 1].value) - y(r.value) >= 16);

    const xs = points.map((_, i) => x(i));
    const ys = points.map((p) => y(p.value));
    const line = smoothPath(xs, ys);
    const area = `${line} L${xs[xs.length - 1].toFixed(1)} ${base} L${xs[0].toFixed(1)} ${base} Z`;

    const ticks: number[] = [];
    for (let v = min; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);

    // Bars: 2px gap between neighbours, never wider than 18px.
    const barW = Math.max(2, Math.min(18, slot - 2));
    return { x, y, xs, ys, line, area, ticks, base, refs: shownRefs, barW, slot };
  }, [points, kind, thresholds, W, H]);

  if (!geo) {
    return (
      <div ref={wrapRef} className="pchart-empty">
        {emptyLabel}
      </div>
    );
  }

  const last = points.length - 1;
  const active = hover === null ? null : Math.max(0, Math.min(last, hover));
  const ap = active === null ? null : points[active];
  const shown = active ?? last;

  function indexAt(clientX: number, rect: DOMRect) {
    const localX = ((clientX - rect.left) / rect.width) * W;
    if (kind === 'bars') return Math.floor((localX - PAD_L) / geo!.slot);
    return Math.round(((localX - PAD_L) / (W - PAD_L - PAD_R)) * last);
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) setHover(indexAt(e.clientX, rect));
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') setHover(Math.max(0, (active ?? last) - 1));
    else if (e.key === 'ArrowRight') setHover(Math.min(last, (active ?? last) + 1));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  }

  const tipLeft = ap ? Math.max(0, Math.min(100, (geo.xs[active!] / W) * 100)) : 0;
  const tipTop = ap ? geo.ys[active!] : 0;
  const mid = Math.floor(last / 2);
  const first = points[0];
  const summary = `De ${fmt(first.value)} le ${formatDate(first.date)} à ${fmt(points[last].value)} le ${formatDate(points[last].date)}`;

  return (
    <div ref={wrapRef} className="pchart" data-kind={kind}>
      {periodLabel ? <div className="pchart-period">{periodLabel}</div> : null}
      <div className="pchart-stage">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          onPointerCancel={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`pc-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-strong)" stopOpacity="0.32" />
              <stop offset="70%" stopColor="var(--accent-strong)" stopOpacity="0.05" />
              <stop offset="100%" stopColor="var(--accent-strong)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`pc-line-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--brand)" />
              <stop offset="100%" stopColor="#7aa7f5" />
            </linearGradient>
          </defs>

          {geo.ticks.map((t) => (
            <g key={t}>
              <line className="pchart-grid" x1={PAD_L} x2={W - PAD_R} y1={geo.y(t)} y2={geo.y(t)} />
              <text className="pchart-axis" x={PAD_L - 8} y={geo.y(t) + 3.5} textAnchor="end">
                {fmt(t)}
              </text>
            </g>
          ))}

          {geo.refs.map((r) => (
            <g key={r.label} className="pchart-ref">
              <line x1={PAD_L} x2={W - PAD_R} y1={geo.y(r.value)} y2={geo.y(r.value)} />
              <text x={W - PAD_R} y={geo.y(r.value) - 5} textAnchor="end">
                {r.label}
              </text>
            </g>
          ))}

          {kind === 'line' ? (
            <>
              <path className="pchart-area" d={geo.area} fill={`url(#pc-fill-${uid})`} />
              <path
                className="pchart-line"
                d={geo.line}
                pathLength={1}
                fill="none"
                stroke={`url(#pc-line-${uid})`}
              />
            </>
          ) : (
            <g className="pchart-bars">
              {points.map((p, i) => {
                const h = Math.max(p.value > 0 ? 3 : 0, geo.base - geo.y(p.value));
                const bx = geo.xs[i] - geo.barW / 2;
                const r = Math.min(4, geo.barW / 2, h);
                const d =
                  h <= 0
                    ? ''
                    : `M${bx} ${geo.base} V${geo.base - h + r} Q${bx} ${geo.base - h} ${bx + r} ${geo.base - h} H${bx + geo.barW - r} Q${bx + geo.barW} ${geo.base - h} ${bx + geo.barW} ${geo.base - h + r} V${geo.base} Z`;
                return (
                  <path
                    key={p.date}
                    d={d}
                    data-on={i === shown}
                    style={{ animationDelay: `${Math.min(i * 12, 400)}ms` }}
                  />
                );
              })}
            </g>
          )}

          <line className="pchart-baseline" x1={PAD_L} x2={W - PAD_R} y1={geo.base} y2={geo.base} />

          <text className="pchart-axis" x={geo.xs[0]} y={H - 8} textAnchor={kind === 'bars' ? 'middle' : 'start'}>
            {formatShort(first.date)}
          </text>
          {last >= 4 ? (
            <text className="pchart-axis" x={geo.xs[mid]} y={H - 8} textAnchor="middle">
              {formatShort(points[mid].date)}
            </text>
          ) : null}
          <text className="pchart-axis" x={geo.xs[last]} y={H - 8} textAnchor={kind === 'bars' ? 'middle' : 'end'}>
            {formatShort(points[last].date)}
          </text>

          {ap ? (
            <line className="pchart-cursor" x1={geo.xs[active!]} x2={geo.xs[active!]} y1={PAD_TOP} y2={geo.base} />
          ) : null}
          {kind === 'line' ? (
            <>
              {ap ? null : <circle className="pchart-pulse" cx={geo.xs[last]} cy={geo.ys[last]} r="4" />}
              <circle
                className="pchart-dot"
                cx={geo.xs[shown]}
                cy={geo.ys[shown]}
                r="4.5"
              />
            </>
          ) : null}
        </svg>

        {ap ? (
          <div
            className="pchart-tip"
            style={{ left: `${tipLeft}%`, top: Math.max(0, tipTop - 12) }}
            data-edge={tipLeft < 18 ? 'start' : tipLeft > 82 ? 'end' : undefined}
          >
            <b className="mono">{(formatTooltip ?? fmt)(ap.value)}</b>
            <span>{formatDate(ap.date)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
