import { bankGate, bankJson } from '@/lib/bankServer';
import { ProviderError, listInstitutions } from '@/lib/bankProviders/enableBanking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COUNTRIES = new Set(['FR', 'BE', 'DE', 'ES', 'IT', 'NL', 'PT', 'LU', 'AT', 'IE', 'FI']);

/** Banks the user can pick from, for one country. */
export async function GET(req: Request) {
  const gate = bankGate();
  if (gate) return bankJson(gate.body, gate.status);
  const country = (new URL(req.url).searchParams.get('country') ?? 'FR').toUpperCase();
  if (!COUNTRIES.has(country)) return bankJson({ error: 'bad_country', message: 'Pays non pris en charge.' }, 400);
  try {
    return bankJson({ institutions: await listInstitutions(country) });
  } catch (err) {
    const e = err instanceof ProviderError ? err : new ProviderError(0, 'network', 'Erreur inattendue.');
    return bankJson({ error: e.code, message: e.message }, 502);
  }
}
