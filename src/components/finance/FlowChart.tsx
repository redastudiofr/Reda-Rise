'use client';

import { useEffect, useRef, useState } from 'react';
import { FLOW_COLORS, type MonthFlow } from '@/lib/finance';
import { formatMoney, formatMoneyExact } from '@/lib/business';

const PAD_L = 44;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 24;

function niceStep(span: number): number {
  const raw = span / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

function monthShort(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace('.', '');
}

function monthLong(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * Income next to spending, month by month. Hover, tap or use the arrow keys
 * on a month to read both amounts and the balance.
 */
export default function FlowChart({
  flows,
  height = 190,
  labels = { revenus: 'Revenus', depenses: 'Dépenses' },
}: {
  flows: MonthFlow[];
  height?: number;
  /** Series names, e.g. « Chiffre d’affaires » for a company. */
  labels?: { revenus: string; depenses: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(1, ...flows.flatMap((f) => [f.revenus, f.depenses]));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const innerW = width - PAD_L - PAD_R;
  const base = height - PAD_B;
  const slot = innerW / flows.length;
  const barW = Math.max(3, Math.min(16, (slot - 10) / 2));
  const y = (v: number) => PAD_T + (1 - v / top) * (base - PAD_T);
  const empty = flows.every((f) => f.revenus === 0 && f.depenses === 0);

  function bar(x: number, v: number) {
    const h = Math.max(v > 0 ? 2 : 0, base - y(v));
    if (h <= 0) return '';
    const r = Math.min(4, barW / 2, h);
    return `M${x} ${base} V${base - h + r} Q${x} ${base - h} ${x + r} ${base - h} H${x + barW - r} Q${x + barW} ${base - h} ${x + barW} ${base - h + r} V${base} Z`;
  }

  const a = active === null ? null : flows[active];

  return (
    <div className="flow" ref={ref}>
      <div className="flow-legend">
        <span>
          <i style={{ background: FLOW_COLORS.revenus }} /> {labels.revenus}
        </span>
        <span>
          <i style={{ background: FLOW_COLORS.depenses }} /> {labels.depenses}
        </span>
      </div>
      {empty ? (
        <div className="pchart-empty">Ajoute un revenu ou une dépense : l’évolution apparaîtra ici.</div>
      ) : (
        <div className="flow-stage">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${labels.revenus} et ${labels.depenses.toLowerCase()} sur ${flows.length} mois`}
            tabIndex={0}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setActive(Math.max(0, (active ?? flows.length) - 1));
              else if (e.key === 'ArrowRight') setActive(Math.min(flows.length - 1, (active ?? -1) + 1));
              else if (e.key === 'Escape') setActive(null);
              else return;
              e.preventDefault();
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line className="pchart-grid" x1={PAD_L} x2={width - PAD_R} y1={y(t)} y2={y(t)} />
                <text className="pchart-axis" x={PAD_L - 8} y={y(t) + 3.5} textAnchor="end">
                  {t >= 1000 ? `${(t / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}k` : t}
                </text>
              </g>
            ))}
            {flows.map((f, i) => {
              const cx = PAD_L + slot * i + slot / 2;
              return (
                <g
                  key={f.month}
                  className="flow-month"
                  data-on={active === i}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                >
                  <rect x={PAD_L + slot * i} y={PAD_T} width={slot} height={base - PAD_T} fill="transparent" />
                  <path d={bar(cx - barW - 1, f.revenus)} fill={FLOW_COLORS.revenus} />
                  <path d={bar(cx + 1, f.depenses)} fill={FLOW_COLORS.depenses} />
                  <text className="pchart-axis" x={cx} y={height - 8} textAnchor="middle">
                    {monthShort(f.month)}
                  </text>
                </g>
              );
            })}
            <line className="pchart-baseline" x1={PAD_L} x2={width - PAD_R} y1={base} y2={base} />
          </svg>
          {a ? (
            <div
              className="pchart-tip flow-tip"
              style={{
                left: `${((PAD_L + slot * active! + slot / 2) / width) * 100}%`,
                top: Math.max(0, y(Math.max(a.revenus, a.depenses)) - 10),
              }}
              data-edge={active! < 1 ? 'start' : active! >= flows.length - 1 ? 'end' : undefined}
            >
              <span>{monthLong(a.month)}</span>
              <b className="mono">+{formatMoneyExact(a.revenus)}</b>
              <b className="mono">−{formatMoneyExact(a.depenses)}</b>
              <span className="mono">Solde {formatMoney(a.revenus - a.depenses)}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
