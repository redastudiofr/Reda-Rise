'use client';

import { useEffect, useState } from 'react';

/**
 * Anneau de progression animé. `value` entre 0 et 1.
 * Le trait se remplit en douceur quand la valeur change.
 */
export function Ring({
  value,
  size = 62,
  stroke = 4,
  className = '',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, value));

  // Démarre à 0 puis anime vers la valeur réelle au montage.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div className={`today-ring ${className}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="bar"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
        />
      </svg>
      {children}
    </div>
  );
}
