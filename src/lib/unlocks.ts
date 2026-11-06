import type { ClothingItem, Cosmetics } from './types';

/**
 * Things unlocked by reaching a level: colour themes for the whole app,
 * frames around the profile photo, titles. Exclusive clothing pieces
 * (ClothingItem.minLevel) unlock the same way and are listed alongside.
 */

export type ThemeDef = {
  id: string;
  label: string;
  level: number;
  /** Buttons and fills (white text on top). */
  accent: string;
  /** Links, values and glows on the dark background. */
  strong: string;
  brand: string;
  /** Adds a light glow to the accent elements. */
  neon?: boolean;
};

export const THEMES: ThemeDef[] = [
  { id: 'bordeaux', label: 'Bordeaux', level: 1, accent: '#b9334f', strong: '#e25a72', brand: '#5c1324' },
  { id: 'rubis', label: 'Rubis', level: 5, accent: '#c4213f', strong: '#ff5574', brand: '#6a0f22' },
  { id: 'grenat', label: 'Grenat', level: 9, accent: '#8f2a44', strong: '#dc6d84', brand: '#4a1020' },
  { id: 'cuivre', label: 'Cuivre', level: 14, accent: '#9e4f27', strong: '#e8905f', brand: '#51250f' },
  { id: 'or', label: 'Or', level: 20, accent: '#8a6519', strong: '#e3b64c', brand: '#4a360a' },
  { id: 'neon', label: 'Néon rouge', level: 25, accent: '#d1123f', strong: '#ff3d6e', brand: '#6e0820', neon: true },
  { id: 'platine', label: 'Platine', level: 35, accent: '#55656e', strong: '#c3d3da', brand: '#2a3338' },
  { id: 'mythique', label: 'Mythique', level: 50, accent: '#7a2bd6', strong: '#c39bff', brand: '#3a1470', neon: true },
];

export type FrameDef = { id: string; label: string; level: number; color: string; glow?: boolean };

export const FRAMES: FrameDef[] = [
  { id: 'bordeaux', label: 'Cadre bordeaux', level: 3, color: '#b9334f' },
  { id: 'argent', label: 'Cadre argent', level: 8, color: '#c3ccd8' },
  { id: 'or', label: 'Cadre or', level: 12, color: '#e3b64c' },
  { id: 'neon', label: 'Cadre néon', level: 20, color: '#ff3d6e', glow: true },
  { id: 'diamant', label: 'Cadre diamant', level: 30, color: '#e9f1ff', glow: true },
  { id: 'mythique', label: 'Cadre mythique', level: 50, color: '#c39bff', glow: true },
];

export type TitleDef = { id: string; label: string; level: number };

export const TITLES: TitleDef[] = [
  { id: 'recrue', label: 'Recrue', level: 2 },
  { id: 'batisseur', label: 'Bâtisseur', level: 4 },
  { id: 'grinder', label: 'Grinder', level: 7 },
  { id: 'entrepreneur', label: 'Entrepreneur', level: 10 },
  { id: 'visionnaire', label: 'Visionnaire', level: 15 },
  { id: 'boss', label: 'Boss', level: 20 },
  { id: 'icone', label: 'Icône', level: 30 },
  { id: 'legende', label: 'Légende', level: 40 },
  { id: 'legende-rr', label: 'Légende Reda Rise', level: 50 },
];

export type UnlockKind = 'theme' | 'frame' | 'title' | 'vetement';

export type Unlock = { kind: UnlockKind; id: string; label: string; level: number };

export const KIND_LABEL: Record<UnlockKind, string> = {
  theme: 'Thème',
  frame: 'Profil',
  title: 'Titre',
  vetement: 'Pièce exclusive',
};

/** Every unlockable, by level. The default theme is a given, not an unlock. */
export function allUnlocks(items: ClothingItem[] = []): Unlock[] {
  return [
    ...THEMES.filter((t) => t.level > 1).map((t) => ({ kind: 'theme' as const, id: t.id, label: `Thème ${t.label}`, level: t.level })),
    ...FRAMES.map((f) => ({ kind: 'frame' as const, id: f.id, label: f.label, level: f.level })),
    ...TITLES.map((t) => ({ kind: 'title' as const, id: t.id, label: `Titre « ${t.label} »`, level: t.level })),
    ...items
      .filter((i) => !i.archived && i.minLevel && i.minLevel > 1)
      .map((i) => ({ kind: 'vetement' as const, id: i.id, label: i.name, level: i.minLevel! })),
  ].sort((a, b) => a.level - b.level || a.label.localeCompare(b.label, 'fr'));
}

/** What a level-up from `from` to `to` opens. */
export function unlockedBetween(from: number, to: number, items: ClothingItem[] = []): Unlock[] {
  return allUnlocks(items).filter((u) => u.level > from && u.level <= to);
}

/** The cosmetics actually worn: anything not (or no longer) unlocked falls back to the default. */
export function activeCosmetics(c: Cosmetics | undefined, level: number) {
  const theme = THEMES.find((t) => t.id === c?.theme && level >= t.level) ?? THEMES[0];
  const frame = FRAMES.find((f) => f.id === c?.frame && level >= f.level) ?? null;
  const title = TITLES.find((t) => t.id === c?.title && level >= t.level) ?? null;
  return { theme, frame, title };
}
