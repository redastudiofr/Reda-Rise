# Refonte de Reda Rise : prompts prêts à copier

Ce fichier contient deux prompts :

1. **Prompt 1, pour Claude Design** : il crée les écrans et le style.
2. **Prompt 2, pour Claude Code** : il construit l'application en reprenant ce design.

Fais d'abord le design. Ensuite, colle le prompt 2 dans Claude Code et joins-lui l'export de Claude Design (lien ou fichiers).

Les passages entre [crochets] sont à adapter ou à supprimer.

---

## Prompt 1 : Claude Design

```
Crée le design complet d'une application web mobile-first (PWA installable sur iPhone et Android, utilisable aussi sur ordinateur) nommée « Reda Rise », de la marque REDA STUDIO. C'est une app de discipline personnelle et de pilotage de vie d'entrepreneur, gamifiée (XP, niveaux, récompenses).

Identité visuelle :
- Fond très sombre, noir chaud légèrement teinté de rouge (pas un noir bleuté), qui s'accorde avec la couleur secondaire.
- Couleur secondaire : rouge bordeaux un peu clair. Tons de rouge pour les accents, les boutons principaux et les graphiques.
- Style premium, sobre, très lisible, coins arrondis, ombres douces, chiffres en police à chasse fixe pour les montants.
- Logo : le « R » de REDA STUDIO [joindre les logos].
- Une seule exception de style : l'écran « Jarvis » est un HUD façon Iron Man (fond quasi noir, accents cyan, police tech, cercle animé). Il doit rester cohérent avec la marque.

Navigation : barre d'onglets en bas sur mobile (Aujourd'hui, Calendrier, Finances, Business, Vêtements, Profil), barre latérale sur ordinateur. Un bouton « Jarvis » toujours accessible en haut de l'accueil.

Écrans à concevoir (avec états vides, chargement, erreur) :
1. Connexion (mot de passe), écran de démarrage, écran hors-ligne.
2. Aujourd'hui : salutation et date, anneau de progression du jour, série de jours, XP du jour, niveau, liste des objectifs du jour (catégorie, heure, difficulté, preuve photo), checklist Discipline, bilan du jour, carte « rappels du soir ».
3. Animation de montée de niveau et petites bulles « +XP ».
4. Progression : niveau, palier (Bronze, Argent, Or, Platine, Diamant, Mythique), barre vers le niveau suivant, courbe d'XP, XP jour par jour, barème.
5. Quêtes : tous les objectifs, filtres, création et édition (feuille qui monte du bas).
6. Calendrier : vues Jour, 3 jours, Semaine, Mois ; événements, tâches, projets ; création en touchant un créneau ; glisser-déposer.
7. Finances : patrimoine total, comptes, revenus et dépenses du mois, graphique sur 6 ou 12 mois, catégories, abonnements (avec analyse), objectifs d'épargne, investissements.
8. Banque et analyse : banques connectées (statut, bouton Reconnecter), comptes, opérations, KPI (dépenses, revenus, vers l'épargne), virements internes signalés, import CSV.
9. Business : plusieurs entreprises, tableau de bord (CA, dépenses, bénéfice, marge, trésorerie), graphiques, objectifs, étapes, projets.
10. Vêtements : catalogue des pièces REDA STUDIO avec l'XP de chacune, pièces exclusives verrouillées par niveau, commandes.
11. Profil : avatar avec cadre, titre, récompenses, débloquables (thèmes de couleur, cadres, titres), mensurations.
12. Réglages : profil, fuseau horaire, rappels, notifications.
13. Jarvis (HUD) : cercle animé central qui réagit à la voix ; panneau « Débrief » (Courrier, Ventes, Météo, Actualité, Agenda) ; transcription en direct ; carte « Planning proposé » avec Confirmer et Annuler ; champ texte de secours ; bouton « Reconnecter Google » bien visible ; écran de démarrage animé ; page Réglages de Jarvis.

Livrables : maquettes mobile (390 px) et ordinateur (1440 px), composants réutilisables (boutons, cartes, feuilles, champs, puces, graphiques), palette de couleurs en variables, typographies, et les 8 thèmes de couleur débloquables (Bordeaux par défaut, Rubis, Grenat, Cuivre, Or, Néon rouge, Platine, Mythique).
```

---

## Prompt 2 : Claude Code

