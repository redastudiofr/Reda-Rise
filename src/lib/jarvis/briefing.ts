import { shops } from './env';
import { eventsBetween, googleConfigured, recentMail } from './google';
import { ServiceError } from './http';
import { digestMail, speakMail } from './mail';
import { speakNews, yesterdayNews } from './news';
import { loadSettings } from './serverSettings';
import { salesOfDay, speakShops } from './shopify';
import { addDays, dayRange, parisDay, spokenTime } from './time';
import { speakWeather, todayWeather } from './weather';

export const SECTIONS = ['mail', 'shopify', 'weather', 'news', 'calendar'] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_TITLE: Record<Section, string> = {
  mail: 'Courrier',
  shopify: 'Ventes Shopify',
  weather: 'Météo',
  news: 'Actualité',
  calendar: 'Agenda',
};

export type BlockResult = { section: Section; ok: boolean; spoken: string; data?: unknown; error?: string; needsGoogle?: boolean };

/** What the person hears when a service is down; the briefing goes on. */
function failure(section: Section, e: unknown): BlockResult {
  const code = e instanceof ServiceError ? e.code : 'network';
  const what = {
    mail: 'La messagerie',
    shopify: 'Shopify',
    weather: 'Le service météo',
    news: 'Les flux d’actualité',
    calendar: 'L’agenda',
  }[section];
  const needsGoogle = (section === 'mail' || section === 'calendar') && (code === 'auth' || code === 'not_configured');
  const why =
    code === 'not_configured'
      ? 'n’est pas configuré'
      : code === 'auth'
        ? needsGoogle
          ? 'demande une reconnexion à Google'
          : 'refuse l’accès'
        : code === 'quota'
          ? 'a atteint son quota'
          : code === 'timeout'
            ? 'ne répond pas à temps'
            : 'ne répond pas';
  return {
    section,
    ok: false,
    spoken: `${what} ${why}, Monsieur. Je poursuis.`,
    error: e instanceof Error ? e.message.slice(0, 200) : 'erreur',
    needsGoogle,
  };
}

export async function runSection(section: Section, now = new Date()): Promise<BlockResult> {
  try {
    const settings = await loadSettings();
    switch (section) {
      case 'mail': {
        if (!googleConfigured()) throw new ServiceError('not_configured', 'Google non configuré');
        const mails = await recentMail();
        const digest = await digestMail(mails);
        return { section, ok: true, spoken: speakMail(digest), data: digest };
      }
      case 'shopify': {
        const list = shops().filter((s) => !settings.disabledShops.includes(s.id));
        if (list.length === 0) return { section, ok: true, spoken: 'Aucune boutique Shopify n’est connectée.', data: { days: [], failed: [] } };
        const day = addDays(parisDay(now), -1);
        const settled = await Promise.allSettled(list.map((s) => salesOfDay(s, day)));
        const days = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
        const failed = list.filter((_, i) => settled[i].status === 'rejected').map((s) => s.name);
        if (days.length === 0) throw settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')!.reason;
        return { section, ok: true, spoken: speakShops(days, failed), data: { day, days, failed } };
      }
      case 'weather': {
        const w = await todayWeather(settings.city);
        return { section, ok: true, spoken: speakWeather(w), data: w };
      }
      case 'news': {
        const r = await yesterdayNews(settings.feeds, now);
        return { section, ok: true, spoken: speakNews(r), data: r };
      }
      case 'calendar': {
        if (!googleConfigured()) throw new ServiceError('not_configured', 'Google non configuré');
        const { start, end } = dayRange(parisDay(now));
        const events = await eventsBetween(start, end);
        return { section, ok: true, spoken: speakAgenda(events), data: { events } };
      }
    }
  } catch (e) {
    return failure(section, e);
  }
}

export function speakAgenda(events: { title: string; start: string; allDay: boolean }[]): string {
  if (events.length === 0) return 'Votre agenda est vide aujourd’hui. Une page blanche, Monsieur.';
  const timed = events.filter((e) => !e.allDay);
  const allDay = events.filter((e) => e.allDay);
  const parts = [`${events.length} rendez-vous aujourd’hui.`];
  if (timed.length) parts.push(timed.map((e) => `À ${spokenTime(new Date(e.start))}, ${e.title}`).join('. ') + '.');
  if (allDay.length) parts.push(`Toute la journée : ${allDay.map((e) => e.title).join(', ')}.`);
  return parts.join(' ');
}
