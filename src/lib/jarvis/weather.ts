import { env } from './env';
import { fetchJson } from './http';
import { TZ } from './time';

/** WMO weather codes, as Open-Meteo returns them. */
const CODES: [number[], string][] = [
  [[0], 'ciel dégagé'],
  [[1], 'ciel plutôt dégagé'],
  [[2], 'quelques nuages'],
  [[3], 'ciel couvert'],
  [[45, 48], 'brouillard'],
  [[51, 53, 55, 56, 57], 'bruine'],
  [[61, 63, 66, 80, 81], 'pluie'],
  [[65, 67, 82], 'forte pluie'],
  [[71, 73, 75, 77, 85, 86], 'neige'],
  [[95, 96, 99], 'orages'],
];

export const describeCode = (c: number) => CODES.find(([cs]) => cs.includes(c))?.[1] ?? 'temps variable';

export type Weather = {
  city: string;
  now: number;
  min: number;
  max: number;
  rainChance: number;
  wind: number;
  label: string;
};

type Forecast = {
  current?: { temperature_2m: number; weather_code: number };
  daily?: {
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_probability_max: (number | null)[];
    weather_code: number[];
    wind_speed_10m_max: number[];
  };
};

export async function todayWeather(city: { name: string; lat: number; lon: number }): Promise<Weather> {
  const q = new URLSearchParams({
    latitude: String(city.lat),
    longitude: String(city.lon),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_min,temperature_2m_max,precipitation_probability_max,weather_code,wind_speed_10m_max',
    timezone: TZ,
    forecast_days: '1',
  });
  const f = await fetchJson<Forecast>(`${env.meteoUrl()}/forecast?${q}`, {}, 8000);
  if (!f.daily || !f.current) throw new Error('forecast incomplete');
  return {
    city: city.name,
    now: Math.round(f.current.temperature_2m),
    min: Math.round(f.daily.temperature_2m_min[0]),
    max: Math.round(f.daily.temperature_2m_max[0]),
    rainChance: Math.round(f.daily.precipitation_probability_max[0] ?? 0),
    wind: Math.round(f.daily.wind_speed_10m_max[0]),
    label: describeCode(f.daily.weather_code[0]),
  };
}

/** Short, spoken, with a touch of butler. */
export function speakWeather(w: Weather): string {
  const parts = [`À ${w.city}, ${w.label}, ${w.now} degrés actuellement.`, `Entre ${w.min} et ${w.max} aujourd'hui.`];
  if (w.rainChance >= 60) parts.push(`Risque de pluie à ${w.rainChance} %. Le parapluie serait avisé, Monsieur.`);
  else if (w.rainChance >= 30) parts.push(`${w.rainChance} % de risque d'averse.`);
  if (w.wind >= 40) parts.push(`Vent soutenu, jusqu'à ${w.wind} km/h.`);
  if (w.max <= 3) parts.push('Prévoyez un manteau sérieux.');
  return parts.join(' ');
}

export type Place = { name: string; lat: number; lon: number; detail: string };

export async function searchCity(name: string): Promise<Place[]> {
  const q = new URLSearchParams({ name, count: '6', language: 'fr', format: 'json' });
  const r = await fetchJson<{ results?: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }[] }>(
    `${env.geocodingUrl()}/search?${q}`,
    {},
    8000,
  );
  return (r.results ?? []).map((p) => ({
    name: p.name,
    lat: p.latitude,
    lon: p.longitude,
    detail: [p.admin1, p.country].filter(Boolean).join(', '),
  }));
}