```
Tu vas reconstruire de zéro mon application « Reda Rise » (marque REDA STUDIO). Je fournis le design fait avec Claude Design [lien ou fichiers joints] : respecte-le fidèlement (couleurs, typographies, composants, espacements). Ne réinvente pas le style. S'il manque un écran, déduis-le des composants existants.

Réponds-moi toujours en français. Avance par étapes (voir « Plan de travail »). À la fin de chaque étape, dis-moi ce qui est fait, comment le tester, et ce qui reste. Teste chaque intégration avant de passer à la suivante. Demande-moi une clé seulement quand tu en as besoin, et ne me demande jamais de la coller dans le chat : dis-moi dans quelle variable d'environnement la mettre.

## 1. Pile technique et hébergement

- Next.js (dernière version stable, App Router) + TypeScript strict + Tailwind (avec le thème issu du design).
- PWA installable : manifest, icônes, service worker (pages en cache réseau d'abord, API toujours en réseau), notifications push (web-push, clés VAPID).
- Base : Postgres (Neon, offre gratuite) via Vercel. Pas de stockage de fichiers local en production.
- Hébergement : Vercel. Je ne passe PAS par GitHub pour publier : le déploiement se fait directement sur Vercel (CLI `vercel --prod` ou intégration Vercel). Le code doit pouvoir être déployé ainsi.
- Tout en Europe/Paris (dates, « hier », planning, rappels), changement d'heure compris.
- Tous les montants en centimes entiers, en base comme dans les calculs. Jamais de float pour l'argent.

## 2. Sécurité (non négociable)

- [Choisis une option et supprime l'autre.]
  - [Option A : mono-utilisateur. L'app entière est protégée par un mot de passe (APP_PASSWORD) et un cookie de session signé HMAC (AUTH_SECRET, au moins 32 caractères, sans valeur par défaut dans le code).]
  - [Option B : multi-utilisateurs, pour pouvoir vendre l'app plus tard. Comptes (e-mail et mot de passe haché argon2/bcrypt, ou lien magique), toutes les données isolées par utilisateur, abonnement Stripe prévu mais désactivé au début.]
- Connexion : limite d'essais (5 par 15 min par IP, 30 par heure au total), comparaison en temps constant, cookie HttpOnly + Secure + SameSite=Lax.
- Fail closed : si une variable de sécurité manque, les routes sensibles refusent tout. Exemples : CRON_SECRET absent, donc les tâches planifiées refusent tout appel ; mot de passe ou secret absent, donc banque et Jarvis verrouillés.
- Aucune clé ni aucun jeton côté navigateur. Jetons tiers (Google, banque) chiffrés AES-256-GCM en base.
- Les POST/PUT refusent les requêtes d'une autre origine. Réponses sensibles en `Cache-Control: no-store`.
- Les URL fournies par l'utilisateur (flux RSS…) sont lues par le serveur : refuser localhost et les IP privées.
- Ne jamais demander ni stocker de mot de passe bancaire. Ne jamais donner de conseil financier personnalisé.

Noms de variables d'environnement à utiliser exactement : APP_PASSWORD, AUTH_SECRET, CRON_SECRET, DATABASE_URL, ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY (contenu du .pem dans la variable, avec gestion des \n échappés), GEMINI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SHOPIFY_SHOP_n_NAME / _DOMAIN / _TOKEN ou _CLIENT_ID + _CLIENT_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY. Fournis un `.env.example` commenté.

## 3. Fonctionnalités

### Gamification (cœur de l'app)
- XP gagnée par : objectifs du jour (selon difficulté), tâches Discipline, actions de finances, bonus (journée complète, journée bouclée, paliers de série), vêtements achetés.
- L'XP est toujours recalculée à partir des données enregistrées : elle ne peut pas dériver. Modifier une liste ne change jamais l'XP des jours passés.
- Niveaux avec nom et palier (Bronze, Argent, Or, Platine, Diamant, Mythique), série de jours, animation de montée de niveau, bulles « +XP ».
- Débloquables par niveau : 8 thèmes de couleur appliqués à toute l'app, cadres de photo de profil, titres, pièces exclusives. Annoncés à la montée de niveau.

### Aujourd'hui (accueil)
- Objectifs du jour personnalisables : titre, heure, catégorie, difficulté, récurrence (une fois, chaque jour, jours de semaine), preuve photo optionnelle, filtres.
- Anneau de progression, série, XP du jour, niveau.
- Checklist Discipline personnalisable : 1 à 15 tâches, XP de 1 à 20 chacune.
- Bilan du jour.
- Rappels push à 20 h et 22 h s'il reste des objectifs (heures réglables).
- Bouton Jarvis en haut.

### Progression et quêtes
- Page Progression : niveau, palier, XP vers le niveau suivant, statistiques, XP jour par jour, courbe, barème.
- Page Quêtes : tous les objectifs, création et édition.

### Calendrier
- Vues Jour, 3 jours, Semaine, Mois.
- Événements (rendez-vous, cours, réunion, événement, anniversaire) avec heure, durée, description, répétition (aucune, quotidienne, jours de semaine, hebdo, mensuelle, annuelle) et rappels multiples (5 min, 15 min, 30 min, 1 h, 1 jour, personnalisé) envoyés en push.
- Tâches : priorité, statut, catégorie, projet. Projets avec progression.
- Les objectifs du jour apparaissent à leur heure.
- Création en touchant un créneau, glisser-déposer (appui long sur mobile), durée étirable, recherche, filtres.

### Finances personnelles
- Comptes tenus à la main (courant, épargne, espèces, autre). Patrimoine total = comptes manuels + soldes bancaires (sans double comptage), avec lien vers l'analyse bancaire.
- Revenus et dépenses par catégorie, évolution sur 6 ou 12 mois, saisie rapide d'un montant.
- Abonnements : prix, fréquence, date de prélèvement, catégorie, compte, totaux mensuel et annuel. Analyse neutre (utilisation, prix, importance, alternative) qui suggère sans jamais décider.
- Objectifs d'épargne avec progression.
- Investissements (actions, ETF, crypto, immobilier, obligations) en suivi manuel ; cotations en option.

### Banque et analyse
- Connexion bancaire via Enable Banking (DSP2) :
  - sandbox pour tester, production ensuite ;
  - JWT RS256 signé avec la clé privée ;
  - state aléatoire lié à un cookie HttpOnly scellé, à usage unique ;
  - session de lecture de 90 jours ;
  - session et identifiants de comptes chiffrés côté serveur, jamais envoyés au navigateur.
- Import de relevé CSV en secours.
- Synchronisation : bouton manuel avec délai minimal, plus une tâche planifiée quotidienne (/api/cron/bank-sync, protégée par CRON_SECRET en Bearer). La synchro serveur ne peut pas être écrasée par une copie plus ancienne venue du navigateur.
- Identifiant stable par opération : référence de la banque, sinon empreinte date + montant + libellé, avec un rang pour les opérations identiques le même jour. Jamais de doublon.
- Virements internes détectés par la vraie règle : même montant, signes opposés, entre deux de mes comptes, au plus 3 jours d'écart, appariés un à un. Ils sortent des dépenses et revenus ; vers un compte épargne, ils comptent dans « Vers l'épargne ».
- Bouton « Reconnecter » quand le consentement expire : mêmes comptes, même historique, aucun doublon. Comptes retrouvés par une empreinte stable (hash de l'IBAN ou identifiant fourni par la banque).
- Déconnexion : consentement retiré chez le fournisseur, historique gardé ou effacé au choix.
- Analyse : dépenses du mois et de la semaine, revenus, épargne, évolution mensuelle, catégories, principales dépenses, objectif d'épargne mensuel.

### Business
- Plusieurs entreprises, chacune avec son tableau de bord : CA, dépenses, bénéfice estimé, marge, trésorerie, graphiques mensuels.
- Objectifs (CA, bénéfice ou chiffre libre), étapes du projet (idée → expansion), projets et tâches partagés avec le calendrier, opérations.

### Vêtements (REDA STUDIO)
- Uniquement les pièces de redastudio.fr. Tout autre site est refusé.
- « Importer la collection » lit le catalogue public de la boutique (Shopify /products.json).
- Chaque pièce rapporte son XP (1 à 200) une seule fois, à la première commande confirmée. Pièces exclusives réservées à partir d'un niveau.

### Profil et réglages
- Profil : identité, avatar avec cadre, titre, récompenses, classement, mensurations.
- Réglages : fuseau horaire, heures des rappels, activation des push sur l'appareil, notification de test.

### Jarvis : assistant vocal (page /jarvis, plein écran HUD)
- Voix : Web Speech API. Reconnaissance fr-FR continue avec transcription en direct. Synthèse optimisée pour Edge (voix « Natural » en premier), sélecteur de voix et vitesse, choix sauvegardé. Texte découpé en phrases. Les commandes sont ignorées quand le micro n'entend que l'écho de Jarvis.
- Cerveau : Gemini, dernier modèle Flash du niveau gratuit (vérifie le nom actuel dans la doc officielle), avec appels d'outils (function calling). Gère les signatures de pensée si l'API l'exige. Mode dégradé sans clé.
- Persona : majordome britannique, en français, vouvoie, m'appelle « Monsieur », phrases courtes, humour pince-sans-rire. Rien de markdown dans les réponses lues à voix haute. Jamais de donnée inventée.
- Bouton « Démarrer » (obligatoire pour l'audio du navigateur), puis débrief vocal dans cet ordre :
  1. mails importants des dernières 24 h (Gmail en lecture seule), résumés et regroupés : ventes, clients, fournisseurs, reste ;
  2. ventes Shopify d'hier par boutique : CA, nombre de commandes, top produits ; commandes test et annulées exclues ; plusieurs boutiques ;
  3. météo du jour (Open-Meteo, sans clé, ville en réglage) ;
  4. actualité d'hier : flux RSS (Le Monde, franceinfo, Les Echos + un flux e-commerce ou tech ; vérifie les URL actuelles), articles d'hier uniquement, dédoublonnés, 3 à 5 points d'une phrase, moins d'une minute à l'oral ;
  5. rendez-vous du jour (Google Agenda).
- Ensuite : « Que souhaitez-vous accomplir aujourd'hui, Monsieur ? ». J'énumère mes tâches à l'oral. Il propose un planning dans mes créneaux libres, l'affiche, demande confirmation, puis crée les événements dans Google Agenda uniquement.
- Le planning est calculé par le code, pas par l'IA. L'IA ne fait que transformer ma demande en tâches et durées. Il n'est jamais placé sur un événement existant ni sur mes cours (lun/mar/jeu 8 h–18 h, mer 8 h–16 h, ven 8 h–15 h, modifiables), avec une pause entre les tâches. Chaque créneau est revérifié juste avant la création.
- Commandes vocales : « Répète », « Passe », « Détaille le point X » (lit l'article), « Lis-moi le mail de [nom] », « Je confirme » / « Annule ».
- Mode texte en secours si le micro ne marche pas.
- Bouton « Reconnecter Google » bien visible : le jeton expire tous les 7 jours en mode test, le bouton devient orange avant l'expiration.
- Si un service ne répond pas, il le dit et continue avec les autres.
- Réglages Jarvis : ville, voix, vitesse, boutiques incluses, liste des flux RSS, cours, plage de la journée.
- Google OAuth 2 : scopes minimum `gmail.readonly` et `calendar.events`, refresh token chiffré côté serveur.
- Shopify : Admin GraphQL API (dernière version stable), jeton `shpat_` ou app Dev Dashboard (client credentials), scope `read_orders`.
- Démarrage automatique : `/jarvis?boot=1` joue une animation de démarrage et un son synthétisé (WebAudio), puis lance le débrief sans clic si le navigateur l'autorise ; sinon, un seul bouton « Activer Jarvis ». Fournis aussi :
  - un script macOS (LaunchAgent) qui, à l'ouverture de session, attend le réseau et ouvre Edge en plein écran sur cette adresse, dans un profil séparé, avec `--autoplay-policy=no-user-gesture-required` ;
  - un script de désinstallation ;
  - la marche à suivre pour Windows.

### Ce que j'ajoute
[Écris ici les nouvelles fonctionnalités que tu veux.]

## 4. Qualité

- Code lisible et découpé : une logique métier pure et testable (XP, planning, centimes, virements, fuseau, dédoublonnage) séparée de l'interface.
- Tests unitaires de toute la logique métier. Tests d'intégration contre un faux serveur local qui imite Gemini, Google, Shopify, Enable Banking et Open-Meteo (pour tester sans vraie clé). Tests de bout en bout (Playwright) des parcours principaux, à 390 px et 1440 px, sans débordement horizontal.
- Accessibilité : contrastes suffisants, libellés, navigation au clavier, `prefers-reduced-motion` respecté.
- Mode hors-ligne : l'app s'ouvre et affiche les dernières données, les modifications se synchronisent au retour du réseau.
- README en français : installation, chaque variable d'environnement, création du projet Google Cloud (APIs, écran de consentement en mode test, utilisateur test, URI de redirection), clé Gemini, Shopify, Enable Banking (sandbox puis production), déploiement direct sur Vercel, tâches planifiées.

## 5. Plan de travail (une étape à la fois, testée avant la suivante)

1. Socle : projet, design system importé de Claude Design, navigation, connexion sécurisée, base de données, PWA.
2. Aujourd'hui + gamification (XP, niveaux, Discipline, montée de niveau).
3. Progression, Quêtes, Profil, Débloquables, Réglages, notifications push.
4. Calendrier complet.
5. Finances personnelles.
6. Banque (Enable Banking sandbox d'abord) et analyse.
7. Business.
8. Vêtements REDA STUDIO.
9. Jarvis : voix et HUD, puis météo, RSS, Gemini, Google, Shopify, planning, démarrage automatique Mac.
10. README, vérification de sécurité finale, déploiement sur Vercel.
```
