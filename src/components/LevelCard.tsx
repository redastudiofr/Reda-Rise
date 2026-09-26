import Link from 'next/link';
import LevelBadge from './LevelBadge';
import { tierOf, type LevelState } from '@/lib/xp';

/** Current level at a glance — badge, name, progress — opening the progression page. */
export default function LevelCard({
  level,
  children,
}: {
  level: LevelState;
  children?: React.ReactNode;
}) {
  const pct = Math.floor(level.progress * 100);
  return (
    <div className="level-card lvl-card" style={{ ['--tier' as string]: tierOf(level.level).color }}>
      <Link href="/progression" className="lvl-card-link" aria-label="Voir ma progression">
        <LevelBadge level={level.level} size={58} />
        <span className="lvl-card-id">
          <span className="level-tag">Niveau {level.level}</span>
          <span className="lvl-card-title">{level.title}</span>
          <span className="level-xp mono">{level.total.toLocaleString('fr-FR')} XP au total</span>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 5.5 15.5 12 9 18.5" />
        </svg>
      </Link>
      <div className="bar">
        <i style={{ width: `${Math.round(level.progress * 100)}%` }} />
      </div>
      <div className="lvl-card-foot mono">
        <span>
          {level.intoLevel} / {level.needed} XP · {pct} %
        </span>
        <span>
          Encore {level.toNext} XP → {level.nextTitle}
        </span>
      </div>
      {children}
    </div>
  );
}
