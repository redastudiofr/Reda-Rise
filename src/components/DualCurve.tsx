'use client';

type Series = { label: string; color: string; points: { year: number; value: number }[] };

/** Two-line comparison chart, used for the S&P 500 vs CAC 40 simulation. */
export default function DualCurve({ series, suffix = '' }: { series: Series[]; suffix?: string }) {
  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length < 2) return null;

  const W = 320;
  const H = 170;
  const padX = 6;
  const padTop = 16;
  const padBottom = 20;

  const maxYear = Math.max(...allPoints.map((p) => p.year));
  const values = allPoints.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const span = max - min || 1;

  const x = (year: number) => padX + (year / maxYear) * (W - padX * 2);
  const y = (v: number) => padTop + (1 - (v - min) / span) * (H - padTop - padBottom);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {series.map((s) => {
        const line = s.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.year).toFixed(1)} ${y(p.value).toFixed(1)}`)
          .join(' ');
        return (
          <path
            key={s.label}
            d={line}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      <text x={padX} y={12} fill="#5b626d" fontSize="9">
        {Math.round(max)}
        {suffix}
      </text>
      <text x={W - padX} y={H - 5} fill="#5b626d" fontSize="9" textAnchor="end">
        {maxYear} ans
      </text>
    </svg>
  );
}
