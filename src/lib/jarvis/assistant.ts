import { eventsBetween, latestMailFrom, type CalEvent } from './google';
import { geminiReady, runWithTools, type Step, type ToolDecl } from './gemini';
import { ServiceError } from './http';
import { detailPoint, type NewsPoint } from './news';
import { PERSONA, nowContext } from './persona';
import { planDay, type Interval, type Plan, type TaskRequest } from './planner';
import { loadSettings } from './serverSettings';
import { addDays, dayRange, hhmm, longDay, parisDay, type DayKey } from './time';

export type ChatTurn = { role: 'user' | 'jarvis'; text: string };
export type ChatContext = { news?: NewsPoint[]; mails?: { from: string; subject: string }[]; plan?: Plan | null };
export type ChatReply = { reply: string; plan?: Plan; mail?: { from: string; subject: string; date: string } };

const TOOLS: ToolDecl[] = [
  {
    name: 'plan_day',
    description:
      "Calcule un planning dans les créneaux libres d'une journée (cours et rendez-vous existants exclus). À appeler quand Monsieur énumère des tâches à faire. Ne crée rien : Monsieur doit confirmer ensuite.",
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Jour au format AAAA-MM-JJ ; aujourd’hui par défaut.' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Intitulé court de la tâche, tel que dit par Monsieur.' },
              minutes: { type: 'integer', description: 'Durée estimée en minutes (si non dite, estime raisonnablement).' },
              earliest: { type: 'string', description: 'Pas avant cette heure HH:MM (ex. "le soir" → 18:00).' },
              latest: { type: 'string', description: 'Terminé avant cette heure HH:MM.' },
              at: { type: 'string', description: 'Heure imposée HH:MM, seulement si Monsieur la donne.' },
            },
            required: ['title', 'minutes'],
          },
        },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'read_email',
    description: 'Récupère le dernier mail reçu d’une personne ou d’une société (30 derniers jours), pour le lire à Monsieur.',
    parameters: { type: 'object', properties: { sender: { type: 'string', description: 'Nom, société ou adresse de l’expéditeur.' } }, required: ['sender'] },
  },
  {
    name: 'detail_news',
    description: 'Développe un point de la revue de presse du jour (numéro 1 à 5).',
    parameters: { type: 'object', properties: { point: { type: 'integer' } }, required: ['point'] },
  },
  {
    name: 'get_agenda',
    description: "Liste les rendez-vous d'un jour donné.",
    parameters: { type: 'object', properties: { date: { type: 'string', description: 'AAAA-MM-JJ' } }, required: ['date'] },
  },
];

const minutesOf = (v: unknown): number | undefined => {
  if (typeof v !== 'string') return undefined;
  const m = /^(\d{1,2})[:h](\d{2})?$/.exec(v.trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  const mi = Number(m[2] ?? 0);
  return h < 24 && mi < 60 ? h * 60 + mi : undefined;
};

function validDay(v: unknown, today: DayKey): DayKey {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= today && v <= addDays(today, 31)) return v;
  return today;
}

export const busyOf = (events: CalEvent[]): Interval[] =>
  events.filter((e) => e.busy).map((e) => ({ start: Date.parse(e.start), end: Date.parse(e.end), label: e.title }));

export async function computePlan(day: DayKey, tasks: TaskRequest[], now = Date.now()): Promise<Plan> {
  const settings = await loadSettings();
  const { start, end } = dayRange(day);
  const events = await eventsBetween(start, end);
  return planDay(day, tasks, busyOf(events), settings, now);
}

export async function chat(message: string, history: ChatTurn[], ctx: ChatContext): Promise<ChatReply> {
  if (!geminiReady()) throw new ServiceError('not_configured', 'GEMINI_API_KEY manquante.');
  const today = parisDay();
  const out: ChatReply = { reply: '' };

  const context: string[] = [nowContext()];
  if (ctx.news?.length) context.push(`Revue de presse lue ce matin :\n${ctx.news.map((p) => `${p.n}. ${p.title}`).join('\n')}`);
  if (ctx.mails?.length) context.push(`Mails importants du jour : ${ctx.mails.map((m) => `${m.from} (${m.subject})`).join(' ; ')}`);
  if (ctx.plan?.items.length)
    context.push(`Planning proposé, en attente de confirmation : ${ctx.plan.items.map((i) => `${hhmm(new Date(i.start))}-${hhmm(new Date(i.end))} ${i.title}`).join(' ; ')}`);

  const system = `${PERSONA}
${context.join('\n\n')}
Quand Monsieur énumère ses tâches, appelle plan_day avec toutes les tâches, puis présente le planning en une ou deux phrases et demande s'il confirme. Si des tâches n'ont pas trouvé de place, dis-le. Tu ne peux pas créer toi-même les événements : la confirmation se fait par « je confirme » ou le bouton à l'écran.
Pour lire un mail, appelle read_email puis lis-le fidèlement : expéditeur, objet, puis le contenu (résume s'il dépasse 120 mots).`;

  const input: Step[] = [
    ...history.slice(-12).map((t): Step =>
      t.role === 'user' ? { type: 'user_input', content: t.text } : { type: 'model_output', content: [{ type: 'text', text: t.text }] },
    ),
    { type: 'user_input', content: message },
  ];

  const { text } = await runWithTools({
    system,
    input,
    tools: TOOLS,
    handlers: {
      plan_day: async (args) => {
        const day = validDay(args.date, today);
        const raw = Array.isArray(args.tasks) ? (args.tasks as Record<string, unknown>[]) : [];
        const tasks: TaskRequest[] = raw
          .filter((t) => typeof t.title === 'string' && t.title.trim())
          .slice(0, 15)
          .map((t) => ({
            title: String(t.title).trim(),
            minutes: Number(t.minutes) > 0 ? Number(t.minutes) : 30,
            earliest: minutesOf(t.earliest),
            latest: minutesOf(t.latest),
            at: minutesOf(t.at),
          }));
        const plan = await computePlan(day, tasks);
        out.plan = plan;
        return {
          jour: longDay(plan.day),
          planning: plan.items.map((i) => ({ tache: i.title, debut: hhmm(new Date(i.start)), fin: hhmm(new Date(i.end)) })),
          non_placees: plan.unplaced,
        };
      },
      read_email: async (args) => {
        const m = await latestMailFrom(String(args.sender ?? ''));
        if (!m) return { introuvable: true };
        out.mail = { from: m.from, subject: m.subject, date: m.date };
        return { de: m.from, objet: m.subject, date: m.date, contenu: m.body };
      },
      detail_news: async (args) => {
        const p = ctx.news?.find((x) => x.n === Number(args.point));
        if (!p) return { introuvable: true };
        return { detail: await detailPoint(p) };
      },
      get_agenda: async (args) => {
        const day = validDay(args.date, today);
        const { start, end } = dayRange(day);
        const events = await eventsBetween(start, end);
        return { jour: longDay(day), rendez_vous: events.map((e) => ({ titre: e.title, debut: e.allDay ? 'journée' : hhmm(new Date(e.start)), fin: e.allDay ? '' : hhmm(new Date(e.end)) })) };
      },
    },
  });
  out.reply = text || 'Pardon, Monsieur, je n’ai rien de pertinent à répondre.';
  return out;
}
