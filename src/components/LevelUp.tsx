'use client';

import { useEffect, useMemo, useState } from 'react';
import { useData } from './DataProvider';
import LevelBadge from './LevelBadge';
import { dayXp } from '@/lib/logic';
import { levelFromXp, levelTitle, tierOf, totalXpOf } from '@/lib/xp';

/** Last level this device has celebrated. Per device on purpose: it only decides when to animate. */
const SEEN_KEY = 'telos:level-seen';

function readSeen(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeSeen(level: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(level));
  } catch {
    /* private mode: the celebration may simply show again */
  }
}

/**
 * Watches the level and celebrates each level-up once, wherever the XP was
 * earned. The mark only ever goes up: undoing a tick then redoing it does not
 * replay the animation for a level already celebrated.
 */
export default function LevelUp() {
  const { data } = useData();
  const level = useMemo(() => levelFromXp(totalXpOf(data, dayXp)).level, [data]);
  const [shown, setShown] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => {
    const seen = readSeen();
    if (seen === null) {
      // First visit on this device: nothing to celebrate yet.
      writeSeen(level);
      return;
    }
    if (level > seen) {
      setShown({ from: seen, to: level });
      writeSeen(level);
    }
  }, [level]);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 4200);
    return () => clearTimeout(t);
  }, [shown]);

  if (!shown) return null;

  const gained = shown.to - shown.from;
  const newTier = tierOf(shown.to);
  const tierChanged = newTier.id !== tierOf(shown.from).id;

  return (
    <div
      className="levelup"
      role="dialog"
      aria-live="assertive"
      aria-label={`Niveau ${shown.to} atteint`}
      onClick={() => setShown(null)}
      style={{ ['--tier' as string]: newTier.color }}
    >
      <div className="levelup-card" onClick={(e) => e.stopPropagation()}>
        <div className="levelup-rays" aria-hidden />
        <div className="levelup-badge">
          <LevelBadge level={shown.to} size={96} />
        </div>
        <div className="levelup-kicker">
          Niveau supérieur{gained > 1 ? ` · +${gained} niveaux` : ''}
        </div>
        <div className="levelup-title">
          Niveau {shown.to} — {levelTitle(shown.to)}
        </div>
        {tierChanged ? (
          <div className="levelup-tier">Nouveau palier : {newTier.label}</div>
        ) : null}
        <button className="btn btn-accent levelup-btn" onClick={() => setShown(null)} autoFocus>
          Continuer
        </button>
      </div>
    </div>
  );
}
