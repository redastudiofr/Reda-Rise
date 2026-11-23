/** Settings shared by the server and the page (no secret in here). */

export type Feed = { id: string; name: string; url: string; enabled: boolean };

/** Busy block that repeats every week, e.g. courses. Minutes since midnight. */
export type WeeklyBlock = { weekday: number; start: number; end: number; label: string };

export type Settings = {
  city: { name: string; lat: number; lon: number };
  voiceName: string; // last voice chosen; the browser also keeps its own
  rate: number; // speech rate, 0.7 – 1.4
  feeds: Feed[];
  disabledShops: string[];
  courses: WeeklyBlock[];
  dayStart: number; // planning window, minutes since midnight
  dayEnd: number;
  bufferMinutes: number; // gap left between two planned tasks
};

const h = (x: number) => x * 60;

export const DEFAULT_COURSES: WeeklyBlock[] = [
  { weekday: 1, start: h(8), end: h(18), label: 'Cours' },
  { weekday: 2, start: h(8), end: h(18), label: 'Cours' },
  { weekday: 3, start: h(8), end: h(16), label: 'Cours' },
  { weekday: 4, start: h(8), end: h(18), label: 'Cours' },
  { weekday: 5, start: h(8), end: h(15), label: 'Cours' },
];

/** Checked on 2026-11-05. Les Echos may refuse some servers: Jarvis then says so and goes on. */
export const DEFAULT_FEEDS: Feed[] = [
  { id: 'lemonde', name: 'Le Monde', url: 'https://www.lemonde.fr/rss/en_continu.xml', enabled: true },
  { id: 'franceinfo', name: 'franceinfo', url: 'https://www.franceinfo.fr/titres.rss', enabled: true },
  { id: 'lesechos', name: 'Les Echos', url: 'https://services.lesechos.fr/rss/les-echos-economie.xml', enabled: true },
  { id: 'jdn', name: 'Journal du Net', url: 'https://www.journaldunet.com/rss/', enabled: true },
];

export const DEFAULT_SETTINGS: Settings = {
  city: { name: 'Paris', lat: 48.8534, lon: 2.3488 },
  voiceName: '',
  rate: 1.05,
  feeds: DEFAULT_FEEDS,
  disabledShops: [],
  courses: DEFAULT_COURSES,
  dayStart: h(7),
  dayEnd: h(22),
  bufferMinutes: 10,
};

function validUrl(u: string): boolean {
  try {
    return /^https?:$/.test(new URL(u).protocol);
  } catch {
    return false;
  }
}

const clamp = (n: unknown, lo: number, hi: number, d: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;

/** Whatever arrives (old save, hand-edited request) becomes valid settings. */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const d = DEFAULT_SETTINGS;
  const city =
    r.city && typeof r.city.name === 'string' && Number.isFinite(r.city.lat) && Number.isFinite(r.city.lon)
      ? { name: r.city.name.slice(0, 80), lat: clamp(r.city.lat, -90, 90, 0), lon: clamp(r.city.lon, -180, 180, 0) }
      : d.city;
  const feeds = Array.isArray(r.feeds)
    ? r.feeds
        .filter((f) => f && typeof f.url === 'string' && validUrl(f.url))
        .slice(0, 12)
        .map((f, i) => ({
          id: typeof f.id === 'string' && f.id ? f.id.slice(0, 40) : `feed${i}`,
          name: typeof f.name === 'string' && f.name.trim() ? f.name.trim().slice(0, 60) : new URL(f.url).hostname,
          url: f.url.slice(0, 500),
          enabled: f.enabled !== false,
        }))
    : d.feeds;
  const courses = Array.isArray(r.courses)
    ? r.courses
        .filter((b) => b && Number.isInteger(b.weekday) && b.weekday >= 0 && b.weekday <= 6 && b.end > b.start)
        .slice(0, 30)
        .map((b) => ({ weekday: b.weekday, start: clamp(b.start, 0, 1440, 0), end: clamp(b.end, 0, 1440, 0), label: String(b.label || 'Cours').slice(0, 40) }))
    : d.courses;
  const dayStart = clamp(r.dayStart, 0, 1380, d.dayStart);
  return {
    city,
    voiceName: typeof r.voiceName === 'string' ? r.voiceName.slice(0, 200) : '',
    rate: clamp(r.rate, 0.7, 1.4, d.rate),
    feeds,
    disabledShops: Array.isArray(r.disabledShops) ? r.disabledShops.filter((x) => typeof x === 'string').slice(0, 20) : [],
    courses,
    dayStart,
    dayEnd: Math.max(dayStart + 60, clamp(r.dayEnd, 60, 1440, d.dayEnd)),
    bufferMinutes: clamp(r.bufferMinutes, 0, 60, d.bufferMinutes),
  };
}
