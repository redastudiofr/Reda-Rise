import type { AppData, ClothingItem, ClothingOrder } from './types';

/**
 * Clothing range: pieces, their shop links and the XP an order earns.
 * Ordering itself happens on the shop the link points to; the app records
 * the order when the user confirms it.
 */

export const CLOTHING_XP = { min: 1, max: 200 } as const;
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Taille unique'];

export function clampClothingXp(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 20;
  return Math.min(CLOTHING_XP.max, Math.max(CLOTHING_XP.min, n));
}

/** A starting XP from the price: 1 XP per 2 €, between 10 and 200. Editable. */
export function suggestClothingXp(price: number): number {
  return Math.min(CLOTHING_XP.max, Math.max(10, Math.round(price / 2)));
}

/** Only web links open a shop: no javascript:, data: or other schemes. */
export function safeOrderUrl(v: string | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function isLocked(item: ClothingItem, level: number): boolean {
  return Boolean(item.minLevel && level < item.minLevel);
}

/** Pieces already ordered at least once: their XP is spent. */
export function orderedIds(data: AppData): Set<string> {
  return new Set(data.wardrobe.orders.map((o) => o.itemId));
}

/** XP of each order, in order: only the first order of a piece pays. */
export function ordersWithXp(orders: ClothingOrder[]): ClothingOrder[] {
  const seen = new Set<string>();
  return [...orders]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((o) => {
      const first = !seen.has(o.itemId);
      seen.add(o.itemId);
      return first ? o : { ...o, xp: 0 };
    });
}

export function wardrobeXpOnDate(data: AppData, date: string): { label: string; xp: number }[] {
  return ordersWithXp(data.wardrobe?.orders ?? [])
    .filter((o) => o.date === date && o.xp > 0)
    .map((o) => ({ label: `Commande : ${o.name}`, xp: o.xp }));
}
