# Jarvis

Mon assistant vocal personnel. Il fonctionne comme un majordome britannique : il vouvoie, dit « Monsieur », fait des phrases courtes et un peu d'humour pince-sans-rire.

Au démarrage, il fait un débrief à voix haute, dans cet ordre :

1. mails importants des dernières 24 h, regroupés en ventes, clients, fournisseurs et le reste ;
2. ventes Shopify d'hier, par boutique ;
3. météo du jour ;
4. actualité d'hier ;
5. rendez-vous du jour.

Il demande ensuite ce que vous voulez accomplir. Il propose un planning dans vos créneaux libres et crée les événements dans Google Agenda après votre confirmation.

- **Stack :** Next.js 16 (App Router), TypeScript, Tailwind 4.
- **Voix :** Web Speech API, optimisée pour Edge et ses voix « Natural ».
- **Cerveau :** Gemini `gemini-3.8-flash`, niveau gratuit, via l'Interactions API avec appels d'outils.
- **Coût :** tout est gratuit.

## Sommaire

1. [Ce qu'il sait faire](#ce-quil-sait-faire)
2. [Google Cloud : Gmail et Agenda](#1-google-cloud--gmail-et-agenda)
3. [Clé Gemini](#2-clé-gemini)
4. [Shopify](#3-shopify)
5. [Base de données (gratuite)](#4-base-de-données-gratuite)
6. [Variables d'environnement](#5-variables-denvironnement)
7. [Lancer en local](#6-lancer-en-local)
8. [Déployer sur Vercel](#7-déployer-sur-vercel)
9. [Ouvrir Jarvis au démarrage du PC (Edge plein écran)](#8-ouvrir-jarvis-au-démarrage-du-pc-edge-plein-écran)
10. [Sécurité](#sécurité)
11. [Tests](#tests)

---

## Ce qu'il sait faire

| Vous dites | Jarvis |
| --- | --- |
| « Répète » | relit le bloc en cours ou sa dernière réponse |
| « Passe » / « Suivant » / « Stop » | coupe et passe au bloc suivant |
| « Détaille le point 2 » | développe ce sujet d'actualité (il lit l'article) |
| « Lis-moi le mail de Karim » | lit le dernier mail de Karim (30 derniers jours) |
| « Je dois faire du sport, la compta ce soir et appeler Karim à 17 h » | propose un planning dans vos créneaux libres et l'affiche |
| « Oui, je confirme » | crée les événements dans **Google Agenda uniquement** |
| « Non, annule » | abandonne le planning |

Autres fonctions :

- **Transcription en direct :** ce que vous dites et ce qu'il répond s'affiche à l'écran.
- **Mode texte :** une barre en bas sert de secours si le micro ne marche pas.
- **Reconnexion Google :** le bouton **Reconnecter Google** reste visible en haut. Il passe en orange clignotant quand l'autorisation a expiré ou expire dans moins de 24 h. En mode test, Google la révoque tous les 7 jours.
- **Pannes :** si un service ne répond pas, Jarvis le dit et continue avec les autres.
- **Planning :** il ne pose jamais de créneau sur vos cours ni sur un événement existant. Les cours par défaut sont lun/mar/jeu 8 h–18 h, mer 8 h–16 h, ven 8 h–15 h, en Europe/Paris. Le calcul est fait par le code, pas par l'IA, et revérifié juste avant la création des événements.
- **Réglages (`/reglages`) :**
  - ville ;
  - voix et vitesse de lecture ;
  - boutiques incluses ;
  - flux RSS ;
  - cours et plage horaire de la journée.

---

## 1. Google Cloud : Gmail et Agenda

1. Ouvrez [console.cloud.google.com](https://console.cloud.google.com), puis **Sélectionner un projet** → **Nouveau projet**, nommé par exemple « Jarvis ».
2. **API et services → Bibliothèque.** Activez **Gmail API** et **Google Calendar API**.
3. **Google Auth Platform** (anciennement « Écran de consentement OAuth ») → **Commencer** :
   - nom de l'appli : Jarvis ; e-mail d'assistance : le vôtre ;
   - **Audience : Externe** ;
   - coordonnées : votre e-mail, puis acceptez.
4. **Audience.** Laissez le statut **En test**. Dans **Utilisateurs test**, cliquez sur **+ Add users** et ajoutez **votre adresse Gmail**. Sans cette étape, Google refuse la connexion.
5. **Accès aux données → Ajouter ou supprimer des champs d'application.** Ajoutez ces deux scopes, et seulement eux :
   - `https://www.googleapis.com/auth/gmail.readonly` (lire les mails) ;
   - `https://www.googleapis.com/auth/calendar.events` (lire et créer des événements).
6. **Clients → Créer un client**, de type **Application Web**. Dans **URI de redirection autorisés**, ajoutez :
   - `http://localhost:3000/api/google/callback` ;
   - `https://VOTRE-APP.vercel.app/api/google/callback`, à ajouter après le déploiement.
7. Copiez l'**ID client** dans `GOOGLE_CLIENT_ID` et le **code secret** dans `GOOGLE_CLIENT_SECRET`.

Comme l'appli reste en mode test, Google vous montre un avertissement « Google n'a pas validé cette application ». C'est normal : cliquez **Continuer**.

L'autorisation expire au bout de **7 jours**. Cliquez alors sur **Reconnecter Google**.

---

## 2. Clé Gemini

1. Ouvrez [aistudio.google.com/apikey](https://aistudio.google.com/apikey), puis **Create API key**. Choisissez le projet « Jarvis » ou un nouveau.
2. Copiez la clé dans `GEMINI_API_KEY`.

Le niveau gratuit suffit pour un usage perso : un débrief consomme 2 à 3 requêtes, puis une par question.

> **Confidentialité :** au niveau gratuit, Google peut utiliser les contenus envoyés à Gemini pour améliorer ses produits ([conditions Gemini API](https://ai.google.dev/gemini-api/terms)). Jarvis lui envoie l'expéditeur, l'objet et l'extrait de vos mails du jour, ainsi que le contenu d'un mail quand vous demandez à l'entendre. Sans clé Gemini, Jarvis marche quand même, en mode dégradé :
> - les mails sont triés par mots-clés ;
> - l'actualité est donnée par ses titres ;
> - il n'y a pas de conversation libre.

---

## 3. Shopify

Pour chaque boutique, Jarvis a besoin du scope **`read_orders`** (lecture des commandes). Deux méthodes :

**A. Vous avez déjà une app personnalisée avec un jeton `shpat_…`**

Mettez ce jeton dans `SHOPIFY_SHOP_1_TOKEN`.

**B. Nouvelle app (Dev Dashboard).** C'est la méthode que Shopify met désormais en avant pour les apps d'une boutique qui vous appartient.

1. Ouvrez [dev.shopify.com](https://dev.shopify.com) → **Apps → Create app**, nommée « Jarvis ».
2. Dans **Versions**, donnez le scope `read_orders`, puis publiez la version.
3. **Installez** l'app sur votre boutique. La boutique doit apparaître dans la même organisation que l'app dans le Dev Dashboard, sinon Shopify répond `shop_not_permitted`.
4. Dans **Settings**, copiez le **Client ID** dans `SHOPIFY_SHOP_1_CLIENT_ID` et le **Client secret** dans `SHOPIFY_SHOP_1_CLIENT_SECRET`.

Jarvis obtient alors lui-même un jeton valable 24 h (*client credentials grant*).

Dans les deux cas, ajoutez aussi :

- `SHOPIFY_SHOP_1_DOMAIN`, par exemple `ma-boutique.myshopify.com` ;
- `SHOPIFY_SHOP_1_NAME`, le nom que Jarvis prononce.

Pour une deuxième boutique, utilisez `SHOPIFY_SHOP_2_…`, et ainsi de suite jusqu'à 10.

Le chiffre d'affaires d'hier est le total des commandes passées hier (Europe/Paris), après retours. Les commandes de test et annulées sont exclues.

---

## 4. Base de données (gratuite)

Sur Vercel, les fichiers ne sont pas conservés. Il faut donc une petite base pour garder deux choses : la connexion Google (chiffrée) et les réglages.

1. Dans Vercel : projet → **Storage → Create Database → Neon (Postgres)**, au plan gratuit.
2. Reliez-la au projet. `DATABASE_URL` est ajoutée automatiquement.

Jarvis crée seul sa table `jarvis_kv`. Vous pouvez aussi réutiliser la base Neon de Reda Rise : la table est séparée.

En local, sans `DATABASE_URL`, tout est stocké dans `jarvis/.data/store.json`, un fichier ignoré par git.

---

## 5. Variables d'environnement

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `JARVIS_PASSWORD` | oui | mot de passe du site |
| `SESSION_SECRET` | oui | au moins 32 caractères aléatoires (`openssl rand -base64 48`) : signe le cookie et chiffre le jeton Google |
| `GEMINI_API_KEY` | conseillé | cerveau de Jarvis |
| `GEMINI_MODEL` | non | `gemini-3.8-flash` par défaut |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | pour Gmail et l'Agenda | client OAuth (étape 1) |
| `GOOGLE_REDIRECT_URI` | non | à forcer seulement si l'adresse détectée est fausse |
| `SHOPIFY_SHOP_n_NAME`, `_DOMAIN`, `_TOKEN` ou `_CLIENT_ID` + `_CLIENT_SECRET` | pour Shopify | une série par boutique (étape 3) |
| `DATABASE_URL` | sur Vercel | Postgres Neon (étape 4) |

Si `JARVIS_PASSWORD` ou `SESSION_SECRET` manque, **rien ne s'ouvre**. Aucune clé n'est envoyée au navigateur. Les variables `*_URL` qui ne figurent pas ci-dessus (`GEMINI_API_URL`, `GMAIL_API_URL`…) servent uniquement aux tests automatiques : ne les définissez pas.

---

## 6. Lancer en local

```bash
cd jarvis
cp .env.example .env.local   # puis remplissez-le
npm install
npm run dev
```

Ouvrez **http://localhost:3000 dans Microsoft Edge**. Les voix « Natural » sont celles d'Edge, et la reconnaissance vocale y marche le mieux. Autorisez le micro quand Edge le demande, puis cliquez **Démarrer**. Les navigateurs refusent le son sans un clic.

Le micro ne fonctionne qu'en `http://localhost` ou en `https://`.

---

## 7. Déployer sur Vercel

Le code est dans le dossier `jarvis/` du dépôt Reda-Rise.

1. [vercel.com/new](https://vercel.com/new) → importez le dépôt **redastudiofr/Reda-Rise**.
2. **Root Directory → `jarvis`**. Le framework Next.js est détecté tout seul.
3. **Environment Variables :** ajoutez celles du tableau ci-dessus, en Production et en Preview.
4. **Deploy.** Ajoutez ensuite la base Neon (étape 4), puis redéployez.
5. Dans Google Cloud, ajoutez `https://VOTRE-APP.vercel.app/api/google/callback` aux URI de redirection (étape 1.6).
6. Ouvrez le site, connectez-vous, puis cliquez **Reconnecter Google** pour lier votre compte.

Le plan Hobby gratuit suffit : les fonctions ont une durée maximale de 60 s, et un débrief prend quelques secondes.

---

## 8. Ouvrir Jarvis au démarrage du PC (Edge plein écran)

Remplacez `https://VOTRE-APP.vercel.app` par votre adresse dans les commandes ci-dessous.

### Windows

**1. Installer Jarvis comme application.**

1. Ouvrez le site dans Edge et connectez-vous.
2. Menu **⋯ → Applications → Installer ce site en tant qu'application**, nommée « Jarvis ».
3. Autorisez le micro une fois. Edge s'en souviendra.

**2. Le lancer au démarrage, en plein écran.** Choisissez l'une des deux méthodes.

*Méthode simple :* ouvrez `edge://apps`, faites un clic droit sur Jarvis, puis **Démarrer automatiquement à la connexion de l'appareil**. Dans la fenêtre, **F11** passe en plein écran.

*Méthode plein écran direct (raccourci au démarrage) :*

1. Appuyez sur `Win + R`, tapez `shell:startup`, puis Entrée.
2. Faites un clic droit → **Nouveau → Raccourci**, avec comme emplacement :
   ```
   "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=https://VOTRE-APP.vercel.app --start-fullscreen
   ```
3. Nommez-le « Jarvis ».

Au prochain démarrage, Jarvis s'ouvre en plein écran (F11 pour en sortir). Vous restez connecté 30 jours grâce au cookie.

N'utilisez pas le mode `--kiosk` d'Edge : il ouvre une session InPrivate, donc il faudrait retaper le mot de passe et réautoriser le micro à chaque démarrage.

### Mac

**1. Installer Jarvis comme application.**

1. Ouvrez le site dans Edge et connectez-vous.
2. Menu **⋯ → Applications → Installer ce site en tant qu'application**.

L'app « Jarvis » apparaît dans `~/Applications/Edge Apps`.

**2. Le lancer au démarrage, en plein écran.** Choisissez l'une des deux méthodes.

*Méthode simple :* **Réglages Système → Général → Ouverture** (« Ouvrir à la connexion ») → **+** → choisissez `~/Applications/Edge Apps/Jarvis.app`. Dans la fenêtre, `Ctrl + Cmd + F` passe en plein écran.

*Méthode plein écran direct :*

1. Ouvrez **Automator → Nouveau document → Application**.
2. Ajoutez l'action **Exécuter un script Shell** avec :
   ```bash
   open -na "Microsoft Edge" --args --app=https://VOTRE-APP.vercel.app --start-fullscreen
   ```
3. Enregistrez sous `Jarvis.app` dans Applications.
4. Ajoutez cette app dans **Réglages Système → Général → Ouverture**.

La première fois, macOS demande l'autorisation d'utiliser le micro pour Edge : acceptez.

---

## Sécurité

- **Accès :** tout le site et toutes les API exigent le cookie de session. Il est signé (HMAC), `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS, et valable 30 jours.
- **Mot de passe :** il est comparé en temps constant. Les essais sont limités à 5 échecs par 15 min par adresse et 30 par heure au total.
- **Requêtes :** les appels qui modifient quelque chose (POST/PUT) refusent les requêtes venues d'un autre site.
- **Jeton Google :** il est conservé côté serveur et chiffré en AES-256-GCM avec une clé dérivée de `SESSION_SECRET`. Le navigateur ne voit jamais aucun jeton ni aucune clé.
- **Scopes Google minimaux :** lecture de Gmail, lecture et création d'événements. Jarvis ne peut ni envoyer, ni supprimer, ni modifier vos mails.
- **Flux RSS :** ils sont récupérés par le serveur, qui refuse les adresses locales et privées.

## Tests

```bash
npm test          # temps, RSS, planning, commandes vocales, et toutes les intégrations
npm run typecheck
```

Les intégrations (Gemini, Gmail, Agenda, Shopify, Open-Meteo) sont testées contre un faux serveur local (`tests/mock-server.mjs`) : aucune vraie clé n'est nécessaire.
