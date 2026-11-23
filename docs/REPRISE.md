# Reprise : nouvelle app Reda Rise

À coller au début d'une nouvelle conversation, avec `docs/PROMPT-REFONTE.md`.

## Ce qui existe aujourd'hui (ancienne app, à garder en référence)
- Dépôt GitHub : redastudiofr/Reda-Rise.
  - Branche la plus à jour : `feature/jarvis`. Elle contient la réparation de la production, la Banque et Jarvis.
  - `main` est cassée (uploads « Add files via upload »). Les pull requests #1 et #2 sont restées ouvertes.
- Vercel : projet `muscu-tracker` (prj_oXRWZEgtGQn7zJ3dPDrkIYZggkG4, équipe team_hCATdNZrLGSrP0HtpI8W8uMx).
  - En production : https://muscu-tracker-phi.vercel.app, déployé directement depuis `feature/jarvis`, sans GitHub.
- Variables Vercel déjà en place : APP_PASSWORD, AUTH_SECRET, CRON_SECRET, ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY, base Neon (DATABASE_URL / POSTGRES_URL).
- Pas encore ajoutées : GEMINI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SHOPIFY_SHOP_n_*.

## Contraintes du propriétaire
- Réponses en français.
- Pas de GitHub côté utilisateur : publier directement sur Vercel.
- Ne jamais demander de clé dans le chat : indiquer la variable d'environnement à remplir.
- Rien en production sans son accord.
- Design fait à part avec Claude Design, à respecter fidèlement.

## Leçons à reprendre
- Montants en centimes entiers. Fuseau Europe/Paris partout.
- Sécurité « fail closed » : sans secret, les routes sensibles refusent tout. Aucune valeur par défaut pour les secrets.
- Le planning de Jarvis est calculé par le code, jamais par l'IA.
- Gmail en lecture = scope « restreint » chez Google (audit obligatoire si l'app est vendue).
- Gemini : dernier modèle Flash, Interactions API (vérifier la doc au moment du build).
- Shopify : Admin GraphQL, jeton shpat_ ou app Dev Dashboard (client credentials), scope read_orders.
- Enable Banking : sandbox en http://localhost accepté d'après des docs tierces ; https obligatoire en production.

## Pour démarrer la nouvelle app
1. Faire le design avec le prompt 1 de `docs/PROMPT-REFONTE.md`.
2. Nouvelle conversation Claude Code, idéalement dans un nouveau dépôt vide.
3. Coller ce fichier, puis le prompt 2 (choisir l'option A ou B de la section Sécurité), puis l'export du design.
4. Nouveau projet Vercel pour la nouvelle app. L'ancien reste en ligne jusqu'à ce que la nouvelle le remplace.
