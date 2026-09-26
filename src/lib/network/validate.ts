import { cityById } from './places';
import type { NetEventDoc, Precision, ProfileDoc } from './types';

/**
 * Checks on everything members send. Pure functions, shared by the API
 * routes and the forms, so the browser shows the same rule the server applies.
 */

export const SECTORS = [
  'Tech & logiciel',
  'Commerce & e-commerce',
  'Conseil & services',
  'Marketing & communication',
  'Design & création',
  'Finance & assurance',
  'Immobilier & BTP',
  'Restauration & hôtellerie',
  'Santé & bien-être',
  'Sport',
  'Éducation & formation',
  'Industrie & artisanat',
  'Transport & logistique',
  'Agriculture & alimentation',
  'Mode & beauté',
  'Médias & divertissement',
  'Autre',
];

export const LIMITS = {
  pseudo: 40,
  company: 80,
  bio: 600,
  tag: 30,
  tags: 8,
  photoBytes: 90_000,
  eventTitle: 90,
  eventDescription: 1500,
  placeHint: 80,
  message: 2000,
  reportDetail: 500,
};

/** Trims, drops control characters and collapses spaces (keeps line breaks when asked). */
export function clean(v: unknown, max: number, multiline = false): string {
  if (typeof v !== 'string') return '';
  let s = v.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '');
  s = multiline
    ? s.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}

export function cleanTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const t of v) {
    const c = clean(t, LIMITS.tag);
    if (c && !out.some((o) => o.toLowerCase() === c.toLowerCase())) out.push(c);
    if (out.length >= LIMITS.tags) break;
  }
  return out;
}

const ADDRESS = [
  // "12 rue …", "3bis avenue …", "45, bd …"
  /\b\d{1,4}\s*(?:bis|ter|b)?\s*,?\s*(?:rue|avenue|av\.?|boulevard|bd|place|pl\.?|chemin|all[ée]e|impasse|quai|route|rte|cours|square|passage|voie|r[ée]sidence|lotissement|faubourg)\b/i,
  // French postcode
  /\b(?:0[1-9]|[1-8]\d|9[0-5]|2[ab])\d{3}\b/i,
  // GPS coordinates
  /-?\d{1,2}[.,]\d{3,}\s*[,;]\s*-?\d{1,3}[.,]\d{3,}/,
];

/** True when a text looks like an exact address, a postcode or coordinates. */
export function looksLikeAddress(text: string): boolean {
  return ADDRESS.some((re) => re.test(text));
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateProfile(input: Record<string, unknown>): Result<Omit<ProfileDoc, 'photoV' | 'updatedAt'>> {
  const pseudo = clean(input.pseudo, LIMITS.pseudo);
  if (pseudo.length < 2) return { ok: false, error: 'Choisis un prénom ou un pseudo (2 caractères minimum).' };
  const cityId = typeof input.cityId === 'string' ? input.cityId : '';
  if (!cityById(cityId)) return { ok: false, error: 'Choisis la grande ville la plus proche dans la liste.' };
  const sector = typeof input.sector === 'string' && SECTORS.includes(input.sector) ? input.sector : '';
  if (!sector) return { ok: false, error: 'Choisis un secteur.' };
  const precision: Precision = input.precision === 'region' ? 'region' : 'ville';
  const bio = clean(input.bio, LIMITS.bio, true);
  const company = clean(input.company, LIMITS.company);
  if (looksLikeAddress(bio) || looksLikeAddress(company)) {
    return { ok: false, error: 'Retire l’adresse ou le code postal : le profil n’affiche qu’une ville approximative.' };
  }
  return {
    ok: true,
    value: {
      pseudo,
      company,
      sector,
      skills: cleanTags(input.skills),
      interests: cleanTags(input.interests),
      cityId,
      precision,
      bio,
      visible: input.visible !== false,
      openToMessages: input.openToMessages !== false,
    },
  };
}

const PHOTO_TYPES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

/** A small image, checked by its actual bytes rather than its declared type. */
export function validatePhoto(dataUrl: unknown): Result<{ type: string; bytes: Buffer }> {
  if (typeof dataUrl !== 'string') return { ok: false, error: 'Photo manquante.' };
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) return { ok: false, error: 'Format de photo non accepté (JPEG, PNG ou WebP).' };
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > LIMITS.photoBytes) return { ok: false, error: 'Photo trop lourde.' };
  if (bytes.length < 12 || !PHOTO_TYPES[m[1]](bytes)) return { ok: false, error: 'Le fichier n’est pas une image valide.' };
  return { ok: true, value: { type: m[1], bytes } };
}

export function validateEvent(
  input: Record<string, unknown>,
  today: string,
): Result<Omit<NetEventDoc, 'organizer' | 'createdAt'>> {
  const title = clean(input.title, LIMITS.eventTitle);
  if (title.length < 3) return { ok: false, error: 'Donne un titre à l’événement.' };
  const description = clean(input.description, LIMITS.eventDescription, true);
  const date = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : '';
  if (!date || Number.isNaN(Date.parse(date))) return { ok: false, error: 'Date invalide.' };
  if (date < today) return { ok: false, error: 'La date est déjà passée.' };
  if (date > addDays(today, 366)) return { ok: false, error: 'Date trop lointaine (un an maximum).' };
  const time = typeof input.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time) ? input.time : '';
  if (!time) return { ok: false, error: 'Heure invalide.' };
  const duration = Math.round(Number(input.duration));
  if (!Number.isFinite(duration) || duration < 15 || duration > 24 * 60) return { ok: false, error: 'Durée invalide.' };
  const cityId = typeof input.cityId === 'string' && cityById(input.cityId) ? input.cityId : '';
  if (!cityId) return { ok: false, error: 'Choisis la ville.' };
  const placeHint = clean(input.placeHint, LIMITS.placeHint);
  if ([title, description, placeHint].some(looksLikeAddress)) {
    return {
      ok: false,
      error: 'Pas d’adresse exacte ni de code postal : indique un lieu approximatif (ex. « centre-ville »). Tu pourras donner l’adresse aux participants dans la discussion de l’événement.',
    };
  }
  let capacity: number | undefined;
  if (input.capacity !== undefined && input.capacity !== null && input.capacity !== '') {
    capacity = Math.round(Number(input.capacity));
    if (!Number.isFinite(capacity) || capacity < 2 || capacity > 1000) return { ok: false, error: 'Nombre de places invalide (2 à 1000).' };
  }
  return { ok: true, value: { title, description, date, time, duration, cityId, placeHint, capacity } };
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Anti-spam checks on one message, given the sender's latest messages in the conversation. */
export function validateMessage(text: unknown, recentFromSender: string[]): Result<string> {
  const t = clean(text, LIMITS.message + 1, true);
  if (!t) return { ok: false, error: 'Message vide.' };
  if (t.length > LIMITS.message) return { ok: false, error: `Message trop long (${LIMITS.message} caractères maximum).` };
  const links = t.match(/(https?:\/\/|www\.)\S+/gi) ?? [];
  if (links.length > 3) return { ok: false, error: 'Trop de liens dans un seul message.' };
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  if (recentFromSender.slice(-3).some((r) => norm(r) === norm(t))) {
    return { ok: false, error: 'Tu viens déjà d’envoyer ce message.' };
  }
  return { ok: true, value: t };
}

export const REPORT_REASONS = ['Spam ou publicité', 'Harcèlement ou insultes', 'Arnaque ou fraude', 'Faux profil', 'Contenu inapproprié', 'Autre'];
