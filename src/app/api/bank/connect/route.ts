import { bankGate, bankJson } from '@/lib/bankServer';
import { ProviderError, startAuthorization } from '@/lib/bankProviders/enableBanking';
import { STATE_COOKIE, STATE_TTL_SECONDS, newPendingAuth } from '@/lib/bankSecurity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** How long the bank consent is asked for. PSD2 caps it at 180 days. */
const CONSENT_DAYS = 90;

function redirectUrl(req: Request): string {
  const configured = (process.env.ENABLEBANKING_REDIRECT_URL ?? '').trim();
  if (configured) return configured;
  return `${new URL(req.url).origin}/api/bank/callback`;
}

/**
 * Starts a bank connection: asks the provider for the bank's own login page
 * and returns its URL. The user types their bank credentials there, never in
 * this app. A random `state` goes both to the provider and into a sealed,
 * httpOnly cookie, so only this browser can complete the connection.
 */
export async function POST(req: Request) {
  const gate = bankGate();
  if (gate) return bankJson(gate.body, gate.status);

  let body: { institution?: unknown; country?: unknown };
  try {
    body = await req.json();
  } catch {
    return bankJson({ error: 'bad_request', message: 'Requête invalide.' }, 400);
  }
  const institution = typeof body.institution === 'string' ? body.institution.trim().slice(0, 120) : '';
  const country = typeof body.country === 'string' ? body.country.trim().toUpperCase() : '';
  if (!institution || !/^[A-Z]{2}$/.test(country)) {
    return bankJson({ error: 'bad_request', message: 'Choisis une banque.' }, 400);
  }

  const { pending, cookie } = newPendingAuth(institution, country);
  try {
    const validUntil = new Date(Date.now() + CONSENT_DAYS * 86_400_000).toISOString();
    const { url } = await startAuthorization({
      institution,
      country,
      redirectUrl: redirectUrl(req),
      state: pending.state,
      validUntil,
    });
    const res = bankJson({ url });
    const secure = new URL(req.url).protocol === 'https:';
    res.headers.append(
      'Set-Cookie',
      `${STATE_COOKIE}=${cookie}; Path=/api/bank/callback; Max-Age=${STATE_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
    );
    return res;
  } catch (err) {
    const e = err instanceof ProviderError ? err : new ProviderError(0, 'network', 'Erreur inattendue.');
    return bankJson({ error: e.code, message: e.message }, e.code === 'rate_limited' ? 429 : 502);
  }
}
