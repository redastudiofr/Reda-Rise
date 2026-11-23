// Every integration against the local mock (tests/mock-server.mjs): no real key needed.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 4199;
const M = `http://localhost:${PORT}`;
Object.assign(process.env, {
  AUTH_SECRET: 'x'.repeat(40),
  APP_PASSWORD: 'pw',
  GEMINI_API_KEY: 'test-gemini-key',
  GEMINI_API_URL: `${M}/gemini`,
  GOOGLE_CLIENT_ID: 'cid',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  GOOGLE_AUTH_URL: `${M}/oauth/auth`,
  GOOGLE_TOKEN_URL: `${M}/oauth/token`,
  GMAIL_API_URL: `${M}/gmail`,
  CALENDAR_API_URL: `${M}/calendar`,
  OPEN_METEO_URL: `${M}/meteo`,
  GEOCODING_URL: `${M}/geo`,
  SHOPIFY_BASE_URL: M,
  SHOPIFY_SHOP_1_NAME: 'Reda Studio',
  SHOPIFY_SHOP_1_DOMAIN: 'reda-studio.myshopify.com',
  SHOPIFY_SHOP_1_TOKEN: 'shpat_good',
  SHOPIFY_SHOP_2_NAME: 'Second shop',
  SHOPIFY_SHOP_2_DOMAIN: 'second.myshopify.com',
  SHOPIFY_SHOP_2_CLIENT_ID: 'id',
  SHOPIFY_SHOP_2_CLIENT_SECRET: 'shop-secret',
});
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
process.chdir(mkdtempSync(path.join(tmpdir(), 'jarvis-')));

let server: { close(): void };
const mode = (q: string) => fetch(`${M}/__mode?${q}`);
const fakeReq = new Request('http://localhost:3000/api/jarvis/google/callback', { headers: { host: 'localhost:3000' } });

before(async () => {
  const mock = await import('./mock-server.mjs');
  server = await mock.start(PORT);
});
after(() => server.close());

