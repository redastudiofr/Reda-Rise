import { tierOf } from '@/lib/xp';

/**
 * The level emblem: a hexagon in the colour of the level's tier (bronze,
 * argent, or…), with the level number in the middle.
 */
export default function LevelBadge({ level, size = 56 }: { level: number; size?: number }) {
  const tier = tierOf(level);
  const id = `lb-${tier.id}`;
  const digits = String(level).length;
  return (
    <span
      className="level-badge"
      style={{ width: size, height: size, ['--tier' as string]: tier.color }}
      role="img"
      aria-label={`Niveau ${level}, palier ${tier.label}`}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor={tier.color} stopOpacity="0.38" />
            <stop offset="100%" stopColor={tier.color} stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tier.color} />
            <stop offset="100%" stopColor={tier.color} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <path
          d="M32 3.5 56.7 17.75v28.5L32 60.5 7.3 46.25v-28.5Z"
          fill={`url(#${id}-fill)`}
          stroke={`url(#${id}-edge)`}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M32 10.5 50.6 21.25v21.5L32 53.5 13.4 42.75v-21.5Z"
          fill="none"
          stroke={tier.color}
          strokeOpacity="0.22"
          strokeWidth="1"
        />
        <text
          x="32"
          y="33"
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text)"
          fontSize={digits >= 3 ? 17 : digits === 2 ? 21 : 24}
          fontWeight="700"
          style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}
        >
          {level}
        </text>
      </svg>
    </span>
  );
}
