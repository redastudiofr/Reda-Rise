// Fake Gemini / Google / Shopify / Open-Meteo for local tests. Never used in production.
// Usage: node tests/mock-server.mjs 4100
import http from 'node:http';

export const state = { calls: [], created: [], tokenMode: 'ok', geminiMode: 'ok' };

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const b64 = (s) => Buffer.from(s).toString('base64url');

const MAILS = {
  m1: { from: 'Shopify <mailer@shopify.com>', subject: 'Commande n°1042 passée par Julie', snippet: 'Nouvelle commande de 89,00 €', body: 'Julie a commandé un sweat noir taille M pour 89,00 euros.' },
  m2: { from: 'Karim Benali <karim@atelier-textile.fr>', subject: 'Devis broderie 200 pièces', snippet: 'Voici le devis demandé, livraison sous 3 semaines', body: 'Bonjour, voici le devis pour 200 pièces brodées : 1 450 euros HT, livraison sous trois semaines.\n\nLe 3 nov. 2026, vous avez écrit :\n> ancien message' },
  m3: { from: 'Newsletter Mode <news@promo.example>', subject: '-50 % ce week-end', snippet: 'Profitez-en', body: 'Promo' },
  m4: { from: 'Léa Martin <lea@gmail.com>', subject: 'Retour de ma commande', snippet: 'Le pantalon est trop grand, comment faire un échange ?', body: 'Bonjour, le pantalon est trop grand. Comment faire un échange ?' },
};

const EVENTS = (day) => [
  { id: 'e1', summary: 'Dentiste', status: 'confirmed', start: { dateTime: `${day}T19:00:00+01:00` }, end: { dateTime: `${day}T20:00:00+01:00` } },
  { id: 'e2', summary: 'Anniversaire de Sam', start: { date: day }, end: { date: day } },
  { id: 'e3', summary: 'Rappel libre', transparency: 'transparent', start: { dateTime: `${day}T21:00:00+01:00` }, end: { dateTime: `${day}T21:30:00+01:00` } },
];

function geminiReply(body) {
  const input = typeof body.input === 'string' ? [{ type: 'user_input', content: body.input }] : body.input;
  const text = JSON.stringify(input);
  // Gemini 3 rule: a function call's signed thought step must be sent back as is.
  const fr = input.findIndex((s) => s.type === 'function_result');
  if (fr >= 0 && !input.some((s) => s.type === 'thought' && s.signature === 'sig-123')) return [400, { error: { message: 'missing thought signature' } }];
  const out = (t) => [200, { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: t }] }] }];
  if (body.system_instruction?.includes('revue de presse')) return out('```json\n{"points":[{"i":0,"sentence":"Le budget 2027 est présenté."},{"i":1,"sentence":"Shopify lance un outil pour les marchands."}]}\n```');
  if (body.system_instruction?.includes('tries le courrier'))
    return out('{"items":[{"i":0,"group":"ventes","summary":"Nouvelle commande de 89 euros."},{"i":1,"group":"fournisseurs","summary":"Devis broderie à 1450 euros HT."},{"i":3,"group":"clients","summary":"Léa veut échanger un pantalon."}]}');
  const last = input.filter((s) => s.type === 'user_input').at(-1)?.content ?? '';
  if (fr >= 0) {
    const r = input[fr];
    return out(`Voici, Monsieur. ${r.name} : ${typeof r.result === 'string' ? r.result.slice(0, 300) : ''}`);
  }
  const call = (name, args) => [200, { status: 'requires_action', steps: [{ type: 'thought', signature: 'sig-123' }, { type: 'function_call', id: 'call_1', name, arguments: args }] }];
  if (/sport|compta|tâches|faire/i.test(last))
    return call('plan_day', { tasks: [{ title: 'Sport', minutes: 60 }, { title: 'Compta', minutes: 90, earliest: '18:00' }, { title: 'Appeler Karim', minutes: 15, at: '12:00' }] });
  if (/mail de/i.test(last)) return call('read_email', { sender: last.replace(/.*mail de /i, '') });
  if (/point/i.test(last)) return call('detail_news', { point: 1 });
  return out('Bien, Monsieur.');
}

