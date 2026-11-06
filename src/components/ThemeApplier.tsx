'use client';

import { useEffect, useMemo } from 'react';
import { useData } from './DataProvider';
import { dayXp } from '@/lib/logic';
import { activeCosmetics } from '@/lib/unlocks';
import { levelFromXp, totalXpOf } from '@/lib/xp';

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Puts the colour theme the user unlocked and chose on the whole app. */
export default function ThemeApplier() {
  const { data } = useData();
  const level = useMemo(() => levelFromXp(totalXpOf(data, dayXp)).level, [data]);
  const { theme } = activeCosmetics(data.settings.cosmetics, level);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', theme.accent);
    root.setProperty('--accent-strong', theme.strong);
    root.setProperty('--brand', theme.brand);
    root.setProperty('--accent-dim', rgba(theme.accent, 0.15));
    root.setProperty('--accent-line', rgba(theme.strong, 0.42));
    if (theme.neon) document.documentElement.dataset.neon = 'true';
    else delete document.documentElement.dataset.neon;
  }, [theme]);

  return null;
}
