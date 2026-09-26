import { bankGate } from '@/lib/bankServer';
import { ProviderError, accountKind, createSession } from '@/lib/bankProviders/enableBanking';
import { STATE_COOKIE, checkPendingAuth, randomId } from '@/lib/bankSecurity';
import { saveLink } from '@/lib/bankVault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function back(req: Request, params: Record<string, string>): Response {
  const url = new URL('/finances/banque', new URL(req.url).origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, {
    status: 303,
    headers: {
      Location: url.toString(),
      'Cache-Control': 'no-store',
      // The state cookie is single-use.
      'Set-Cookie': `${STATE_COOKIE}=; Path=/api/bank/callback; Max-Age=0; HttpOnly; SameSite=Lax`,
    },
  });
}

function cookieValue(req: Request, name: string): string | undefined {
  const raw = req.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

/**
 * The bank sends the user back here. The code is only exchanged when the
 * `state` matches this browser's sealed cookie; the resulting session is
 * sealed and kept on the server. Every outcome returns to the bank page with
 * a short status, never with a secret in the URL.
 */
export async function GET(req: Request) {
  const gate = bankGate();
  if (gate) return back(req, { bank: 'error', reason: 'not_ready' });

  const q = new URL(req.url).searchParams;
  const pending = checkPendingAuth(cookieValue(req, STATE_COOKIE), q.get('state'));
  if (!pending) return back(req, { bank: 'error', reason: 'state' });
  if (q.get('error')) return back(req, { bank: 'error', reason: 'refused' });
  const code = q.get('code');
  if (!code) return back(req, { bank: 'error', reason: 'refused' });

  try {
    const session = await createSession(code);
    const linkId = randomId('bl');
    await saveLink({
      id: linkId,
      provider: 'enablebanking',
      sessionId: session.sessionId,
      institution: pending.institution,
      country: pending.country,
      validUntil: session.validUntil?.slice(0, 10),
      createdAt: new Date().toISOString(),
      accounts: session.accounts.map((a) => ({
        id: randomId('ba'),
        uid: a.uid,
        name: a.name || a.product || 'Compte',
        kind: accountKind(a),
        iban4: (a.account_id?.iban ?? a.account_id?.other?.identification)?.replace(/\s/g, '').slice(-4),
        currency: a.currency || 'EUR',
      })),
    });
    return back(req, { bank: 'connected' });
  } catch (err) {
    const reason = err instanceof ProviderError ? err.code : 'provider';
    return back(req, { bank: 'error', reason });
  }
}
