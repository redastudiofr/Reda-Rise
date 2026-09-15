import type { Settings } from './types';
import type { PushPayload } from './push';

/**
 * Turns the user's reminder settings into the notifications that are due right
 * now. The cron route calls this; a de-duplication key keeps every reminder to
 * a single delivery per slot even if the cron fires more than once.
 */

export type DueNotification = PushPayload & { key: string };

/** How late a reminder may still be delivered (minutes). Absorbs cron jitter. */
const CATCH_UP_MINUTES = 75;

function parseTime(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function localNow(tz: string, now = new Date()) {
  let dateKey: string;
  let timeStr: string;
  try {
    dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    timeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    dateKey = now.toISOString().slice(0, 10);
    timeStr = now.toISOString().slice(11, 16);
  }
  const [y, m, d] = dateKey.split('-').map(Number);
  const minutes = parseTime(timeStr) ?? 0;
  return { dateKey, minutes, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

function isDue(nowMinutes: number, target: number): boolean {
  const delta = nowMinutes - target;
  return delta >= 0 && delta < CATCH_UP_MINUTES;
}

export function dueNotifications(settings: Settings, now = new Date()): DueNotification[] {
  const { dateKey, minutes, weekday } = localNow(settings.timezone, now);
  const n = settings.notifications;
  const out: DueNotification[] = [];

  if (n.creatine.enabled) {
    const t = parseTime(n.creatine.time);
    if (t !== null && isDue(minutes, t)) {
      out.push({
        key: `creatine:${dateKey}`,
        title: 'Créatine',
        body: 'Prends ta dose du jour, 3 à 5 g avec un grand verre d’eau.',
        tag: 'creatine',
        url: '/',
      });
    }
  }

  if (n.hydration.enabled) {
    const start = parseTime(n.hydration.start);
    const end = parseTime(n.hydration.end);
    const step = Math.max(1, Math.round(n.hydration.everyHours)) * 60;
    if (start !== null && end !== null && end > start) {
      for (let t = start; t <= end; t += step) {
        if (isDue(minutes, t)) {
          out.push({
            key: `hydration:${dateKey}:${t}`,
            title: 'Hydratation',
            body: 'Bois un grand verre d’eau. Objectif 2,5 à 3 L sur la journée.',
            tag: 'hydration',
            url: '/',
          });
        }
      }
    }
  }

  if (n.meals.enabled) {
    const labels = ['Petit-déjeuner', 'Déjeuner', 'Dîner'];
    const bodies = [
      'Protéines, glucides complexes et un fruit pour démarrer.',
      'Repas complet : protéines, féculents, légumes.',
      'Dernier repas de la journée. Protéines et légumes en priorité.',
    ];
    n.meals.times.forEach((time, i) => {
      const t = parseTime(time);
      if (t !== null && isDue(minutes, t)) {
        out.push({
          key: `meal${i}:${dateKey}`,
          title: labels[i] ?? `Repas ${i + 1}`,
          body: bodies[i] ?? 'Repas complet et équilibré.',
          tag: `meal-${i}`,
          url: '/',
        });
      }
    });
  }

  if (n.sleep.enabled) {
    const t = parseTime(n.sleep.time);
    if (t !== null && isDue(minutes, t)) {
      out.push({
        key: `sleep:${dateKey}`,
        title: 'Sommeil',
        body: 'Prépare-toi à dormir. Écrans coupés, 8 h de récupération.',
        tag: 'sleep',
        url: '/',
      });
    }
  }

  if (n.workout.enabled && n.workout.days.includes(weekday)) {
    const t = parseTime(n.workout.time);
    if (t !== null && isDue(minutes, t)) {
      out.push({
        key: `workout:${dateKey}`,
        title: 'Séance',
        body: 'Ta séance commence bientôt. Ouvre l’app pour voir les charges prévues.',
        tag: 'workout',
        url: '/muscu',
      });
    }
  }

  if (n.objectives.enabled) {
    const t = parseTime(n.objectives.time);
    if (t !== null && isDue(minutes, t)) {
      out.push({
        key: `objectives:${dateKey}`,
        title: 'Objectifs du jour',
        body: 'N’oublie pas tes objectifs du jour.',
        tag: 'objectives',
        url: '/',
      });
    }
  }

  if (n.review.enabled) {
    const t = parseTime(n.review.time);
    if (t !== null && isDue(minutes, t)) {
      out.push({
        key: `review:${dateKey}`,
        title: 'Bilan du jour',
        body: 'Fais ton bilan quotidien et termine ta journée.',
        tag: 'review',
        url: '/',
      });
    }
  }

  return out;
}
