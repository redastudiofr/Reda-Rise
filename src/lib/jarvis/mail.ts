import { askJson, geminiReady } from './gemini';
import type { MailMeta } from './google';
import { PERSONA } from './persona';

export const GROUPS = ['ventes', 'clients', 'fournisseurs', 'reste'] as const;
export type Group = (typeof GROUPS)[number];
export const GROUP_LABEL: Record<Group, string> = { ventes: 'Ventes', clients: 'Clients', fournisseurs: 'Fournisseurs', reste: 'Le reste' };

export type MailItem = { id: string; from: string; subject: string; summary: string; group: Group };
export type MailDigest = { total: number; important: MailItem[]; ignored: number };

const RULES: [Group, RegExp][] = [
  ['ventes', /commande|order|vente|paiement reçu|payment|shopify|stripe|paypal|facture payée|nouvelle commande/i],
  ['fournisseurs', /fournisseur|livraison|expédition|shipping|devis|facture|invoice|stock|transporteur|colissimo|dhl|ups/i],
  ['clients', /client|retour|remboursement|refund|réclamation|question|support|sav|avis/i],
];

const NOISE = /newsletter|no-?reply|unsubscribe|désinscri|promo|webinar|notification/i;

/** Without the model: keyword grouping, automated senders left out. */
export function heuristicDigest(mails: MailMeta[]): MailDigest {
  const important = mails
    .filter((m) => !(NOISE.test(m.fromEmail) && !RULES[0][1].test(m.subject)))
    .slice(0, 12)
    .map((m) => {
      const text = `${m.subject} ${m.snippet}`;
      const group = RULES.find(([, re]) => re.test(text))?.[0] ?? 'reste';
      return { id: m.id, from: m.from, subject: m.subject, summary: m.subject, group };
    });
  return { total: mails.length, important, ignored: mails.length - important.length };
}

export async function digestMail(mails: MailMeta[]): Promise<MailDigest> {
  if (mails.length === 0) return { total: 0, important: [], ignored: 0 };
  if (!geminiReady()) return heuristicDigest(mails);
  try {
    const list = mails
      .map((m, i) => `${i}. De : ${m.from} <${m.fromEmail}> | Objet : ${m.subject} | Extrait : ${m.snippet.slice(0, 200)}`)
      .join('\n');
    const r = await askJson<{ items: { i: number; group: string; summary: string }[] }>(
      `${PERSONA}\nTu tries le courrier de Monsieur, entrepreneur e-commerce.`,
      `Mails reçus ces dernières 24 h :\n${list}\n\nGarde seulement les mails importants (au plus 10) : écartés les newsletters, publicités, notifications automatiques sans action à faire. Classe chacun dans un groupe : "ventes" (commandes, paiements, chiffres de vente), "clients" (demandes, retours, SAV), "fournisseurs" (fournisseurs, livraisons, factures à payer), "reste". Résume chacun en une phrase de 15 mots maximum, factuelle, sans inventer.\nRéponds uniquement en JSON : {"items":[{"i":<numéro>,"group":"ventes|clients|fournisseurs|reste","summary":"..."}]}`,
    );
    const seen = new Set<number>();
    const important = (r.items ?? [])
      .filter((x) => Number.isInteger(x.i) && mails[x.i] && !seen.has(x.i) && seen.add(x.i))
      .slice(0, 10)
      .map((x) => {
        const m = mails[x.i];
        const group = (GROUPS as readonly string[]).includes(x.group) ? (x.group as Group) : 'reste';
        return { id: m.id, from: m.from, subject: m.subject, summary: String(x.summary || m.subject).trim(), group };
      });
    return { total: mails.length, important, ignored: mails.length - important.length };
  } catch {
    return heuristicDigest(mails);
  }
}

export function speakMail(d: MailDigest): string {
  if (d.total === 0) return 'Aucun mail ces dernières vingt-quatre heures. Une rare tranquillité, Monsieur.';
  if (d.important.length === 0) return `${d.total} mails reçus, rien d'important. Que des sollicitations, Monsieur.`;
  const parts: string[] = [
    `${d.total} mail${d.total > 1 ? 's' : ''} en vingt-quatre heures, dont ${d.important.length} qui méritent votre attention.`,
  ];
  for (const g of GROUPS) {
    const items = d.important.filter((m) => m.group === g);
    if (items.length === 0) continue;
    parts.push(`${GROUP_LABEL[g]} : ${items.map((m) => `${m.from}, ${m.summary.replace(/\.$/, '')}`).join('. ')}.`);
  }
  return parts.join(' ');
}
