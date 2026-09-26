# Telos RS

Application Next.js (App Router) installable sur iPhone et Android, avec cache
hors-ligne complet et notifications push réelles (VAPID) qui s'affichent même
quand l'app est fermée. Tout tient dans un seul projet déployé sur Vercel :
front, routes API et planification des rappels.

## Ce que fait l'app

Six onglets, pensés pour le pouce sur mobile, dont le profil.

- **Aujourd'hui** — objectifs du jour personnalisables (heure, catégorie,
  validation, filtres), progression de la journée, niveau, jours d'affilée,
  checklist Discipline de 10 tâches valant 130 XP, bilan du jour, rappels à
  20 h et 22 h s'il reste des objectifs.
- **Progression** (`/progression`) — niveau, nom et palier (Bronze, Argent,
  Or, Platine, Diamant, Mythique), XP vers le niveau suivant, statistiques,
  XP gagnée jour par jour, courbe de progression et barème de l'XP. L'XP
  vient des objectifs, des tâches Discipline, des finances et de bonus
  (journée complète, journée bouclée, paliers de série). Elle est recalculée
  depuis les données enregistrées : rien ne peut dériver.
- **Calendrier** — agenda, tâches et projets réunis. Vues Jour, 3 jours,
  Semaine et Mois ; événements (rendez-vous, cours, réunions, événements,
  anniversaires) avec heure, durée, description, répétition et rappels
  multiples (5 min, 15 min, 30 min, 1 h, 1 jour ou personnalisé) ; tâches avec
  priorité, statut, catégorie et projet ; projets avec leur progression ; les
  objectifs du jour placés à leur heure. Création en touchant un créneau,
  glisser-déposer (appui long sur mobile), durée étirable, recherche, filtres.
- **Finances** (`/finances`) — finances personnelles, séparées du Business.
  Comptes tenus à la main (compte bancaire, épargne, espèces, autre) et
  patrimoine disponible ; revenus et dépenses par catégorie, évolution sur 6
  ou 12 mois ; abonnements avec prix, fréquence, date de prélèvement,
  catégorie, compte, totaux mensuel et annuel, et une analyse neutre
  (utilisation, prix, importance, alternative) qui suggère sans jamais
  décider ; objectifs d'épargne avec progression et pistes générales (pas un
  conseil financier personnalisé). Aucune connexion bancaire ici.
- **Banque & analyse** (`/finances/banque`) — connexion bancaire via
  Enable Banking (DSP2, banques européennes) ou import de relevé CSV ; soldes
  et opérations récupérés en lecture, classés automatiquement. Analyse :
  dépenses du mois et de la semaine, revenus, épargne, évolution mensuelle,
  catégories, principales dépenses, objectif d'épargne mensuel. Voir
  « Connexion bancaire » plus bas.
- **Business** (`/entrepreneuriat`) — réservé aux entreprises. Plusieurs
  entreprises, chacune avec son tableau de bord : CA, dépenses, bénéfice
  estimé, marge, trésorerie, évolution mensuelle (graphiques), objectifs (CA,
  bénéfice ou chiffre libre), étapes, projets et tâches (partagés avec le
  calendrier), opérations.
- **Network** (`/network`) — réseau d'entrepreneurs, avec des comptes membres
  séparés du mot de passe de l'app. Profils (pseudo, photo, entreprise,
  secteur, compétences, centres d'intérêt, grande ville ou région, description),
  recherche, carte de France approximative, événements (création, participation,
  participants, ajout au calendrier), messages privés et discussion de groupe
  par événement, notifications, blocage, signalement et modération. Voir
  « Network » plus bas.
- **Profil** — identité, récompenses et classement, mensurations.
- **Réglages** — profil, fuseau horaire, heures de tous les rappels, activation
  des notifications push sur l'appareil, notification de test.

## Démarrage local

```bash
npm install
npm run dev
```