test('météo : prévision et phrase', async () => {
  const { todayWeather, speakWeather, searchCity } = await import('../../src/lib/jarvis/weather');
  const w = await todayWeather({ name: 'Paris', lat: 48.85, lon: 2.35 });
  assert.deepEqual([w.now, w.min, w.max, w.rainChance, w.label], [9, 5, 13, 70, 'pluie']);
  assert.match(speakWeather(w), /À Paris, pluie, 9 degrés actuellement\. Entre 5 et 13 aujourd'hui\. Risque de pluie à 70 %\. Le parapluie serait avisé, Monsieur\./);
  assert.equal((await searchCity('Lyon'))[0].detail, 'Auvergne-Rhône-Alpes, France');
});

test('Gemini : outils, signature de pensée renvoyée, quota', async () => {
  const { runWithTools } = await import('../../src/lib/jarvis/gemini');
  const r = await runWithTools({
    system: 's',
    input: [{ type: 'user_input', content: 'Lis-moi le mail de Karim' }],
    tools: [],
    handlers: { read_email: async (a) => ({ ok: a.sender }) },
  });
  assert.deepEqual(r.results, [{ name: 'read_email', args: { sender: 'Karim' }, result: { ok: 'Karim' } }]);
  assert.match(r.text, /^Voici, Monsieur\. read_email/);
  await mode('geminiMode=quota');
  await assert.rejects(runWithTools({ system: 's', input: [{ type: 'user_input', content: 'x' }], tools: [], handlers: {} }), (e: any) => e.code === 'quota');
  await mode('geminiMode=ok');
});

test('actualité : flux, sélection par le modèle, phrases', async () => {
  const { yesterdayNews, speakNews } = await import('../../src/lib/jarvis/news');
  // The mock feed is on localhost: allowed here only through a private test hook.
  const rss = await import('../../src/lib/jarvis/rss');
  const arts = await rss.fetchFeed({ id: 'm', name: 'Mock', url: `${M}/feed.xml`, enabled: true }, true);
  assert.equal(arts.length, 2);
  await assert.rejects(rss.fetchFeed({ id: 'm', name: 'Mock', url: `${M}/feed.xml`, enabled: true }), /refusée/);
  const r = await yesterdayNews([{ id: 'x', name: 'Down', url: 'http://localhost:1/x', enabled: true }, { id: 'y', name: 'Off', url: 'https://example.com', enabled: false }]).catch((e) => e);
  assert.match(String(r), /Aucun flux/);
  assert.match(speakNews({ day: '2026-11-04', failedFeeds: ['Les Echos'], candidates: 2, points: [{ n: 1, title: 't', sentence: 'Le budget est présenté', link: '', source: 's', summary: '' }] }), /^L'actualité d'hier, en 1 points?\. Premier point : Le budget est présenté\. Les Echos ne répond pas ce matin\.$/);
});

test('Google : connexion, mails triés, lecture, agenda, expiration', async () => {
  const g = await import('../../src/lib/jarvis/google');
  const { digestMail, speakMail } = await import('../../src/lib/jarvis/mail');
  assert.equal((await g.googleStatus()).connected, false);
  const url = new URL(g.authUrl(fakeReq, 'st'));
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/api/jarvis/google/callback');
  await g.exchangeCode(fakeReq, 'good-code');
  const st = await g.googleStatus();
  assert.equal(st.connected, true);

  const mails = await g.recentMail();
  assert.equal(mails.length, 4);
  assert.deepEqual([mails[1].from, mails[1].fromEmail], ['Karim Benali', 'karim@atelier-textile.fr']);
  const d = await digestMail(mails);
  assert.deepEqual(d.important.map((m) => m.group), ['ventes', 'fournisseurs', 'clients']);
  assert.match(speakMail(d), /^4 mails en vingt-quatre heures, dont 3 qui méritent votre attention\. Ventes : Shopify, Nouvelle commande de 89 euros\. Clients : Léa Martin, Léa veut échanger un pantalon\. Fournisseurs : Karim Benali, Devis broderie à 1450 euros HT\.$/);

  const k = await g.latestMailFrom('Karim');
  assert.equal(k?.subject, 'Devis broderie 200 pièces');
  assert.ok(!k!.body.includes('ancien message'), 'citation retirée');
  assert.equal((await g.latestMailFrom('Léa'))?.from, 'Léa Martin', 'recherche large en second essai');

  const { start, end } = (await import('../../src/lib/jarvis/time')).dayRange('2026-11-05');
  const ev = await g.eventsBetween(start, end);
  assert.deepEqual(ev.map((e) => [e.title, e.allDay, e.busy]), [['Dentiste', false, true], ['Anniversaire de Sam', true, false], ['Rappel libre', false, false]]);

  // Le jeton de 7 jours expire : statut "à reconnecter", rien ne plante
  await mode('tokenMode=expired');
  const { runSection } = await import('../../src/lib/jarvis/briefing');
  const b = await runSection('mail');
  assert.equal(b.ok, false);
  assert.equal(b.needsGoogle, true);
  assert.equal(b.spoken, 'La messagerie demande une reconnexion à Google, Monsieur. Je poursuis.');
  assert.equal((await g.googleStatus()).connected, false);
  await mode('tokenMode=ok');
  await g.exchangeCode(fakeReq, 'good-code');
});

test('Shopify : CA d’hier par shop, top produits, jeton client, boutique en panne', async () => {
  const { salesOfDay, speakShops } = await import('../../src/lib/jarvis/shopify');
  const { shops } = await import('../../src/lib/jarvis/env');
  const [a, b] = shops();
  const da = await salesOfDay(a, '2026-11-04');
  assert.deepEqual([da.orders, da.revenue, da.top], [3, 254.5, [{ title: 'Sweat noir', quantity: 3 }, { title: 'Pantalon cargo', quantity: 2 }]]);
  const st = await (await fetch(`${M}/__state`)).json();
  assert.equal(st.lastShopQuery, "created_at:>='2026-11-04T00:00:00+01:00' AND created_at:<'2026-11-05T00:00:00+01:00'");
  const db = await salesOfDay(b, '2026-11-04');
  assert.equal(db.orders, 3, 'jeton obtenu par client credentials');
  await assert.rejects(salesOfDay({ ...a, token: 'shpat_bad' }, '2026-11-04'));
  assert.match(speakShops([da], ['Second shop']).replace(/[\u202f\u00a0]/g, ' '), /^Ventes d'hier\. Reda Studio : 254,50 € de chiffre d'affaires, 3 commandes\. En tête : Sweat noir, 3 vendus ; Pantalon cargo, 2 vendus\. Second shop ne répond pas\.$/);
});

test('planning par la voix puis création dans l’agenda, sans chevauchement', async () => {
  const { chat } = await import('../../src/lib/jarvis/assistant');
  const r = await chat('Aujourd’hui je dois faire du sport, la compta et appeler Karim', [], {});
  assert.ok(r.plan);
  const { hhmm } = await import('../../src/lib/jarvis/time');
  const plan = r.plan!;
  const busy = [
    ['19:00', '20:00'],
  ];
  for (const it of plan.items) {
    const s = hhmm(new Date(it.start));
    const e = hhmm(new Date(it.end));
    for (const [bs, be] of busy) assert.ok(e <= bs || s >= be, `${it.title} ${s}-${e} chevauche le dentiste`);
  }
  assert.match(r.reply, /^Voici, Monsieur\. plan_day/);

  // Confirmation : création réelle, un créneau devenu pris est sauté
  const { POST } = await import('../../src/app/api/jarvis/plan/confirm/route');
  const day = plan.day;
  const free = { title: 'Lecture', start: `${day}T22:00:00.000Z`, end: `${day}T22:30:00.000Z` }; // 23h-23h30 Paris en hiver
  const clash = { title: 'Conflit', start: `${day}T18:15:00.000Z`, end: `${day}T18:45:00.000Z` }; // 19h15 : dentiste
  const res = await POST(
    new Request('http://localhost:3000/api/plan/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', host: 'localhost:3000' },
      body: JSON.stringify({ day, items: [free, clash] }),
    }),
  );
  const out = await res.json();
  assert.deepEqual(out.created.map((c: any) => c.title), ['Lecture']);
  assert.deepEqual(out.skipped, [{ title: 'Conflit', reason: 'créneau plus libre' }]);
  const st = await (await fetch(`${M}/__state`)).json();
  assert.equal(st.created.at(-1).start.timeZone, 'Europe/Paris');
});
