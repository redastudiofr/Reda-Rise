# Jarvis

Mon assistant vocal personnel, intégré à Reda Rise : page **/jarvis**, ou bouton **Jarvis** sur l'accueil. Il fonctionne comme un majordome britannique : il vouvoie, dit « Monsieur », fait des phrases courtes et un peu d'humour pince-sans-rire.

Au démarrage, il fait un débrief à voix haute, dans cet ordre :

1. mails importants des dernières 24 h, regroupés en ventes, clients, fournisseurs et le reste ;
2. ventes Shopify d'hier, par boutique ;
3. météo du jour ;
4. actualité d'hier ;
5. rendez-vous du jour.

Il demande ensuite ce que vous voulez accomplir. Il propose un planning dans vos créneaux libres et crée les événements dans Google Agenda après votre confirmation.

- **Stack :** dans Reda Rise (Next.js, TypeScript), avec Tailwind limité aux pages Jarvis.
- **Voix :** Web Speech API, optimisée pour Edge et ses voix « Natural ».
- **Cerveau :** Gemini `gemini-3.8-flash`, niveau gratuit, via l'Interactions API avec appels d'outils.
- **Coût :** tout est gratuit.

## Sommaire

1. [Ce qu'il sait faire](#ce-quil-sait-faire)
2. [Google Cloud : Gmail et Agenda](#1-google-cloud--gmail-et-agenda)
3. [Clé Gemini](#2-clé-gemini)
4. [Shopify](#3-shopify)
5. [Base de données](#4-base-de-données)
6. [Variables d'environnement](#5-variables-denvironnement)
7. [Lancer en local](#6-lancer-en-local)
8. [Mise en ligne](#7-mise-en-ligne)
9. [Ouverture automatique au démarrage du Mac](#8-ouverture-automatique-au-démarrage-du-mac)
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
   - `http://localhost:3000/api/jarvis/google/callback` ;
   - `https://muscu-tracker-phi.vercel.app/api/jarvis/google/callback`, à ajouter après le déploiement.
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

## 4. Base de données

Jarvis utilise la même base Postgres (Neon) que Reda Rise. Il y crée seul sa table `jarvis_kv`, qui contient la connexion Google (chiffrée) et les réglages de Jarvis. Rien à faire si Reda Rise a déjà sa base sur Vercel.

En local, sans base, tout est stocké dans `.data/store.json`, un fichier ignoré par git.

---

## 5. Variables d'environnement

À ajouter dans le projet Vercel **muscu-tracker**, en Production et en Preview :

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `APP_PASSWORD` | oui (déjà là) | le mot de passe de Reda Rise protège aussi Jarvis |
| `AUTH_SECRET` | oui (déjà là) | au moins 32 caractères : signe le cookie et chiffre le jeton Google |
| `GEMINI_API_KEY` | conseillé | cerveau de Jarvis |
| `GEMINI_MODEL` | non | `gemini-3.8-flash` par défaut |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | pour Gmail et l'Agenda | client OAuth (étape 1) |
| `SHOPIFY_SHOP_n_NAME`, `_DOMAIN`, `_TOKEN` ou `_CLIENT_ID` + `_CLIENT_SECRET` | pour Shopify | une série par boutique (étape 3) |

Tant que `APP_PASSWORD` ou un `AUTH_SECRET` d'au moins 32 caractères manque, **Jarvis reste verrouillé**. Aucune clé n'est envoyée au navigateur. Les variables `*_URL` qui ne figurent pas ci-dessus (`GEMINI_API_URL`, `GMAIL_API_URL`…) servent uniquement aux tests automatiques.

Dans Google Cloud (étape 1.6), déclarez ces URI de redirection :

- `http://localhost:3000/api/jarvis/google/callback` ;
- `https://muscu-tracker-phi.vercel.app/api/jarvis/google/callback`.

---

## 6. Lancer en local

```bash
npm install
npm run dev        # depuis la racine du dépôt
```

Ouvrez **http://localhost:3000/jarvis dans Microsoft Edge**. Les voix « Natural » sont celles d'Edge. Sur l'accueil de Reda Rise, le bouton **Jarvis** en haut à droite y mène aussi.

---

## 7. Mise en ligne

Jarvis fait partie de Reda Rise : il est déployé avec l'application, sans nouveau projet Vercel. Ajoutez les variables ci-dessus, puis ouvrez **/jarvis** et cliquez **Reconnecter Google**.

---

## 8. Ouverture automatique au démarrage du Mac

À chaque ouverture de session :

1. le lanceur attend que le Wi-Fi soit connecté ;
2. Jarvis s'ouvre en plein écran ;
3. une **animation** de démarrage passe, avec un **son** synthétisé, pendant environ 4 secondes ;
4. **le débrief démarre tout seul, sans clic.**

**Installation (une fois) :**

1. Installez **Microsoft Edge** (Chrome marche aussi, sans les voix « Natural »).
2. Dans le Finder, ouvrez le dossier `scripts/mac` du dépôt. Faites un **clic droit sur `installer-jarvis.command` → Ouvrir** (le clic droit évite le blocage de macOS pour un fichier téléchargé).
3. Validez l'adresse proposée (`https://muscu-tracker-phi.vercel.app`) avec Entrée.
4. Répondez **o** pour ouvrir Jarvis tout de suite, puis, dans la fenêtre qui s'ouvre :
   - connectez-vous avec le mot de passe de Reda Rise ;
   - autorisez le micro (Edge le demande, puis macOS).

   C'est retenu : vous ne le referez pas.

**Pour l'avoir dès que vous allumez le Mac**, sans taper votre mot de passe de session : **Réglages Système → Utilisateurs et groupes → Ouvrir la session automatiquement**. C'est un compromis de sécurité : sans cette option, Jarvis se lance juste après votre mot de passe macOS.

**Comment ça marche :**

- `installer-jarvis.command` crée un agent macOS (`~/Library/LaunchAgents/fr.redastudio.jarvis.plist`).
- Cet agent lance `~/Library/Application Support/Jarvis/lancer-jarvis.sh` à l'ouverture de session.
- Ce script ouvre Edge en fenêtre d'application plein écran sur `/jarvis?boot=1`.
- Edge utilise un **profil séparé** pour Jarvis : votre navigation habituelle n'est pas touchée.
- L'option qui autorise le son sans clic ne s'applique qu'à cette fenêtre.
- Si le son est quand même bloqué (ouverture à la main, autre navigateur), Jarvis affiche un grand bouton **Activer Jarvis** : un clic suffit.

**Désinstaller :** clic droit sur `scripts/mac/desinstaller-jarvis.command` → Ouvrir.

**En cas de souci :** le journal du lanceur est dans `~/Library/Application Support/Jarvis/lancement.log`. Pour sortir du plein écran : `Ctrl + Cmd + F`.

### Windows

1. Faites `Win + R`, tapez `shell:startup`, puis Entrée.
2. Créez un raccourci avec comme emplacement :
   ```
   "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --user-data-dir="%LOCALAPPDATA%\Jarvis" --app="https://muscu-tracker-phi.vercel.app/jarvis?boot=1" --start-fullscreen --autoplay-policy=no-user-gesture-required
   ```

Au premier lancement, connectez-vous et autorisez le micro. N'utilisez pas le mode `--kiosk` : il ouvre une session InPrivate qui oublie la connexion à chaque démarrage.

---

## Sécurité

- **Accès :** Jarvis est derrière la connexion de Reda Rise (cookie signé, `HttpOnly`, limite d'essais, comparaison en temps constant). Ses API refusent tout tant que le site n'est pas protégé par mot de passe.
- **Requêtes :** les appels qui modifient quelque chose refusent les requêtes venues d'un autre site.
- **Jeton Google :** il est conservé côté serveur, chiffré en AES-256-GCM avec une clé dérivée de `AUTH_SECRET`. Le navigateur ne voit jamais aucun jeton ni aucune clé.
- **Scopes Google minimaux :** lecture de Gmail, lecture et création d'événements. Jarvis ne peut ni envoyer, ni supprimer, ni modifier vos mails.
- **Flux RSS :** ils sont récupérés par le serveur, qui refuse les adresses locales et privées.

## Tests

```bash
npm run test:jarvis   # temps, RSS, planning, commandes vocales, et toutes les intégrations
```

Les intégrations (Gemini, Gmail, Agenda, Shopify, Open-Meteo) sont testées contre un faux serveur local (`tests/jarvis/mock-server.mjs`) : aucune vraie clé n'est nécessaire.
