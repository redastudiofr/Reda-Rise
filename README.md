# Hustly

Application Next.js (App Router) mobile-first : habitudes, tâches, statistiques
et paramètres. Cette version est la base de design : les écrans suivent les
maquettes Aujourd'hui / Habitudes / Tâches / Statistiques / Paramètres, sans
emojis (icônes SVG uniquement).

## Démarrage

```bash
npm install
npm run dev        # développement
npm run typecheck  # vérification TypeScript
npm run build && npm start
```

## Structure

```
src/
  app/
    layout.tsx          Shell : fond, barre d'onglets
    globals.css         Design system (tokens en haut du fichier) + animations
    page.tsx            Aujourd'hui : calendrier, habitudes, tâches, FAB
    habitudes/page.tsx  Cartes d'habitude, compteur, série, menu ...
    taches/page.tsx     Stats, liste, état vide
    statistiques/page.tsx  Aperçu flouté + « Débloquer Pro »
    parametres/page.tsx Profil, carte Pro, réglages
  components/
    WeekCalendar.tsx    Semaine glissable (swipe), anneau par jour
    Ring.tsx            Anneau de progression animé
    TabBar.tsx          Barre d'onglets en verre, pastille animée
    Sheet.tsx / Menu.tsx / Toast.tsx / Forms.tsx / Check.tsx / Icon.tsx
  lib/
    store.ts            État habitudes + tâches (localStorage, useSyncExternalStore)
    dates.ts            Clés de jour YYYY-MM-DD, semaine lundi-dimanche
    hooks.ts            Jour courant (se met à jour à minuit)
```

## Design

Toutes les couleurs, rayons et courbes d'animation sont des variables CSS dans
`src/app/globals.css` (`:root`). Le thème sombre est le défaut ; ajouter
`data-theme="light"` sur `<html>` active le thème clair. Les animations
respectent `prefers-reduced-motion`.

## Données

Pour l'instant les données sont stockées dans le navigateur (`localStorage`,
clé `hustly.v2`). Aucun backend n'est branché : la version précédente de
l'application (Postgres, notifications push, etc.) est dans l'historique git.
