import { NextResponse } from 'next/server';
import { activeProvider, notConfigured } from '@/lib/bankServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pulls fresh balances and transactions for the stored connections.
 *
 * Returns 501 until an aggregator is configured and its connector written —
 * the client keeps whatever it already has rather than being handed made-up
 * rows.
 */
export async function POST() {
  const provider = activeProvider();
  if (!provider) {
    return NextResponse.json(notConfigured(), { status: 501 });
  }

  return NextResponse.json(
    {
      error: 'bank_provider_not_implemented',
      message: `Le fournisseur « ${provider} » est configuré mais la synchronisation n’est pas encore implémentée.`,
      provider,
    },
    { status: 501 },
  );
}
