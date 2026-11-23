# Prompt de démarrage : Hustle Flow connecté à Vercel

**Avant d'ouvrir la nouvelle conversation (une seule fois) :**
- Sur claude.ai → Paramètres → Connecteurs : vérifie que **Vercel** et **GitHub** sont connectés.
- Choisis le dépôt **redastudiofr/Reda-Rise** au démarrage de la session, pour que Claude puisse lire les fiches de reprise.

Ensuite, colle le texte ci-dessous comme premier message.

---

```
Tu travailles sur ma nouvelle app « Hustle Flow » (refonte de Reda Rise). Réponds en français, phrases simples. Avant de coder, lis docs/REPRISE.md et docs/PROMPT-REFONTE.md (branche feature/jarvis du dépôt redastudiofr/Reda-Rise) : ce sont la fiche de reprise et le cahier des charges complet.

Règle n°1 : tout passe par Vercel, je ne touche jamais à GitHub.

1. Vérifie d'abord que tu as accès à Vercel (connecteur Vercel) et à GitHub. Mon équipe Vercel est team_hCATdNZrLGSrP0HtpI8W8uMx. Si un accès manque, dis-moi exactement quoi activer, puis arrête-toi.
2. Code : crée un nouveau dépôt GitHub « hustle-flow » (vide, privé) et travaille dedans. Tu gères git toi-même. Si tu ne peux pas créer le dépôt, dis-le-moi en une phrase et propose la solution la plus simple.
3. Vercel :
   - crée un nouveau projet Vercel « hustle-flow » relié à ce dépôt ;
   - n'utilise pas et ne modifie pas l'ancien projet « muscu-tracker », qui reste en ligne tant que je n'ai rien décidé.
4. Déploiements :
   - chaque étape terminée est déployée en Preview, et tu me donnes le lien pour tester ;
   - la mise en production se fait directement par Vercel (déploiement de production depuis ta branche), seulement quand je dis « mets en ligne » ;
   - après chaque déploiement, vérifie qu'il est « READY » et que la page répond, sinon lis les logs de build et corrige.
5. Base de données : ajoute une base Postgres Neon gratuite au projet (via Vercel Storage). Si tu ne peux pas, dis-moi les clics à faire.
6. Variables d'environnement :
   - tu peux créer toi-même celles qui ne sont pas secrètes ;
   - pour chaque secret (mots de passe, clés API, clé privée), donne-moi le nom exact de la variable et où le mettre dans Vercel ;
   - ne me demande jamais de coller une clé dans le chat ;
   - n'essaie jamais de lire les valeurs secrètes de mes projets.
7. Avance par étapes, selon le plan de travail de docs/PROMPT-REFONTE.md. À la fin de chaque étape : ce qui est fait, le lien Preview, comment tester, et l'étape suivante. Une conversation par grosse étape : à la fin de chaque étape, mets à jour docs/REPRISE.md dans le dépôt hustle-flow pour que je puisse continuer dans une nouvelle conversation.

Pour cette première conversation, fais seulement : les vérifications d'accès, le dépôt, le projet Vercel, la base, le socle de l'app (étape 1 du plan) et un premier déploiement Preview qui fonctionne. Le design viendra de Claude Design : je te le donnerai.
```
