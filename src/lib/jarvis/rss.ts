import { XMLParser } from 'fast-xml-parser';
import { ServiceError, fetchWithTimeout } from './http';
import type { Feed } from './settings';
import { addDays, parisDay, type DayKey } from './time';

export type Article = { title: string; link: string; summary: string; source: string; published: string };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', trimValues: true });

const text = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as object)) return String((v as { '#text': unknown })['#text']);
  return '';
};

const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function cleanText(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** RSS 2.0 and Atom. */
export function parseFeed(xml: string, source: string): Article[] {
  const doc = parser.parse(xml) as Record<string, any>;
  const rssItems = arr(doc?.rss?.channel?.item);
  const atomItems = arr(doc?.feed?.entry);
  const out: Article[] = [];
  for (const it of rssItems) {
    out.push({
      title: cleanText(text(it.title)),
      link: text(it.link) || text(it.guid),
      summary: cleanText(text(it.description)).slice(0, 600),
      source,
      published: text(it.pubDate) || text(it['dc:date']),
    });
  }
  for (const it of atomItems) {
    const links = arr(it.link) as any[];
    const link = links.find((l) => !l['@rel'] || l['@rel'] === 'alternate')?.['@href'] ?? '';
    out.push({
      title: cleanText(text(it.title)),
      link,
      summary: cleanText(text(it.summary) || text(it.content)).slice(0, 600),
      source,
      published: text(it.published) || text(it.updated),
    });
  }
  return out.filter((a) => a.title);
}

/** Feeds are fetched by the server: never towards the server's own network. */
export function publicUrl(u: string): boolean {
  try {
    const { protocol, hostname } = new URL(u);
    if (!/^https?:$/.test(protocol)) return false;
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    if (h.includes(':')) return false; // IPv6 literal: no public feed needs one
    return true;
  } catch {
    return false;
  }
}

export async function fetchFeed(feed: Feed, allowPrivate = false): Promise<Article[]> {
  if (!allowPrivate && !publicUrl(feed.url)) throw new ServiceError('bad_response', 'Adresse de flux refusée.');
  const res = await fetchWithTimeout(feed.url, { headers: { 'User-Agent': 'Jarvis-RSS/1.0 (lecteur personnel)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' } }, 8000);
  if (!res.ok) throw new ServiceError(res.status === 403 ? 'auth' : 'bad_response', `HTTP ${res.status}`, res.status);
  return parseFeed(await res.text(), feed.name);
}

const STOP = new Set('le la les un une des du de d l à au aux et ou en sur pour par avec dans est sont a ce cette ces qui que quoi ne pas plus après selon face'.split(' '));

export function words(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function similar(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common / Math.min(a.size, b.size) >= 0.6 || common / (a.size + b.size - common) >= 0.45;
}

/** Articles published on `day` (Paris), the same story kept once. */
export function yesterdaysNews(articles: Article[], day: DayKey): Article[] {
  const kept: { a: Article; w: Set<string> }[] = [];
  const seenLinks = new Set<string>();
  for (const a of articles) {
    const t = Date.parse(a.published);
    if (!Number.isFinite(t) || parisDay(new Date(t)) !== day) continue;
    const link = a.link.split('?')[0];
    if (seenLinks.has(link)) continue;
    const w = words(a.title);
    if (kept.some((k) => similar(k.w, w))) continue;
    seenLinks.add(link);
    kept.push({ a, w });
  }
  return kept.map((k) => k.a);
}

export const yesterday = (now = new Date()) => addDays(parisDay(now), -1);
