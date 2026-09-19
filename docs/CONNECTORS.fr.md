> Version active 0.3.2 : les vues connectées sont intégrées à l’espace personnel. Pour un HTTP 403, suivre [le diagnostic Google](GOOGLE_403.fr.md). Les procédures OAuth ci-dessous restent applicables.

# Connecter Google et Microsoft — configuration développeur

Essentiel 0.3.2 est une application locale exécutable, destinée à un seul utilisateur. Le code de production appelle les API HTTPS officielles. Le ZIP ne contient ni secret renseigné, ni compte préconnecté, ni bascule de simulation dans le serveur de production. Les tests fournis utilisent des réponses synthétiques explicitement identifiées. Aucun compte réel n'a été authentifié pendant cette livraison.

## Démarrer

Node.js 22 ou plus récent est requis. Aucune installation de dépendances npm n'est nécessaire.

```sh
cd essentiel-jev
cp .env.example .env
npm start
```

Dans PowerShell : `Copy-Item .env.example .env`. Le script `start-windows.cmd` est également fourni. Ouvrir `http://localhost:8787` et laisser le terminal actif. Le serveur écoute uniquement sur la boucle locale IPv4. Ne pas l'exposer par tunnel, mandataire inverse ou réseau public.

En mode OAuth Web, le nom d'hôte est important : ouvrir `127.0.0.1` produit un retour OAuth en `127.0.0.1`, tandis que `localhost` produit un retour en `localhost`. Enregistrer l'adresse exacte utilisée. Ce guide utilise `localhost`, notamment pour éviter une restriction du formulaire Microsoft concernant les adresses de retour HTTP en `127.0.0.1`.

## Configuration Google, une fois pour l'application

Créer ou sélectionner un projet Google Cloud. Activer les API nécessaires : Gmail API, Google Calendar API, Tasks API et Drive API. Dans Google Auth Platform, configurer la présentation de l'application, son audience et les autorisations demandées. En mode de test, inscrire le compte réellement utilisé parmi les utilisateurs autorisés à tester.

Pour un client **Application de bureau**, définir `GOOGLE_OAUTH_CLIENT_TYPE=desktop` et suivre le [guide desktop / localhost](OAUTH_FIX.fr.md). Le retour passe par 127.0.0.1 et revient ensuite à l’adresse initiale.

Pour conserver un client **Application Web**, définir `GOOGLE_OAUTH_CLIENT_TYPE=web`, puis enregistrer exactement :

```text
http://localhost:8787/oauth/google/callback
```

Renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env`, puis redémarrer. Il s'agit des identifiants d'une application OAuth, pas d'une clé API Google. Ne jamais placer ces secrets dans le navigateur, une capture ou Git.

Dans Essentiel, ouvrir Connexions, choisir les usages Google et autoriser le compte sur la page de Google. Essentiel ne demande pas le mot de passe Google. Une application non vérifiée, une API désactivée, une autorisation restreinte, une politique de compte ou un retour incorrect peuvent bloquer l'accès. L'application doit alors conserver le statut d'erreur, pas prétendre être connectée.

Google classe notamment `gmail.readonly` et `gmail.compose` comme autorisations restreintes. La distribution publique peut exiger une vérification et d'autres contrôles selon les données traitées. La validation publique Google et une évaluation de sécurité indépendante ne sont pas incluses dans ce livrable. Un test personnel autorisé ne vaut pas autorisation de commercialisation.

## Configuration Microsoft, une fois pour l'application

Créer une inscription d'application dans Microsoft Entra. Choisir une audience cohérente : comptes d'une organisation, plusieurs organisations, ou organisations et comptes Microsoft personnels. Le paramètre `MICROSOFT_TENANT=common` doit correspondre à l'audience configurée ; pour un seul locataire, renseigner son identifiant approprié.

Ajouter une plateforme **Web**, car le serveur effectue l'échange de code avec un secret. Ne pas sélectionner une SPA seule ni des permissions applicatives globales pour ce code. Enregistrer :

```text
http://localhost:8787/oauth/microsoft/callback
```

Créer un secret client et copier sa **valeur**, pas son identifiant. Renseigner `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` et `MICROSOFT_TENANT` dans `.env`. Redémarrer le serveur.

Les permissions Microsoft Graph sont déléguées par le titulaire du compte. Une organisation peut exiger l'approbation d'un administrateur ou refuser le consentement. L'application ne demande pas `Mail.Send` et ne demande pas de lecture globale des boîtes de l'organisation. Choisir les usages dans Connexions, puis passer par la page Microsoft.

La documentation Microsoft précise une restriction du formulaire du portail pour les retours HTTP utilisant l'adresse IP `127.0.0.1` ; une configuration particulière du manifeste est nécessaire. Le parcours `localhost` ci-dessus évite cette difficulté. Ne pas désactiver la validation du retour dans le code pour résoudre une erreur de configuration.

## Permissions demandées

| Usage | Google, suffixe après `https://www.googleapis.com/auth/` | Microsoft |
|---|---|---|
| Lire les courriels | `gmail.readonly` | `Mail.Read` |
| Lire les calendriers | `calendar.readonly` | `Calendars.Read` |
| Lire les tâches | `tasks.readonly` | `Tasks.Read` |
| Chercher les documents | `drive.metadata.readonly` | `Files.Read` |
| Créer des brouillons | `gmail.compose` | `Mail.ReadWrite` |
| Créer des créneaux personnels | `calendar.events` et lecture calendrier | `Calendars.ReadWrite` |
| Créer ou terminer une tâche | `tasks` | `Tasks.ReadWrite` |

Google ajoute `userinfo.email` ; Microsoft ajoute `User.Read` et `offline_access`. Une écriture inclut la lecture nécessaire pour choisir et contrôler sa destination. L'interface se base sur les permissions effectivement retournées, pas seulement sur les cases cochées.

Décocher une autorisation déjà accordée ne la révoque pas. Le code redemande les droits existants avec les nouveaux usages ; le mode Desktop n’utilise pas le paramètre Google d’autorisation incrémentale. Pour réduire les droits, retirer l'accès chez le fournisseur, puis reconnecter avec le périmètre réduit.

Le droit Gmail `compose` permet aussi l'envoi au niveau du fournisseur, mais Essentiel n'implémente **aucune route d'envoi**. `Mail.ReadWrite` permet plus de modifications que les seules opérations exposées ici. Ces droits plus larges doivent être visibles : la sécurité ne se réduit pas aux boutons de l'interface.

## Premier parcours utile

Synchroniser une boîte autorisée. Ouvrir un message réel et son lien original. Choisir « Préparer un brouillon » ou « Créer une tâche liée ». Vérifier le compte de destination, modifier le contenu, lire la proposition exacte puis l'approuver. Examiner le reçu et retrouver l'objet dans le service d'origine. L'envoi du brouillon reste effectué dans la messagerie.

Pour réserver du temps, choisir les calendriers dans Connexions puis chercher un créneau dans une fenêtre précise. Une nouvelle lecture précède l'écriture. Un résultat incomplet ou un conflit bloque la création. Il ne s'agit pas d'une réservation atomique : un autre outil peut ajouter un événement après la vérification. Les disponibilités d'autres personnes ne sont pas interrogées, aucune invitation n'est envoyée et aucun rendez-vous externe n'est confirmé.

Pour retrouver un document, chercher dans Google Drive ou OneDrive. Google recherche le nom ; OneDrive utilise sa recherche native. Seuls les noms, métadonnées et liens retournés sont affichés. Le contenu des fichiers n'est pas téléchargé ni envoyé à TypeSafe.

## Conservation locale et révocation

Par défaut, les connexions et données vivent dans la mémoire du processus Node. Arrêter le serveur perd cette session. « Conserver chiffré » active le fichier `.data/connected.vault`, protégé par une phrase secrète d'au moins 12 caractères qui n'est pas enregistrée. Sans cette phrase, les connexions conservées ne sont pas récupérables.

