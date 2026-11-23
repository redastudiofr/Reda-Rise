import { askJson, geminiReady, interact, outputText } from './gemini';
import { fetchWithTimeout } from './http';
import { PERSONA } from './persona';
import { cleanText, fetchFeed, publicUrl, yesterday, yesterdaysNews, type Article } from './rss';
import type { Feed } from './settings';
import { longDay } from './time';

export type NewsPoint = { n: number; title: string; sentence: string; link: string; source: string; summary: string };

export type NewsResult = { day: string; points: NewsPoint[]; failedFeeds: string[]; candidates: number };

/** Round-robin across sources, so one prolific feed does not fill the briefing. */
function spread(articles: Article[], max: number): Article[] {
  const bySource = new Map<string, Article[]>();
  for (const a of articles) bySource.set(a.source, [...(bySource.get(a.source) ?? []), a]);
  const out: Article[] = [];
  for (let i = 0; out.length < max && [...bySource.values()].some((l) => l.length > i); i++) {
    for (const l of bySource.values()) if (l[i] && out.length < max) out.push(l[i]);
  }
  return out;
}

export async function yesterdayNews(feeds: Feed[], now = new Date()): Promise<NewsResult> {
  const day = yesterday(now);
  const enabled = feeds.filter((f) => f.enabled);
  const settled = await Promise.allSettled(enabled.map((f) => fetchFeed(f)));
  const failedFeeds = enabled.filter((_, i) => settled[i].status === 'rejected').map((f) => f.name);
  if (enabled.length > 0 && failedFeeds.length === enabled.length) throw new Error('Aucun flux ne répond.');
  const articles = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  const candidates = spread(yesterdaysNews(articles, day), 40);
  if (candidates.length === 0) return { day, points: [], failedFeeds, candidates: 0 };

  let picks: { i: number; sentence: string }[] = [];
  if (geminiReady()) {
    try {
      const list = candidates.map((a, i) => `${i}. [${a.source}] ${a.title} — ${a.summary.slice(0, 220)}`).join('\n');
      const r = await askJson<{ points: { i: number; sentence: string }[] }>(
        `${PERSONA}\nTu prépares la revue de presse du matin.`,
        `Articles publiés le ${longDay(day)} :\n${list}\n\nChoisis les 3 à 5 informations les plus importantes pour un entrepreneur français (politique, économie, international, e-commerce et tech), sans doublon de sujet. Pour chacune, écris UNE phrase factuelle de 25 mots maximum, fidèle à l'article, sans « Monsieur ». Le total doit se lire en moins d'une minute.\nRéponds uniquement en JSON : {"points":[{"i":<numéro>,"sentence":"..."}]}`,
      );
      picks = (r.points ?? []).filter((p) => Number.isInteger(p.i) && candidates[p.i] && typeof p.sentence === 'string').slice(0, 5);
    } catch {
      picks = [];
    }
  }
  if (picks.length === 0) picks = spread(candidates, 4).map((a) => ({ i: candidates.indexOf(a), sentence: a.title }));

  const seen = new Set<number>();
  const points = picks
    .filter((p) => !seen.has(p.i) && seen.add(p.i))
    .map((p, k) => {
      const a = candidates[p.i];
      return { n: k + 1, title: a.title, sentence: p.sentence.trim(), link: a.link, source: a.source, summary: a.summary };
    });
  return { day, points, failedFeeds, candidates: candidates.length };
}

export function speakNews(r: NewsResult): string {
  if (r.points.length === 0) return "L'actualité d'hier est restée introuvable dans vos flux. Un jour calme, ou des journalistes en grève.";
  const ordinals = ['Premier point', 'Deuxième point', 'Troisième point', 'Quatrième point', 'Cinquième point'];
  const lines = r.points.map((p, i) => `${ordinals[i]} : ${p.sentence.replace(/\.?$/, '.')}`);
  const tail = r.failedFeeds.length ? ` ${r.failedFeeds.join(' et ')} ne ${r.failedFeeds.length > 1 ? 'répondent' : 'répond'} pas ce matin.` : '';
  return `L'actualité d'hier, en ${r.points.length} points. ${lines.join(' ')}${tail}`;
}

/** Plain text of an article page, best effort (paragraphs only). */
async function articleText(link: string): Promise<string> {
  if (!publicUrl(link)) return '';
  try {
    const res = await fetchWithTimeout(link, { headers: { 'User-Agent': 'Jarvis-RSS/1.0 (lecteur personnel)' } }, 8000);
    if (!res.ok) return '';
    const html = (await res.text()).slice(0, 600_000);
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => cleanText(m[1])).filter((t) => t.length > 60);
    return paras.join('\n').slice(0, 5000);
  } catch {
    return '';
  }
}

export async function detailPoint(p: { title: string; link: string; summary: string; source: string }): Promise<string> {
  const body = await articleText(p.link);
  if (!geminiReady()) return `${p.title}. ${p.summary || 'Je n’ai pas davantage de détails, Monsieur.'}`;
  const steps = await interact({
    system: PERSONA,
    input: `Développe ce sujet d'actualité en 4 à 6 phrases courtes, pour l'oral, uniquement à partir des éléments ci-dessous. Commence directement par les faits.\nSource : ${p.source}\nTitre : ${p.title}\nRésumé : ${p.summary}\nTexte de l'article (peut être partiel ou vide) :\n${body || '(indisponible)'}`,
  });
  return outputText(steps) || p.summary || p.title;
}
