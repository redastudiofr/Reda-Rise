import { BANK_PROVIDERS, type BankStatus } from './bank';
import { securityBlockers, storageDurable } from './bankSecurity';
import { checkKey } from './bankProviders/enableBanking';
import type { BankProviderId } from './types';

/**
 * Server-only half of the bank layer: it reads the environment to work out
 * which aggregator, if any, this deployment is configured for.
 *
 * Keeping the env lookup here means the client bundle never carries it, and
 * the UI learns the answer through `/api/bank/status` rather than guessing.
 */

function isSet(name: string): boolean {
  return (process.env[name] ?? '').trim().length > 0;
}

/** The provider whose variables are all present, if there is one. */
export function activeProvider(): BankProviderId | null {
  const ready = BANK_PROVIDERS.find((p) => p.envVars.every(isSet));
  return ready?.id ?? null;
}

/**
 * What still has to be set. When nothing is configured at all we report the
 * variables of the provider the user is closest to having filled in, so the
 * message is actionable instead of listing everything.
 */
export function missingVars(): string[] {
  if (activeProvider()) return [];

  let best = BANK_PROVIDERS[0];
  let bestScore = -1;
  for (const provider of BANK_PROVIDERS) {
    const score = provider.envVars.filter(isSet).length;
    if (score > bestScore) {
      bestScore = score;
      best = provider;
    }
  }
  return best.envVars.filter((v) => !isSet(v));
}

/** Providers this app has a working connector for. */
const IMPLEMENTED = new Set(['enablebanking']);

export function bankStatus(): BankStatus {
  const provider = activeProvider();
  const blockers = securityBlockers();
  if (provider === 'enablebanking') {
    const keyProblem = checkKey();
    if (keyProblem) blockers.push({ id: 'provider_key', message: keyProblem });
  }
  return {
    configured: provider !== null,
    provider,
    providers: BANK_PROVIDERS,
    missing: missingVars(),
    implemented: provider !== null && IMPLEMENTED.has(provider),
    blockers,
    durable: storageDurable(),
  };
}

/**
 * Gate shared by every route that talks to a bank: a provider with a real
 * connector, and every security prerequisite met. Returns the reason to
 * refuse, or null when the request may proceed.
 */
export function bankGate(): { status: number; body: Record<string, unknown> } | null {
  const s = bankStatus();
  if (!s.configured) return { status: 501, body: notConfigured() };
  if (!s.implemented) {
    return {
      status: 501,
      body: {
        error: 'bank_provider_not_implemented',
        message: `Le fournisseur « ${s.provider} » est configuré mais n’a pas de connecteur dans l’app. Utilise Enable Banking.`,
      },
    };
  }
  if (s.blockers.length > 0) {
    return {
      status: 403,
      body: { error: 'bank_security_not_ready', message: 'Connexion bancaire bloquée par sécurité.', blockers: s.blockers },
    };
  }
  return null;
}

/** Body returned by every bank route that needs a provider and has none. */
export function notConfigured() {
  const status = bankStatus();
  return {
    error: 'bank_provider_not_configured',
    message:
      'Aucun agrégateur bancaire n’est configuré sur ce déploiement. ' +
      'Renseigne les variables d’environnement d’un fournisseur puis redéploie.',
    missing: status.missing,
    providers: status.providers,
  };
}

/** Bank responses are never cached by the browser, a proxy or the service worker. */
export function bankJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private' },
  });
}
