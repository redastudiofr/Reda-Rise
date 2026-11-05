import { env, type ShopConfig } from './env';
import { ServiceError, fetchJson } from './http';
import { dayRange, parisIso, type DayKey } from './time';

/**
 * Admin GraphQL API. A shop gives either an access token (shpat_…) or a
 * Dev Dashboard app's client id + secret, exchanged for a 24 h token
 * (client credentials grant).
 */
const tokens = new Map<string, { token: string; exp: number }>();

const base = (s: ShopConfig) => env.shopifyBase() || `https://${s.domain}`;

async function tokenFor(s: ShopConfig): Promise<string> {
  if (s.token) return s.token;
  if (!s.clientId || !s.clientSecret) throw new ServiceError('not_configured', 'Jeton manquant.');
  const cached = tokens.get(s.id);
  if (cached && cached.exp - 60_000 > Date.now()) return cached.token;
  const r = await fetchJson<{ access_token: string; expires_in?: number }>(
    `${base(s)}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: s.clientId, client_secret: s.clientSecret }),
    },
    10_000,
  );
  tokens.set(s.id, { token: r.access_token, exp: Date.now() + (r.expires_in ?? 86_399) * 1000 });
  return r.access_token;
}

async function gql<T>(s: ShopConfig, query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetchJson<{ data?: T; errors?: { message: string }[] | string }>(
    `${base(s)}/admin/api/${env.shopifyApiVersion()}/graphql.json`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': await tokenFor(s) },
      body: JSON.stringify({ query, variables }),
    },
    15_000,
  );
  if (r.errors) {
    const msg = typeof r.errors === 'string' ? r.errors : r.errors.map((e) => e.message).join('; ');
    throw new ServiceError(/access|scope|permission/i.test(msg) ? 'auth' : 'bad_response', msg.slice(0, 200));
  }
  return r.data as T;
}

const ORDERS = `query Orders($q: String!, $after: String) {
  orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      name
      test
      cancelledAt
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      lineItems(first: 50) { nodes { title quantity } }
    }
  }
}`;

type OrdersPage = {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      name: string;
      test: boolean;
      cancelledAt: string | null;
      currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
      lineItems: { nodes: { title: string; quantity: number }[] };
    }[];
  };
};

export type ShopDay = { shop: string; orders: number; revenue: number; currency: string; top: { title: string; quantity: number }[] };

export async function salesOfDay(s: ShopConfig, day: DayKey): Promise<ShopDay> {
  const { start, end } = dayRange(day);
  const q = `created_at:>='${parisIso(start)}' AND created_at:<'${parisIso(end)}'`;
  let after: string | null = null;
  let orders = 0;
  let cents = 0;
  let currency = 'EUR';
  const qty = new Map<string, number>();
  for (let page = 0; page < 20; page++) {
    const d: OrdersPage = await gql<OrdersPage>(s, ORDERS, { q, after });
    for (const o of d.orders.nodes) {
      if (o.test || o.cancelledAt) continue;
      orders++;
      cents += Math.round(Number(o.currentTotalPriceSet.shopMoney.amount) * 100);
      currency = o.currentTotalPriceSet.shopMoney.currencyCode;
      for (const li of o.lineItems.nodes) qty.set(li.title, (qty.get(li.title) ?? 0) + li.quantity);
    }
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
  }
  const top = [...qty.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([title, quantity]) => ({ title, quantity }));
  return { shop: s.name, orders, revenue: cents / 100, currency, top };
}

export function money(n: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
}

export function speakShops(days: ShopDay[], failed: string[]): string {
  if (days.length === 0 && failed.length === 0) return 'Aucune boutique Shopify configurée.';
  const parts = days.map((d) => {
    if (d.orders === 0) return `${d.shop} : aucune commande hier. Les clients se font désirer.`;
    const top = d.top.length ? ` En tête : ${d.top.map((t) => `${t.title}, ${t.quantity} vendu${t.quantity > 1 ? 's' : ''}`).join(' ; ')}.` : '';
    return `${d.shop} : ${money(d.revenue, d.currency)} de chiffre d'affaires, ${d.orders} commande${d.orders > 1 ? 's' : ''}.${top}`;
  });
  if (failed.length) parts.push(`${failed.join(' et ')} ne ${failed.length > 1 ? 'répondent' : 'répond'} pas.`);
  return `Ventes d'hier. ${parts.join(' ')}`;
}
