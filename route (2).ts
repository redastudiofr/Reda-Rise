import { NextResponse } from 'next/server';
import { activeProvider, notConfigured } from '@/lib/bankServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Starts a bank connection.
 *
 * The flow is always the same whatever the aggregator: the server asks the
 * provider for a short-lived link, the user authenticates on their own bank's
 * page, and the provider calls back. The app never handles the credentials.
 *
 * Nothing is wired to a provider yet, so this answers 501 with what is missing
 * rather than pretending a connection was opened.
 */
export async function POST() {
  const provider = activeProvider();
  if (!provider) {
    return NextResponse.json(notConfigured(), { status: 501 });
  }

  // Once a provider is chosen, its SDK call goes here and returns the URL the
  // user is sent to. Deliberately left unimplemented rather than stubbed.
  return NextResponse.json(
    {
      error: 'bank_provider_not_implemented',
      message: `Le fournisseur « ${provider} » est configuré mais son connecteur n’est pas encore implémenté.`,
      provider,
    },
    { status: 501 },
  );
}