Verrouiller explicitement avant de quitter le poste. Aucun verrouillage automatique sur inactivité n'est implémenté. Fermer l'onglet ne verrouille pas le coffre et n'arrête pas le serveur. Les secrets applicatifs dans `.env` ne sont pas protégés par le chiffrement du coffre. Protéger le compte système et le dossier de travail. Tout processus ayant accès au serveur local déverrouillé peut accéder à ses données ; ce n'est pas un service multiutilisateur.

Déconnecter supprime les jetons locaux, le cache et les entrées de journal liées au compte. Effacer supprime le coffre connecté. Ni l'un ni l'autre ne supprime les objets déjà créés dans les services et ne révoque le consentement chez Google ou Microsoft. Pour une révocation complète, retirer également l'accès dans les paramètres du fournisseur. L'export JSON des reçus est non chiffré et peut contenir des données personnelles, sans jetons OAuth.

Les données des anciens outils `/workspace` sont séparées et disposent de leurs propres contrôles de sauvegarde et d'effacement.

## Jev reste facultatif

Les connexions et opérations approuvées fonctionnent sans clé IA. Renseigner `TYPESAFE_API_KEY` uniquement pour les évaluations structurées facultatives. Le modèle est sélectionné explicitement dans `JEV_MODEL` ; sa disponibilité dépend du fournisseur.

Chaque analyse de message présente l'extrait exact, modifiable et expurgeable, puis exige un consentement distinct. Jev rend des jugements ; il ne rédige pas les réponses et ne déclenche aucune écriture. Les textes proposés dans les brouillons sont des modèles fixes identifiés. Le laboratoire Choice, Score et Noul complet reste accessible dans `/workspace`.

## Périmètre et erreurs

Cette version prend un compte Google et un compte Microsoft. Elle charge au plus 30 messages récents par boîte, une liste de tâches choisie par fournisseur, des calendriers sélectionnés et une recherche documentaire limitée à 50 résultats. Les messages sont limités à 8 000 caractères ; ni pièces jointes ni fils complets. L'agenda affiché couvre hier à 14 jours à venir. La recherche de créneaux couvre au plus sept jours et dix calendriers sélectionnés. Le journal accepte 500 propositions, puis bloque les nouvelles propositions plutôt que de supprimer silencieusement l'historique.

Les dates de tâches sont des dates calendaires, pas une garantie de notification. L'API Google Tasks ignore l'heure et décrit le champ comme une date de planification plutôt qu'une échéance métier stricte. Une date limite issue d'un document doit donc rester explicite dans le titre ou les notes si elle est importante.

Une erreur fournisseur reste visible ; le cache peut rester affiché avec avertissement de péremption. Une permission absente ne signifie pas boîte vide. Un calendrier partiellement lu ne signifie pas temps libre. Une réponse d'écriture ambiguë devient « résultat incertain », sans répétition aveugle. Un identifiant reçu mais non relu se distingue d'un objet vérifié.

Le protocole `LIVE_ACCEPTANCE.md` définit les essais à effectuer avec des ressources de test et un consentement réel avant toute diffusion publique. Les étapes publiques d'authentification n'ont pas été validées dans cette livraison.

## Références officielles

- OAuth Google : https://developers.google.com/identity/protocols/oauth2/web-server
- Permissions Gmail : https://developers.google.com/workspace/gmail/api/auth/scopes
- Brouillons Gmail : https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create
- OAuth Microsoft : https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- Retours OAuth Microsoft : https://learn.microsoft.com/en-us/entra/identity-platform/reply-url
- Brouillons Outlook : https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0
- Dates Google Tasks : https://developers.google.com/workspace/tasks/reference/rest/v1/tasks
- Tâches Microsoft : https://learn.microsoft.com/en-us/graph/api/todotasklist-post-tasks?view=graph-rest-1.0
- System One : https://docs.typesafe.ai/concepts/system-one

Références vérifiées le 19 septembre 2026. Les règles d'acceptation et de consentement applicables à un compte peuvent évoluer.
