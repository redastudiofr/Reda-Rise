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

/** The only shop pieces can be bought from. */
export const SHOP_URL = 'https://redastudio.fr';
export const SHOP_HOST = 'redastudio.fr';

/**
 * A link to a page of redastudio.fr, or null. Anything else — another shop,
 * javascript:, http — is refused. A bare path ("/products/hoodie") is
 * completed with the shop's address.
 */
export function safeOrderUrl(v: string | undefined): string | null {
  const raw = (v ?? '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith('/') ? `${SHOP_URL}${raw}` : /^[a-z]+:/i.test(raw) ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || (host !== SHOP_HOST && !host.endsWith(`.${SHOP_HOST}`))) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Photos are either resized in the app (data URL) or served by the shop over https. */
export function safePhoto(v: string | undefined): string | undefined {
  if (!v) return undefined;
  if (/^data:image\/(jpeg|png|webp);base64,/.test(v)) return v;
  try {
    return new URL(v).protocol === 'https:' ? v : undefined;
  } catch {
    return undefined;
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