L'app est ouverte par défaut : aucun mot de passe n'est demandé. Pour la
protéger, définir la variable d'environnement `APP_PASSWORD` — un écran de
connexion apparaît alors et la garde toute l'application. La retirer rouvre
l'accès.

## Variables d'environnement

Copier `.env.example` vers `.env.local` en local, et renseigner les mêmes clés
sur Vercel (Project → Settings → Environment Variables).

| Variable | Rôle |
| --- | --- |
| `APP_PASSWORD` | Mot de passe d’accès. **Non défini = app ouverte, sans login** |
| `AUTH_SECRET` | Secret HMAC signant le cookie de session |
| `CRON_SECRET` | Secret exigé par `/api/cron/notify` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Paire de clés Web Push |
| `VAPID_SUBJECT` | `mailto:` de contact exigé par le protocole VAPID |
| `POSTGRES_URL` | Chaîne de connexion Postgres (ajoutée automatiquement par l'intégration) |
| `NETWORK_INVITE_CODE` | Facultatif : code demandé à l'inscription au Network |

Toutes, sauf `APP_PASSWORD`, ont une valeur de repli codée dans le projet pour
qu'un premier déploiement fonctionne immédiatement. Ces valeurs par défaut sont
visibles dans le dépôt : remplace-les si l'app doit rester privée.

Valeurs générées pour ce projet, à coller dans **Environment Variables** sur
Vercel (une ligne = une variable) :

```
# APP_PASSWORD=  (laisser vide ou absent pour une app sans mot de passe)
AUTH_SECRET=aTNau--fShcJ1whzRdM_IUJpZPQvTvUojY6nxhkATlk
CRON_SECRET=vejhEjq1NCHLlcS1NOVTATLH
VAPID_PUBLIC_KEY=BCXIXGZJ9R2h0-ici0R5MkNYi729igaLVqKWaZoWXiK6I4TR8gUpw3J8MdFfxD05-XHx22MbUJZdWyUNesMWvik
VAPID_PRIVATE_KEY=exgvMVSdv8nSnnsDI5HL-3QOdUL5K9j-Ei-NFXArd8A
VAPID_SUBJECT=mailto:obsyde.fr@gmail.com
```

Laisse `APP_PASSWORD` non défini pour garder l'app ouverte, ou donne-lui une
valeur pour réactiver l'écran de connexion.

### Générer des clés VAPID

```bash
npm run vapid
```

La commande affiche `VAPID_PUBLIC_KEY=…` et `VAPID_PRIVATE_KEY=…` à recopier
dans les variables d'environnement Vercel. Après changement de clés, il faut
réactiver les notifications sur chaque appareil (les anciens abonnements ne sont
plus valides).

## Connecter le stockage

Sans base de données, l'app tourne sur un stockage serveur temporaire : elle
fonctionne, mais les données ne survivent pas au recyclage de l'instance. Un
bandeau le signale sur l'écran Aujourd'hui.

Pour rendre le stockage durable :

1. Tableau de bord Vercel → le projet → onglet **Storage** → **Create Database**.
2. Choisir **Postgres** (Neon dans le Marketplace Vercel — free tier suffisant).
3. **Connect** vers le projet. Vercel injecte `POSTGRES_URL` / `DATABASE_URL`
   dans les variables d'environnement.
4. Redéployer. Les tables (`app_state`, `push_subs`, `notif_log`) sont créées
   automatiquement au premier appel.

Le client garde en plus une copie locale dans `localStorage` : l'app reste
utilisable hors-ligne et se resynchronise dès le retour du réseau.

## Déploiement

### Via GitHub et le tableau de bord Vercel

Le dossier est déjà un dépôt Git avec un premier commit. Il reste à le pousser
et à l'importer :

1. Créer un dépôt **vide** sur [github.com/new](https://github.com/new) —
   par exemple `muscu-app`, sans README ni .gitignore (ils existent déjà).
2. Depuis le dossier du projet :

   ```bash
   git remote add origin https://github.com/TON-PSEUDO/muscu-app.git
   git push -u origin main
   ```

   Git ouvre une fenêtre d'authentification GitHub au premier push.
3. Sur [vercel.com/new](https://vercel.com/new), **Import Git Repository**,
   choisir le dépôt. Vercel détecte Next.js tout seul : ne rien changer aux
   réglages de build.
4. Avant de cliquer **Deploy**, ouvrir **Environment Variables** et coller les
   valeurs du tableau ci-dessous.
5. **Deploy**. L'URL `https://muscu-app-xxxx.vercel.app` apparaît en une minute.

### Via la ligne de commande

```bash
npm i -g vercel
vercel deploy --prod
```

## Planification des rappels

`/api/cron/notify` lit les heures configurées dans les réglages, calcule les
rappels dus dans le fuseau horaire choisi, et envoie les push correspondants.
Chaque rappel porte une clé de déduplication (`creatine:2026-08-22`, …) : il ne
part qu'une seule fois par créneau, même si la route est appelée plusieurs fois.

Il faut donc appeler cette route toutes les 10 à 15 minutes.

**Le plan Hobby de Vercel limite les cron jobs à un déclenchement par jour** —
largement insuffisant pour des rappels à l'heure près. `vercel.json` déclare
donc un cron quotidien (compatible Hobby, il sert de filet de sécurité), et la
cadence réelle vient d'un planificateur externe gratuit :

1. Créer un compte sur [cron-job.org](https://cron-job.org) (gratuit).
2. Nouveau cron job, URL :

   ```
   https://TON-APP.vercel.app/api/cron/notify?secret=vejhEjq1NCHLlcS1NOVTATLH
   ```

3. Intervalle : toutes les 15 minutes. Enregistrer.

GitHub Actions ou Uptime Robot font la même chose si tu préfères.

En passant au plan Pro, remplace le `schedule` de `vercel.json` par
`*/15 * * * *` et le planificateur externe devient inutile.

La route accepte le secret en `Authorization: Bearer …`, en paramètre `?secret=`,
ou l'en-tête `x-vercel-cron` que Vercel ajoute lui-même. Une fenêtre de rattrapage
de 75 minutes absorbe l'imprécision du planificateur : un rappel prévu à 9 h 00
part encore s'il est déclenché à 9 h 40, mais jamais deux fois.

Rappels gérés : créatine (heure fixe), hydratation (toutes les N heures entre
deux bornes), 3 repas, sommeil, objectifs, rappels du soir (20 h et 22 h s'il
reste des objectifs), bilan du jour, et les rappels de chaque événement ou
tâche du calendrier.
Toutes les heures se règlent dans l'écran Réglages.

## Installer sur l'écran d'accueil

### iPhone (iOS 16.4 minimum pour les notifications)

1. Ouvrir l'URL Vercel **dans Safari** (pas Chrome ni un navigateur intégré).
2. Se connecter avec le mot de passe.
3. Bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
4. Fermer Safari et **rouvrir l'app depuis l'icône** de l'écran d'accueil.
5. Aller dans **Réglages** → activer l'interrupteur **Cet appareil** → accepter
   la demande de permission → **Envoyer une notification de test**.

iOS n'autorise les notifications push que depuis une app installée sur l'écran
d'accueil : l'étape 4 est obligatoire, sinon le bouton d'activation échoue.

### Android

Chrome propose « Installer l'application » dans le menu, ou via la bannière
d'installation. Les notifications fonctionnent aussi hors installation, mais
l'installation donne l'icône et le mode plein écran.

## Structure

```
src/
  app/
    page.tsx               Aujourd'hui (objectifs, checklist, XP, niveau, bilan)
    progression/           Niveau, statistiques, courbe et paliers
    quetes/                Toutes les quêtes et objectifs
    calendrier/            Agenda : vues, tâches, projets
    finances/              Comptes, dépenses, abonnements, épargne
    entrepreneuriat/       Entreprises et tableau de bord par entreprise
    network/               Découvrir, carte, événements, messages, profil, modération
    finances/investir/     Portefeuille d'investissement
    profil/                Profil, mensurations ; recompenses/ et classement
    reglages/              Profil, rappels, activation push
    login/                 Écran de connexion
    api/
      auth/login|logout    Cookie de session signé
      data                 Lecture / écriture de l'état complet
      push/key             Clé publique VAPID
      push/subscribe       Enregistrement et suppression d'abonnement
      push/test            Notification de test
      cron/notify          Envoi des rappels dus
      bank, market         Connecteurs optionnels (agrégateur bancaire, cotations)
      leaderboard          Classement partagé
      network/             Comptes membres, profils, carte, événements, messages,
                           blocages, signalements, modération, notifications
  lib/
    program.ts             Données par défaut, migration, planning de la semaine
    logic.ts               Dates, checklist Discipline
    xp.ts                  XP par jour, bonus, niveaux et noms, séries, statistiques
    agenda.ts              Répétitions, fusion du jour, rappels, recherche, projets
    finance.ts             Comptes, soldes, abonnements, analyse, épargne
    schedule.ts            Calcul des rappels dus
    push.ts                Envoi web-push (VAPID)
    db.ts                  Postgres, avec repli en mémoire
    auth.ts                Cookie HMAC (Web Crypto, compatible middleware)
    network/               Network : stockage, sessions membres, validation,
                           villes et régions, contour de la France, .ics
  middleware.ts            Protection des routes du propriétaire
public/
  manifest.webmanifest     Manifeste PWA
  sw.js                    Service worker : cache hors-ligne + push
  icons/                   Icônes 192, 512, maskable, apple-touch
```

## Connexion bancaire

- L'utilisateur s'identifie sur le site de sa banque ; l'app ne reçoit qu'un
  code, échangé côté serveur contre une session de lecture (90 jours).
- La session et les identifiants de comptes du fournisseur restent sur le
  serveur, chiffrés (AES-256-GCM) dans la table `bank_links`. Le navigateur ne
  reçoit que le nom de la banque, les 4 derniers caractères de l'IBAN, les
  soldes et les opérations.
- Le retour de la banque est vérifié par un `state` aléatoire lié à un cookie
  httpOnly scellé, à usage unique, valable 15 minutes.
- Refus de se connecter tant que l'app n'est pas protégée (`APP_PASSWORD`) et
  qu'`AUTH_SECRET` n'est pas un secret propre. Réponses `no-store`.
- Déconnexion : l'autorisation est retirée chez le fournisseur et le lien
  supprimé ; l'historique peut être gardé ou effacé.

## Network

Le Network est la seule partie de l'app ouverte à d'autres personnes.

- **Activation** : il reste désactivé tant que ces trois points ne sont pas
  réglés — `APP_PASSWORD` défini (sinon les membres verraient tes données
  personnelles), `AUTH_SECRET` d'au moins 32 caractères aléatoires, et une base
  Postgres (`POSTGRES_URL`) : profils, événements et messages sont partagés, une
  copie en mémoire par instance serveur les perdrait. La page `/network` liste
  ce qui manque.
- **Comptes membres** : email + mot de passe (10 caractères minimum, haché avec
  scrypt), session aléatoire dans un cookie httpOnly dont seule l'empreinte
  SHA-256 est stockée. Le propriétaire crée son propre compte membre ; son mot
  de passe d'app ne sert qu'à la modération (`/network/moderation`). Un membre
  n'a accès à aucune route du propriétaire (`/api/data`, banque…).
- **Vie privée** : l'email n'est jamais montré. Le lieu est une grande ville
  choisie dans une liste (ou seulement la région) ; les adresses, codes postaux
  et coordonnées sont refusés dans les profils et les événements. La carte ne
  place une ville qu'à partir de 3 membres, sinon ils sont comptés dans la
  région. Profil masquable, messages privés désactivables, suppression du compte
  et de toutes ses données.
- **Événements** : lieu approximatif ; l'adresse se donne dans la discussion
  réservée aux participants. Fichier `.ics` pour tout calendrier ; le
  propriétaire peut aussi ajouter l'événement à son calendrier de l'app.
- **Messages** : conversations privées et groupe par événement, mis à jour
  toutes les 4 s quand la page est ouverte, compteur de non-lus, notifications
  push sans le contenu du message.
- **Protection** : blocage (réciproque et silencieux), signalement d'un profil,
  d'un message ou d'un événement, modération (classer, supprimer le contenu,
  suspendre le compte). Limites : 5 inscriptions par heure et par connexion,
  8 tentatives de connexion par email en 15 min, 20 messages par minute et 500
  par jour, messages identiques refusés, 3 nouvelles conversations par jour
  pendant les premières 24 h puis 15, 5 événements par jour. Les écritures
  doivent venir du site lui-même (contrôle d'origine).
- **Non inclus** : pas de vérification de l'adresse email (il faudrait un
  service d'envoi d'emails, par ex. Resend ou Postmark) ni de réinitialisation
  du mot de passe par email ; le code d'invitation (`NETWORK_INVITE_CODE`)
  permet de limiter qui s'inscrit. Carte : contour Natural Earth (domaine
  public) régénéré avec `node scripts/build-france-outline.mjs`.

## Notes

- Le service worker met en cache les pages visitées (network-first) et les
  assets statiques (cache-first). Les appels `/api/*` passent toujours par le
  réseau : c'est le `localStorage` du client qui assure le mode hors-ligne.
- Les données sont stockées comme un seul document JSON (`app_state`), ce qui
  suffit largement pour un utilisateur unique et simplifie la synchronisation.

## Ce qui demande une configuration externe

Deux fonctionnalités dépendent d'un service tiers. Tant qu'il n'est pas
configuré, l'application le dit clairement à l'écran et ne fabrique **aucune**
donnée de remplacement.

### Connexion bancaire

`Finances → Banque & analyse`

Se connecter à une banque impose de passer par un agrégateur agréé DSP2
(Powens, Bridge, GoCardless, Tink, Plaid). L'utilisateur s'authentifie sur le
site de sa banque ; l'application ne voit jamais ses identifiants et ne stocke
que les jetons opaques rendus par l'agrégateur.

L'architecture est en place :

```
src/lib/bank.ts             Catégorisation, périodes, agrégats (client)
src/lib/bankServer.ts       Lecture des variables d'env, choix du fournisseur
src/app/api/bank/status     Indique si un agrégateur est configuré
src/app/api/bank/connect    Ouvrira le parcours de connexion — 501 sinon
src/app/api/bank/sync       Rafraîchira soldes et opérations — 501 sinon
```

Pour l'activer : renseigner les variables d'un fournisseur dans `.env`, puis
écrire le connecteur dans `connect/route.ts` et `sync/route.ts`.

**En attendant**, la section accepte l'export CSV que propose chaque banque
(`src/lib/bankImport.ts`) : dates, libellés et montants réels, avec le même
classement automatique par catégorie.

### Cotations de marché

`Finances → Investissements`

Sans fournisseur de cotations, la valeur actuelle de chaque position est celle
que l'utilisateur saisit lui-même, et une position sans valeur saisie est
comptée à son prix d'achat — la plus-value affichée est alors nulle, jamais
estimée. Voir `src/lib/market.ts` et `src/app/api/market/quote`.

## Classement

L'application est prévue pour **un compte par installation** : `app_state` ne
contient qu'une ligne et l'authentification est un mot de passe unique. Le
classement (`table leaderboard`) se remplit donc lorsque plusieurs personnes
pointent leur application vers la même base de données. Rien n'est publié tant
que l'utilisateur ne l'a pas activé, et seuls le pseudo, l'XP, le niveau et la
série sont partagés.