export function start(port) {
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const url = new URL(req.url, `http://localhost:${port}`);
    state.calls.push(`${req.method} ${url.pathname}`);
    const p = url.pathname;

    if (p === '/__state') return json(res, 200, state);
    if (p === '/__mode') {
      Object.assign(state, Object.fromEntries(url.searchParams));
      return json(res, 200, state);
    }

    // Gemini Interactions API
    if (p === '/gemini/interactions' && req.method === 'POST') {
      if (req.headers['x-goog-api-key'] !== 'test-gemini-key') return json(res, 403, { error: { message: 'bad key' } });
      if (state.geminiMode === 'quota') return json(res, 429, { error: { message: 'RESOURCE_EXHAUSTED' } });
      const [status, out] = geminiReply(JSON.parse(body));
      return json(res, status, out);
    }

    // Google OAuth
    if (p === '/oauth/auth') {
      const back = new URL(url.searchParams.get('redirect_uri'));
      back.searchParams.set('state', url.searchParams.get('state'));
      back.searchParams.set('code', 'good-code');
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }
    if (p === '/oauth/token') {
      const f = new URLSearchParams(body);
      if (f.get('client_secret') !== 'test-secret') return json(res, 401, { error: 'invalid_client' });
      if (f.get('grant_type') === 'authorization_code')
        return f.get('code') === 'good-code'
          ? json(res, 200, { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events' })
          : json(res, 400, { error: 'invalid_grant' });
      if (state.tokenMode === 'expired') return json(res, 400, { error: 'invalid_grant' });
      return json(res, 200, { access_token: 'at-2', expires_in: 3600 });
    }

    const auth = req.headers.authorization ?? '';
    if (p.startsWith('/gmail/') || p.startsWith('/calendar/')) {
      if (!/^Bearer at-\d$/.test(auth) || state.tokenMode === 'expired') return json(res, 401, { error: { message: 'invalid token' } });
    }
    if (p === '/gmail/users/me/messages') {
      const q = url.searchParams.get('q') ?? '';
      if (/^from:\(karim/i.test(q)) return json(res, 200, { messages: [{ id: 'm2' }] });
      if (q.startsWith('from:')) return json(res, 200, {});
      if (/^léa/i.test(q)) return json(res, 200, { messages: [{ id: 'm4' }] });
      return json(res, 200, { messages: Object.keys(MAILS).map((id) => ({ id })) });
    }
    const mm = /^\/gmail\/users\/me\/messages\/(\w+)$/.exec(p);
    if (mm) {
      const m = MAILS[mm[1]];
      if (!m) return json(res, 404, {});
      const payload = { headers: [{ name: 'From', value: m.from }, { name: 'Subject', value: m.subject }], mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: b64(m.body) } }] };
      return json(res, 200, { id: mm[1], snippet: m.snippet, internalDate: String(Date.now() - 3600_000), payload });
    }
    if (p === '/calendar/calendars/primary/events' && req.method === 'GET') {
      const day = new Date(url.searchParams.get('timeMin')).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
      const timeMin = Date.parse(url.searchParams.get('timeMin'));
      const timeMax = Date.parse(url.searchParams.get('timeMax'));
      const items = [...EVENTS(day), ...state.created].filter((e) => !e.start.dateTime || (Date.parse(e.start.dateTime) < timeMax && Date.parse(e.end.dateTime) > timeMin));
      return json(res, 200, { items });
    }
    if (p === '/calendar/calendars/primary/events' && req.method === 'POST') {
      const ev = JSON.parse(body);
      const created = { id: `new${state.created.length + 1}`, ...ev, status: 'confirmed' };
      state.created.push(created);
      return json(res, 200, { id: created.id, htmlLink: 'https://calendar.google.com/x' });
    }

    // Shopify (one shop with a token, one with client credentials, one broken)
    if (p === '/admin/oauth/access_token') {
      const f = new URLSearchParams(body);
      return f.get('client_secret') === 'shop-secret' ? json(res, 200, { access_token: 'shpat_cc', expires_in: 86399, scope: 'read_orders' }) : json(res, 401, { errors: 'bad' });
    }
    if (p === '/admin/api/2026-10/graphql.json') {
      const tok = req.headers['x-shopify-access-token'];
      if (tok !== 'shpat_good' && tok !== 'shpat_cc') return json(res, 401, { errors: '[API] Invalid API key or access token' });
      const { variables } = JSON.parse(body);
      state.lastShopQuery = variables.q;
      const o = (name, amount, items, extra = {}) => ({ name, test: false, cancelledAt: null, currentTotalPriceSet: { shopMoney: { amount, currencyCode: 'EUR' } }, lineItems: { nodes: items }, ...extra });
      if (!variables.after)
        return json(res, 200, { data: { orders: { pageInfo: { hasNextPage: true, endCursor: 'c1' }, nodes: [o('#1', '89.00', [{ title: 'Sweat noir', quantity: 1 }]), o('#2', '120.50', [{ title: 'Pantalon cargo', quantity: 2 }]), o('#3', '999.00', [{ title: 'Test', quantity: 9 }], { test: true })] } } });
      return json(res, 200, { data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [o('#4', '45.00', [{ title: 'Sweat noir', quantity: 2 }]), o('#5', '60.00', [{ title: 'Casquette', quantity: 1 }], { cancelledAt: '2026-11-04T10:00:00Z' })] } } });
    }

    // Open-Meteo
    if (p === '/meteo/forecast')
      return json(res, 200, { current: { temperature_2m: 9.4, weather_code: 3 }, daily: { temperature_2m_min: [5.2], temperature_2m_max: [12.6], precipitation_probability_max: [70], weather_code: [61], wind_speed_10m_max: [22] } });
    if (p === '/geo/search') return json(res, 200, { results: [{ name: 'Lyon', latitude: 45.75, longitude: 4.85, admin1: 'Auvergne-Rhône-Alpes', country: 'France' }] });

    // A feed and an article page
    if (p === '/feed.xml') {
      res.writeHead(200, { 'content-type': 'application/rss+xml' });
      const y = new Date(Date.now() - 86400_000).toUTCString();
      return res.end(`<rss><channel><item><title>Le gouvernement présente le budget 2027</title><link>http://localhost:${port}/article</link><description>Budget</description><pubDate>${y}</pubDate></item><item><title>Shopify lance un outil pour les marchands</title><link>http://localhost:${port}/a2</link><pubDate>${y}</pubDate></item></channel></rss>`);
    }
    json(res, 404, { error: 'not found', path: p });
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}

if (process.argv[2]) {
  await start(Number(process.argv[2]));
  console.log('mock on', process.argv[2]);
}
