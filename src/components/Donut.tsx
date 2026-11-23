'use client';

export type Slice = { key: string; label: string; value: number; color: string };

/**
 * Ring chart for a breakdown — where the money went, how the portfolio is
 * split. Deliberately plain: one ring, the total in the middle, and the legend
 * carried by the list next to it rather than by labels on the chart.
 */
export default function Donut({
  slices,
  total,
  caption,
  size = 132,
}: {
  slices: Slice[];
  /** Figure printed in the middle, already formatted. */
  total: string;
  caption?: string;
  size?: number;
}) {
  const sum = slices.reduce((a, s) => a + s.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  if (sum <= 0) {
    return (
      <svg className="donut" viewBox="0 0 140 140" width={size} height={size} role="img" aria-label="Aucune donnée">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
        <text x="70" y="74" textAnchor="middle" fill="var(--muted-2)" fontSize="12">
          —
        </text>
      </svg>
    );
  }

  let offset = 0;

  return (
    <svg
      className="donut"
      viewBox="0 0 140 140"
      width={size}
      height={size}
      role="img"
      aria-label={caption ?? 'Répartition'}
    >
      <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="16" />
      {slices.map((slice) => {
        const length = (slice.value / sum) * circumference;
        const dash = `${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`;
        const element = (
          <circle
            key={slice.key}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="16"
            strokeDasharray={dash}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform="rotate(-90 70 70)"
          />
        );
        offset += length;
        return element;
      })}
      <text x="70" y="68" textAnchor="middle" fill="var(--text)" fontSize="15" fontWeight="640">
        {total}
      </text>
      {caption ? (
        <text x="70" y="84" textAnchor="middle" fill="var(--muted-2)" fontSize="9">
          {caption}
        </text>
      ) : null}
    </svg>
  );
}
