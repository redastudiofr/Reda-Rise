/** Voice commands recognised locally, without asking the model (instant). */
export type Intent =
  | { kind: 'repeat' }
  | { kind: 'skip' }
  | { kind: 'detail'; point: number }
  | { kind: 'readMail'; from: string }
  | { kind: 'confirm' }
  | { kind: 'cancel' }
  | { kind: 'free'; text: string };

const NUMBERS: Record<string, number> = {
  un: 1, une: 1, premier: 1, première: 1, '1er': 1,
  deux: 2, deuxième: 2, second: 2, seconde: 2,
  trois: 3, troisième: 3,
  quatre: 4, quatrième: 4,
  cinq: 5, cinquième: 5,
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.!?,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `pendingPlan`: a plan is on screen, so "oui" means confirm it. */
export function parseIntent(raw: string, pendingPlan = false): Intent {
  const t = normalize(raw).replace(/^(jarvis|ok jarvis|dis jarvis|eh jarvis)\s+/, '');
  if (/^(répète|repete|répètes|répétez|repetez|tu peux répéter|peux-tu répéter|encore une fois|redis|redis-le)\b/.test(t)) return { kind: 'repeat' };
  if (/^(passe|passes|passez|suivant|la suite|stop|arrête|arrete|tais-toi|silence|skip)\b/.test(t)) return { kind: 'skip' };

  const d = /(?:détaille|detaille|développe|developpe|détailles|dis-m'en plus sur|plus de détails sur)(?:-moi| moi)?\s+(?:le |la )?(?:point|sujet|info|information|news)\s+(?:numéro\s+|n°\s*)?(\d|[a-zéèè1]+)/.exec(t);
  if (d) {
    const n = /^\d$/.test(d[1]) ? Number(d[1]) : NUMBERS[d[1]];
    if (n >= 1 && n <= 5) return { kind: 'detail', point: n };
  }
  const d2 = /(?:détaille|detaille|développe|developpe)(?:-moi| moi)?\s+(?:le |la )?(premier|première|deuxième|second|troisième|quatrième|cinquième)\s+(?:point|sujet)/.exec(t);
  if (d2) return { kind: 'detail', point: NUMBERS[d2[1]] };

  const m = /(?:lis|lit|lire|lisez)(?:-moi| moi)?\s+(?:le |son |ce )?(?:dernier |nouveau )?(?:mail|e-mail|email|courriel|message)\s+(?:de |d'|du |des )\s*(.+)$/.exec(t);
  if (m && m[1].trim()) return { kind: 'readMail', from: m[1].replace(/^(monsieur|madame|la société|la boutique)\s+/, '').trim() };

  if (pendingPlan) {
    if (/^(oui|ouais|je confirme|confirme|confirmé|c'est bon|valide|je valide|parfait|d'accord|ok|go|vas-y|allez-y|crée|créez)\b/.test(t)) return { kind: 'confirm' };
    if (/^(non|annule|annuler|laisse tomber|oublie)\b/.test(t)) return { kind: 'cancel' };
  }
  return { kind: 'free', text: raw.trim() };
}

/**
 * The microphone also hears Jarvis through the speakers. A phrase whose words
 * are nearly all in what Jarvis just said is its own echo.
 */
export function isEcho(heard: string, spoken: string): boolean {
  const w = normalize(heard).split(' ').filter((x) => x.length > 2);
  if (w.length < 2) return false;
  const said = new Set(normalize(spoken).split(' '));
  return w.filter((x) => said.has(x)).length / w.length >= 0.8;
}

/** Long text cut at sentence ends: browsers stop very long utterances. */
export function sentences(text: string, max = 220): string[] {
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > max && cur) {
      out.push(cur.trim());
      cur = '';
    }
    if (p.length > max) {
      for (const chunk of p.split(/(?<=,)\s/)) {
        if ((cur + chunk).length > max && cur) {
          out.push(cur.trim());
          cur = '';
        }
        cur += chunk + ' ';
      }
    } else cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
