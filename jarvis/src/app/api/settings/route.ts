import { bad, failed, jsonBody, noStore } from '@/lib/api';
import { shops } from '@/lib/env';
import { loadSettings, saveSettings } from '@/lib/serverSettings';
import { durable } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Shops are listed by name only: their tokens never leave the server. */
const shopList = () => shops().map((s) => ({ id: s.id, name: s.name, domain: s.domain, auth: s.token ? 'token' : s.clientId ? 'client' : 'missing' }));

export async function GET() {
  try {
    return Response.json({ settings: await loadSettings(), shops: shopList(), durable: durable() }, { headers: noStore });
  } catch (e) {
    return failed(e, 'Le stockage');
  }
}

export async function PUT(req: Request) {
  const body = await jsonBody<{ settings?: unknown }>(req);
  if (!body?.settings) return bad('Réglages invalides.');
  try {
    return Response.json({ settings: await saveSettings(body.settings), shops: shopList(), durable: durable() }, { headers: noStore });
  } catch (e) {
    return failed(e, 'Le stockage');
  }
}
