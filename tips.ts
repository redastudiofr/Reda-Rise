/**
 * Conseils d'entraînement.
 *
 * Une simple liste : pour en ajouter, en retirer ou en réécrire un, il suffit
 * de toucher au tableau `TIPS` ci-dessous. Une catégorie apparaît d'elle-même
 * dans la page dès qu'au moins un conseil la porte.
 */

export type TipCategoryId =
  | 'entrainement'
  | 'progression'
  | 'recuperation'
  | 'technique'
  | 'organisation'
  | 'nutrition';

export const TIP_CATEGORIES: { id: TipCategoryId; label: string }[] = [
  { id: 'entrainement', label: 'Entraînement' },
  { id: 'progression', label: 'Progression' },
  { id: 'recuperation', label: 'Récupération' },
  { id: 'technique', label: 'Technique' },
  { id: 'organisation', label: 'Organisation' },
  { id: 'nutrition', label: 'Nutrition générale' },
];

export type Tip = {
  id: string;
  category: TipCategoryId;
  title: string;
  text: string;
};

export const TIPS: Tip[] = [
  {
    id: 'ent-echauffement',
    category: 'entrainement',
    title: 'Échauffe-toi avant les séries lourdes',
    text: 'Quelques séries légères sur le premier exercice préparent les articulations et te permettent d’attaquer ta série de travail dans de bonnes conditions.',
  },
  {
    id: 'ent-volume',
    category: 'entrainement',
    title: 'Reste dans la fourchette de répétitions',
    text: 'Choisis une charge qui te permet de tenir la fourchette prévue sur toutes tes séries. Trop lourd, la dernière série s’effondre ; trop léger, la séance ne demande rien.',
  },
  {
    id: 'ent-repos',
    category: 'entrainement',
    title: 'Respecte les temps de repos',
    text: 'Sur les exercices lourds, laisse-toi le temps de récupérer entre les séries. Enchaîner trop vite fait chuter les performances sans rendre la séance plus efficace.',
  },
  {
    id: 'pro-noter',
    category: 'progression',
    title: 'Note tes performances',
    text: 'Note tes performances après chaque séance afin de suivre ta progression et d’identifier les exercices sur lesquels tu peux progresser.',
  },
  {
    id: 'pro-surcharge',
    category: 'progression',
    title: 'Augmente progressivement',
    text: 'Quand toutes tes séries atteignent le haut de la fourchette de répétitions, ajoute un petit incrément de charge. La progression se construit par petites marches, pas par bonds.',
  },
  {
    id: 'pro-plateau',
    category: 'progression',
    title: 'Un plateau n’est pas un échec',
    text: 'Si la charge stagne plusieurs semaines, regarde d’abord le sommeil, l’alimentation et le nombre de séances avant de changer de programme.',
  },
  {
    id: 'rec-repos',
    category: 'recuperation',
    title: 'Laisse le muscle récupérer',
    text: 'Une bonne récupération est essentielle pour progresser. Accorde suffisamment de repos aux groupes musculaires sollicités.',
  },
  {
    id: 'rec-sommeil',
    category: 'recuperation',
    title: 'Le sommeil fait partie de l’entraînement',
    text: 'C’est pendant le repos que le corps s’adapte au travail fourni. Des nuits courtes répétées se voient rapidement sur les performances.',
  },
  {
    id: 'rec-decharge',
    category: 'recuperation',
    title: 'Allège quand la fatigue s’accumule',
    text: 'Une semaine plus légère de temps en temps permet de repartir plus fort plutôt que de traîner une fatigue de fond.',
  },
  {
    id: 'tec-execution',
    category: 'technique',
    title: 'La technique avant la charge',
    text: 'Privilégie une exécution contrôlée et une bonne amplitude plutôt que de simplement chercher à augmenter la charge.',
  },
  {
    id: 'tec-tempo',
    category: 'technique',
    title: 'Contrôle la descente',
    text: 'Descendre en contrôlant le mouvement rend chaque répétition plus utile qu’un mouvement relâché et rapide.',
  },
  {
    id: 'tec-amplitude',
    category: 'technique',
    title: 'Travaille en amplitude complète',
    text: 'Réduire l’amplitude pour mettre plus lourd donne un chiffre plus flatteur sur le carnet, mais moins de travail réel pour le muscle.',
  },
  {
    id: 'org-regularite',
    category: 'organisation',
    title: 'La régularité passe avant l’intensité',
    text: 'Trois séances par semaine tenues sur des mois valent mieux qu’une semaine parfaite suivie de deux semaines sans rien.',
  },
  {
    id: 'org-planifier',
    category: 'organisation',
    title: 'Planifie tes séances à l’avance',
    text: 'Savoir quel jour tu t’entraînes et quels exercices tu vas faire supprime la décision à prendre au dernier moment — et donc l’occasion de repousser.',
  },
  {
    id: 'org-court',
    category: 'organisation',
    title: 'Une séance courte reste une séance',
    text: 'Les jours chargés, une séance raccourcie garde le rythme. C’est toujours mieux qu’une séance annulée.',
  },
  {
    id: 'nut-proteines',
    category: 'nutrition',
    title: 'Répartis les protéines sur la journée',
    text: 'Un apport réparti sur les repas est plus simple à tenir qu’une grosse quantité d’un coup.',
  },
  {
    id: 'nut-hydratation',
    category: 'nutrition',
    title: 'Bois régulièrement',
    text: 'L’hydratation influe directement sur les sensations à l’entraînement. Bois tout au long de la journée, pas seulement pendant la séance.',
  },
  {
    id: 'nut-base',
    category: 'nutrition',
    title: 'La base avant les compléments',
    text: 'Des repas complets et réguliers pèsent bien plus lourd dans les résultats que n’importe quel complément.',
  },
];

export function tipsFor(category: TipCategoryId): Tip[] {
  return TIPS.filter((t) => t.category === category);
}

/** Only the categories that actually carry a conseil. */
export function usedTipCategories() {
  return TIP_CATEGORIES.filter((c) => TIPS.some((t) => t.category === c.id));
}
