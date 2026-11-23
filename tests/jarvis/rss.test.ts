import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, publicUrl, yesterdaysNews } from '../../src/lib/jarvis/rss';

const rss = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title><![CDATA[Le gouvernement présente son budget 2027]]></title><link>https://a.fr/1</link><description>&lt;p&gt;Texte &amp; détails&lt;/p&gt;</description><pubDate>Wed, 04 Nov 2026 10:00:00 +0100</pubDate></item>
<item><title>Budget 2027 : le gouvernement présente son projet</title><link>https://b.fr/2</link><pubDate>Wed, 04 Nov 2026 11:00:00 +0100</pubDate></item>
<item><title>Tard le soir</title><link>https://a.fr/3</link><pubDate>Wed, 04 Nov 2026 23:30:00 +0000</pubDate></item>
<item><title>La Bourse de Paris recule</title><link>https://a.fr/4?utm=x</link><pubDate>Wed, 04 Nov 2026 22:59:00 +0000</pubDate></item>
<item><title>La Bourse de Paris recule</title><link>https://a.fr/4</link><pubDate>Wed, 04 Nov 2026 20:00:00 +0000</pubDate></item>
</channel></rss>`;
const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Shopify lance un outil</title><link rel="alternate" href="https://c.fr/x"/><summary>Résumé</summary><published>2026-11-04T09:00:00Z</published></entry></feed>`;

test('lecture RSS et Atom', () => {
  const a = parseFeed(rss, 'A');
  assert.equal(a.length, 5);
  assert.equal(a[0].title, 'Le gouvernement présente son budget 2027');
  assert.equal(a[0].summary, 'Texte & détails');
  const b = parseFeed(atom, 'C');
  assert.deepEqual([b[0].title, b[0].link, b[0].summary], ['Shopify lance un outil', 'https://c.fr/x', 'Résumé']);
});

test('articles d’hier seulement, dédoublonnés', () => {
  const news = yesterdaysNews([...parseFeed(rss, 'A'), ...parseFeed(atom, 'C')], '2026-11-04');
  assert.deepEqual(news.map((n) => n.title), ['Le gouvernement présente son budget 2027', 'La Bourse de Paris recule', 'Shopify lance un outil']);
});

test('adresses de flux refusées', () => {
  for (const u of ['http://localhost:3000/x', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://192.168.0.1/', 'http://[::1]/', 'file:///etc/passwd', 'http://169.254.169.254/'])
    assert.equal(publicUrl(u), false, u);
  assert.equal(publicUrl('https://www.lemonde.fr/rss/une.xml'), true);
});
