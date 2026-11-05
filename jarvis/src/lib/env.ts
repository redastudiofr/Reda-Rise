/**
 * Every secret is read here, on the server only. Nothing in this file may be
 * imported from a client component.
 */

const read = (name: string) => (process.env[name] ?? '').trim();

export const env = {
  password: () => read('JARVIS_PASSWORD'),
  sessionSecret: () => read('SESSION_SECRET'),

  geminiKey: () => read('GEMINI_API_KEY'),
  geminiModel: () => read('GEMINI_MODEL') || 'gemini-3.8-flash',
  geminiUrl: () => read('GEMINI_API_URL') || 'https://generativelanguage.googleapis.com/v1beta',

  googleClientId: () => read('GOOGLE_CLIENT_ID'),
  googleClientSecret: () => read('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: () => read('GOOGLE_REDIRECT_URI'),
  // Overridable for local tests against a mock only.
  googleAuthUrl: () => read('GOOGLE_AUTH_URL') || 'https://accounts.google.com/o/oauth2/v2/auth',
  googleTokenUrl: () => read('GOOGLE_TOKEN_URL') || 'https://oauth2.googleapis.com/token',
  gmailUrl: () => read('GMAIL_API_URL') || 'https://gmail.googleapis.com/gmail/v1',
  calendarUrl: () => read('CALENDAR_API_URL') || 'https://www.googleapis.com/calendar/v3',

  meteoUrl: () => read('OPEN_METEO_URL') || 'https://api.open-meteo.com/v1',
  geocodingUrl: () => read('GEOCODING_URL') || 'https://geocoding-api.open-meteo.com/v1',
  shopifyBase: () => read('SHOPIFY_BASE_URL'), // tests only; normally https://<domaine>
  shopifyApiVersion: () => read('SHOPIFY_API_VERSION') || '2026-10',

  databaseUrl: () => read('DATABASE_URL') || read('POSTGRES_URL'),
};

/** A secret too short to resist guessing is treated as missing. */
export function securityProblems(): string[] {
  const out: string[] = [];
  if (!env.password()) out.push('JARVIS_PASSWORD est absent.');
  if (env.sessionSecret().length < 32) out.push('SESSION_SECRET doit faire au moins 32 caractères.');
  return out;
}

export type ShopConfig = { id: string; name: string; domain: string; token?: string; clientId?: string; clientSecret?: string };

/**
 * Shops come from numbered variables: SHOPIFY_SHOP_1_DOMAIN, _NAME, and
 * either _TOKEN (an Admin API access token) or _CLIENT_ID + _CLIENT_SECRET
 * (an app from the Shopify Dev Dashboard, client credentials grant).
 */
export function shops(): ShopConfig[] {
  const out: ShopConfig[] = [];
  for (let i = 1; i <= 10; i++) {
    const domain = read(`SHOPIFY_SHOP_${i}_DOMAIN`).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) continue;
    out.push({
      id: `shop${i}`,
      name: read(`SHOPIFY_SHOP_${i}_NAME`) || domain.replace('.myshopify.com', ''),
      domain,
      token: read(`SHOPIFY_SHOP_${i}_TOKEN`) || undefined,
      clientId: read(`SHOPIFY_SHOP_${i}_CLIENT_ID`) || undefined,
      clientSecret: read(`SHOPIFY_SHOP_${i}_CLIENT_SECRET`) || undefined,
    });
  }
  return out;
}
