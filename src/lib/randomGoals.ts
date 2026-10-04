import type { Category, Difficulty } from './types';

/**
 * Pool of ready-made objectives for the random generator.
 *
 * Everything here is meant to be doable the same day and actually useful — no
 * filler. To add one, append to the list: the generator picks up new entries on
 * its own, and `proof` marks the ones where a photo genuinely shows the result.
 */

export type GoalTemplate = {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  /** A photo makes sense here — the objective leaves something visible behind. */
  proof?: boolean;
};

export const GOAL_POOL: GoalTemplate[] = [
  /* --- facile --- */
  { id: 'g-lire-20', title: 'Lire 20 pages', category: 'etudes', difficulty: 'facile' },
  { id: 'g-marche-30', title: 'Marcher 30 minutes', category: 'sport', difficulty: 'facile' },
  { id: 'g-bureau', title: 'Ranger son espace de travail', category: 'habitudes', difficulty: 'facile', proof: true },
  { id: 'g-eau', title: 'Boire 2,5 L d’eau sur la journée', category: 'habitudes', difficulty: 'facile' },
  { id: 'g-etirements', title: 'Faire 15 minutes d’étirements', category: 'sport', difficulty: 'facile' },
  { id: 'g-notes', title: 'Noter les trois priorités de demain', category: 'personnel', difficulty: 'facile' },
  { id: 'g-inbox', title: 'Vider sa boîte mail', category: 'travail', difficulty: 'facile' },
  { id: 'g-coucher', title: 'Se coucher avant 23 h', category: 'discipline', difficulty: 'facile' },
  { id: 'g-photos', title: 'Trier les photos et fichiers du téléphone', category: 'habitudes', difficulty: 'facile' },
  { id: 'g-repas', title: 'Préparer un repas complet maison', category: 'habitudes', difficulty: 'facile', proof: true },

  /* --- moyen --- */
  { id: 'g-sport-30', title: 'Faire 30 minutes de sport', category: 'sport', difficulty: 'moyen' },
  { id: 'g-apprendre-30', title: 'Apprendre quelque chose pendant 30 minutes', category: 'etudes', difficulty: 'moyen' },
  { id: 'g-projet-1h', title: 'Travailler 1 h sur son projet personnel', category: 'entrepreneuriat', difficulty: 'moyen' },
  { id: 'g-repoussee', title: 'Faire la tâche repoussée depuis plusieurs jours', category: 'discipline', difficulty: 'moyen' },
  { id: 'g-zero-depense', title: 'Ne dépenser aucun argent de la journée', category: 'discipline', difficulty: 'moyen' },
  { id: 'g-epargne-20', title: 'Mettre 20 € de côté', category: 'personnel', difficulty: 'moyen' },
  { id: 'g-menage', title: 'Nettoyer une pièce à fond', category: 'habitudes', difficulty: 'moyen', proof: true },
  { id: 'g-ecran', title: 'Rester sous 1 h de réseaux sociaux', category: 'discipline', difficulty: 'moyen' },
  { id: 'g-revision', title: 'Réviser un chapitre en entier', category: 'etudes', difficulty: 'moyen' },
  { id: 'g-appel', title: 'Passer l’appel qu’on repousse', category: 'personnel', difficulty: 'moyen' },
  { id: 'g-budget', title: 'Faire le point sur ses dépenses du mois', category: 'personnel', difficulty: 'moyen' },
  { id: 'g-cuisine-semaine', title: 'Préparer ses repas pour deux jours', category: 'habitudes', difficulty: 'moyen', proof: true },

  /* --- difficile --- */
  { id: 'g-seance-complete', title: 'Faire une séance complète sans en sauter un exercice', category: 'sport', difficulty: 'difficile' },
  { id: 'g-projet-3h', title: 'Travailler 3 h d’affilée sur son projet', category: 'entrepreneuriat', difficulty: 'difficile' },
  { id: 'g-lire-100', title: 'Lire 100 pages dans la journée', category: 'etudes', difficulty: 'difficile' },
  { id: 'g-epargne-100', title: 'Mettre 100 € de côté', category: 'personnel', difficulty: 'difficile' },
  { id: 'g-zero-ecran', title: 'Une journée entière sans réseaux sociaux', category: 'discipline', difficulty: 'difficile' },
  { id: 'g-livrer', title: 'Terminer et livrer une tâche importante', category: 'travail', difficulty: 'difficile' },
  { id: 'g-10k', title: 'Marcher 10 000 pas', category: 'sport', difficulty: 'difficile' },
  { id: 'g-grand-menage', title: 'Ranger et désencombrer tout son logement', category: 'habitudes', difficulty: 'difficile', proof: true },
  { id: 'g-cv', title: 'Mettre à jour son CV ou son portfolio', category: 'travail', difficulty: 'difficile' },
  { id: 'g-admin', title: 'Régler tous ses papiers en retard', category: 'personnel', difficulty: 'difficile' },

  /* --- épique --- */
  { id: 'g-semaine-sport', title: 'Enchaîner sept jours de sport sans en manquer un', category: 'sport', difficulty: 'epique' },
  { id: 'g-projet-livre', title: 'Sortir une première version de son projet', category: 'entrepreneuriat', difficulty: 'epique', proof: true },
  { id: 'g-mois-sans-achat', title: 'Un mois sans achat superflu', category: 'discipline', difficulty: 'epique' },
  { id: 'g-livre-entier', title: 'Terminer un livre en entier', category: 'etudes', difficulty: 'epique', proof: true },
  { id: 'g-epargne-500', title: 'Mettre 500 € de côté', category: 'personnel', difficulty: 'epique' },
  { id: 'g-30-jours', title: 'Tenir une nouvelle habitude 30 jours d’affilée', category: 'habitudes', difficulty: 'epique' },
];

export function templatesFor(difficulty: Difficulty): GoalTemplate[] {
  return GOAL_POOL.filter((t) => t.difficulty === difficulty);
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Draws `count` objectives the user does not already have on the go. Titles
 * already taken are excluded, so the generator never proposes the same thing
 * twice; if the pool runs dry it simply returns fewer.
 */
export function drawGoals(
  count: number,
  takenTitles: Iterable<string>,
  difficulty?: Difficulty,
): GoalTemplate[] {
  const taken = new Set([...takenTitles].map((t) => t.trim().toLowerCase()));
  const pool = (difficulty ? templatesFor(difficulty) : GOAL_POOL).filter(
    (t) => !taken.has(t.title.toLowerCase()),
  );
  return shuffle(pool).slice(0, count);
}
