/**
 * Market data.
 *
 * Live prices need a quote provider. None is configured, so every current
 * price in the portfolio is the one the user typed in — the app never invents
 * a valuation. Configure one of the providers below and the quote route can
 * fill those prices in instead.
 */

export type MarketProviderInfo = {
  id: string;
  label: string;
  envVars: string[];
  docs: string;
  note: string;
};

export const MARKET_PROVIDERS: MarketProviderInfo[] = [
  {
    id: 'twelvedata',
    label: 'Twelve Data',
    envVars: ['TWELVEDATA_API_KEY'],
    docs: 'https://twelvedata.com/docs',
    note: 'Actions, ETF et crypto, offre gratuite limitée en requêtes.',
  },
  {
    id: 'finnhub',
    label: 'Finnhub',
    envVars: ['FINNHUB_API_KEY'],
    docs: 'https://finnhub.io/docs/api',
    note: 'Actions et ETF, temps réel sur les marchés américains.',
  },
  {
    id: 'coingecko',
    label: 'CoinGecko',
    envVars: ['COINGECKO_API_KEY'],
    docs: 'https://docs.coingecko.com',
    note: 'Crypto uniquement.',
  },
];

export type MarketStatus = {
  configured: boolean;
  provider: string | null;
  providers: MarketProviderInfo[];
  missing: string[];
};
