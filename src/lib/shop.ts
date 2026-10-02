import { SHOP_URL, safeOrderUrl, safePhoto } from './wardrobe';

/**
 * Reading the redastudio.fr catalogue. The shop's public product feed is
 * read on the server: Shopify (`/products.json`) or WooCommerce (Store API),
 * the two platforms that publish one without a key.
 */

export type ShopProduct = {
  shopId: string;
  name: string;
  price: number;
  photo?: string;
  sizes: string[];
  orderUrl: string;
  description?: string;
};

const SIZE_OPTION = /taille|size|pointure/i;

function text(html: unknown): string | undefined {
  if (typeof html !== 'string') return undefined;
  const t = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&rsquo;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();
  return t ? t.slice(0, 400) : undefined;
}

type ShopifyProduct = {
  id: number | string;
  title?: string;
  handle?: string;
  body_html?: string;
  options?: { name?: string; values?: string[] }[];
  variants?: { price?: string; title?: string; available?: boolean }[];
  images?: { src?: string }[];
};

export function fromShopify(json: unknown): ShopProduct[] | null {
  const products = (json as { products?: ShopifyProduct[] })?.products;
  if (!Array.isArray(products)) return null;
  return products.flatMap((p) => {
    const orderUrl = p.handle ? safeOrderUrl(`/products/${encodeURIComponent(p.handle)}`) : null;
    const price = Number(p.variants?.[0]?.price);
    if (!p.title || !orderUrl || !Number.isFinite(price)) return [];
    const sizeOption = p.options?.find((o) => SIZE_OPTION.test(o.name ?? ''));
    const sizes = sizeOption?.values?.length
      ? sizeOption.values
      : (p.variants ?? []).map((v) => v.title ?? '').filter((t) => t && t !== 'Default Title');
    return [
      {
        shopId: `shopify:${p.id}`,
        name: p.title.slice(0, 60),
        price: Math.round(price * 100) / 100,
        photo: safePhoto(p.images?.[0]?.src),
        sizes: sizes.length ? [...new Set(sizes)].slice(0, 12) : ['Taille unique'],
        orderUrl,
        description: text(p.body_html),
      },
    ];
  });
}

type WooProduct = {
  id: number;
  name?: string;
  permalink?: string;
  short_description?: string;
  description?: string;
  prices?: { price?: string; currency_minor_unit?: number };
  images?: { src?: string }[];
  attributes?: { name?: string; terms?: { name?: string }[] }[];
};

export function fromWoo(json: unknown): ShopProduct[] | null {
  if (!Array.isArray(json)) return null;
  return (json as WooProduct[]).flatMap((p) => {
    const orderUrl = safeOrderUrl(p.permalink);
    const minor = p.prices?.currency_minor_unit ?? 2;
    const price = Number(p.prices?.price) / 10 ** minor;
    if (!p.name || !orderUrl || !Number.isFinite(price)) return [];
    const sizes = (p.attributes?.find((a) => SIZE_OPTION.test(a.name ?? ''))?.terms ?? []).map((t) => t.name ?? '').filter(Boolean);
    return [
      {
        shopId: `woo:${p.id}`,
        name: (text(p.name) ?? p.name).slice(0, 60),
        price: Math.round(price * 100) / 100,
        photo: safePhoto(p.images?.[0]?.src),
        sizes: sizes.length ? sizes.slice(0, 12) : ['Taille unique'],
        orderUrl,
        description: text(p.short_description || p.description),
      },
    ];
  });
}

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.text();
    if (body.length > 5_000_000) return null;
    return JSON.parse(body);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** The shop's products, or null when no public feed answers. */
export async function fetchCatalogue(base = process.env.SHOP_FEED_URL || SHOP_URL): Promise<ShopProduct[] | null> {
  const root = base.replace(/\/$/, '');
  const shopify = fromShopify(await getJson(`${root}/products.json?limit=250`));
  if (shopify && shopify.length) return shopify;
  const woo = fromWoo(await getJson(`${root}/wp-json/wc/store/v1/products?per_page=100`));
  if (woo && woo.length) return woo;
  return shopify ?? woo;
}
