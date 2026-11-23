import { NextResponse } from 'next/server';
import { MARKET_PROVIDERS, type MarketStatus } from '@/lib/market';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isSet(name: string): boolean {
  return (process.env[name] ?? '').trim().length > 0;
}

function status(): MarketStatus {
  const ready = MARKET_PROVIDERS.find((p) => p.envVars.every(isSet));
  return {
    configured: Boolean(ready),
    provider: ready?.id ?? null,
    providers: MARKET_PROVIDERS,
    missing: ready ? [] : MARKET_PROVIDERS[0].envVars.filter((v) => !isSet(v)),
  };
}

/** Whether live quotes are available on this deployment. */
export async function GET() {
  return NextResponse.json(status());
}

/**
 * Would return the latest price for the requested symbols. Answers 501 while
 * no provider is configured, so the portfolio keeps using the prices the user
 * entered rather than being handed invented ones.
 */
export async function POST() {
  const current = status();
  if (!current.configured) {
    return NextResponse.json(
      {
        error: 'market_provider_not_configured',
        message:
          'Aucun fournisseur de cotations n’est configuré. Les prix actuels restent ceux que tu saisis à la main.',
        ...current,
      },
      { status: 501 },
    );
  }

  return NextResponse.json(
    {
      error: 'market_provider_not_implemented',
      message: `Le fournisseur « ${current.provider} » est configuré mais le connecteur n’est pas encore implémenté.`,
      provider: current.provider,
    },
    { status: 501 },
  );
}
