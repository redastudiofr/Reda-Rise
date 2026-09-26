import { BANK_PROVIDERS, type BankStatus } from './bank';
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

export function bankStatus(): BankStatus {
  const provider = activeProvider();
  return {
    configured: provider !== null,
    provider,
    providers: BANK_PROVIDERS,
    missing: missingVars(),
  };
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
