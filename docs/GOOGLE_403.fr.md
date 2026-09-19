# Essentiel 0.3.2 — interface unifiée et diagnostic Google 403

## Ce que corrige cette version

Les deux anciennes entrées `/` et `/workspace` chargent maintenant la même application et la même navigation. Les courriels, calendriers, tâches, documents, connexions et preuves se trouvent dans l'espace personnel, à côté des outils locaux. La langue et le thème sont communs. Changer de rubrique ne recharge plus une seconde application et conserve les tâches locales en mémoire. `/workspace` reste accepté pour les anciens favoris.

Les données locales et celles des comptes ne sont pas fusionnées automatiquement. Une tâche locale reste locale ; « Tâches connectées » lit les listes Google Tasks/Microsoft To Do autorisées. Les compteurs de l'accueil personnel ne deviennent pas les totaux de Gmail. System One, les 28 domaines et les 112 parcours restent présents.

Un HTTP 403 ne suffit pas à identifier la cause. Le serveur conservait trop peu d'information. Il conserve maintenant des champs techniques explicitement autorisés du diagnostic fournisseur : service, HTTP, motif reconnu, catégorie et, lorsque Google le renvoie dans ErrorInfo, numéro du projet consommateur. Il ne renvoie pas le corps brut de l'erreur.

## Mise à jour sur le poste Windows

1. Arrêter le serveur avec `Ctrl+C`. Conserver `.env`, le dossier `.data` et le JSON OAuth éventuel référencé par `GOOGLE_CLIENT_CONFIG_FILE`. Exporter les données locales non sauvegardées depuis Préférences et données avant de recharger la page.
2. Remplacer les fichiers de l'application par ceux du dossier `essentiel-jev` de cette version, dans le dossier de travail habituel. Le ZIP ne contient aucun `.env`, coffre ou identifiant préconfiguré. Ne pas écraser une configuration existante avec `.env.example`.
3. Exécuter `npm start`, puis ouvrir `http://localhost:8787` et effectuer `Ctrl+F5`. Conserver le même nom d'hôte et le même port pour retrouver le stockage navigateur existant. `localhost` et `127.0.0.1` ne partagent pas ce stockage.

Le client OAuth Google de bureau reste pris en charge :

```dotenv
GOOGLE_OAUTH_CLIENT_TYPE=desktop
```

Ne pas changer les autres identifiants d'un client déjà configuré pour corriger un HTTP 403 d'API sans diagnostic. Cette livraison reste un serveur Node local avec interface navigateur, pas un installateur Windows. Configuration complète : [CONNECTORS.fr.md](CONNECTORS.fr.md). Retour de connexion et PKCE : [OAUTH_FIX.fr.md](OAUTH_FIX.fr.md).

## Identifier le service en échec

Ouvrir **Connexions → Google → Tester les accès**. Le test lance au plus une requête GET minimale par service de lecture autorisé. Il n'envoie aucun message, ne crée rien et ne modifie rien dans Google. Un droit non accordé est affiché comme non autorisé ; l'application ne demande pas ce droit silencieusement. Une réussite de ce contrôle ne prouve ni l'accès à tous les objets ni le droit d'écrire : la synchronisation et chaque opération conservent leurs propres validations.

| Résultat du diagnostic | Intervention |
|---|---|
| API désactivée (`SERVICE_DISABLED`, `accessNotConfigured`) | Ouvrir le lien Google Cloud proposé. Sélectionner le projet qui contient le client OAuth utilisé par `.env` ou le JSON configuré. Activer l'API du service concerné. Attendre la prise en compte, puis tester de nouveau et synchroniser. |
| Autorisations insuffisantes (`ACCESS_TOKEN_SCOPE_INSUFFICIENT`, `insufficientPermissions`) | Cocher les capacités utiles dans Connexions et utiliser Réautoriser / étendre les droits. Accepter uniquement les accès nécessaires. Cela ne remplace pas l'activation des API du projet. |
| Restriction d'organisation (`domainPolicy`, etc.) | Faire vérifier l'accès à l'application par l'administrateur Google Workspace. Le code local ne contourne pas cette décision. |
| Limite d'utilisation (`rateLimitExceeded`, `quotaExceeded`, HTTP 429) | Espacer les requêtes et examiner les limites du projet/service. Une nouvelle connexion ne corrige pas nécessairement cette cause. Ne jamais répéter aveuglément une écriture incertaine. |
| Compte à réautoriser | Rétablir l'autorisation du compte ; vérifier ensuite les droits réellement accordés. |
| Refus non identifié | Ne pas conclure à une API désactivée. Le rapport conserve HTTP et les motifs reconnus disponibles. Vérifier le projet, les droits et les restrictions du compte. |

Les noms exacts des API sont : **Gmail API**, **Google Calendar API**, **Google Tasks API**, **Google Drive API**. Seuls les services utilisés doivent être activés. Créer un client OAuth ou réussir la connexion Google n'active pas automatiquement ces API et ne constitue pas un test de leur accès.

L'application ne peut pas activer ces services à la place du propriétaire du projet. Le lien de configuration est construit vers `console.cloud.google.com`, avec l'identifiant d'API connu. Le numéro de projet n'est présélectionné que lorsqu'il est explicitement présent dans les métadonnées Google. Sinon, le bon projet doit être sélectionné manuellement ; aucun numéro n'est inventé à partir d'un identifiant client.

## Ce que l'interface indique maintenant

« Compte identifié » est séparé du résultat de lecture de Gmail, Calendar, Tasks et Drive. Une erreur sans données antérieures donne un compteur indisponible (`—`), pas un zéro qui prétendrait représenter le compte. Les données précédemment lues restent visibles avec l'avertissement d'échec de la nouvelle tentative. La boîte ne se présente plus comme vide lorsque sa lecture a échoué.

**Exporter le diagnostic** crée un rapport technique JSON : version, fournisseur, horodatage, services, résultat, code et métadonnées filtrées. Il ne contient ni access_token, refresh_token, secret client, adresse de compte, corps de courriel ni identifiant de message/document. Le numéro de projet Google peut y figurer : c'est une information technique à traiter en conséquence. Les exports ordinaires du journal d'actions sont différents et peuvent contenir des données personnelles.

## Validation et limites

157 tests Node réussis, 34 contrôles du navigateur sur les outils locaux et 17 contrôles d'intégration de l'interface unifiée. Les fournisseurs des tests sont synthétiques. Les contrôles d'interface injectent le code livré et utilisent un pont vers le serveur HTTP local ; la navigation Chromium directe vers localhost est bloquée par la politique de l'environnement de construction. Les comportements de stockage, historique d'URL et téléchargement emploient des substituts de test explicitement documentés.

Aucun compte Google/Microsoft réel ni appel TypeSafe réel n'a été utilisé. La cause du HTTP 403 de la capture utilisateur n'a pas été déterminée sur son compte. Le correctif répare la navigation et la visibilité des erreurs ; le diagnostic doit être exécuté sur le poste pour connaître le refus actuel. [Rapport de validation](VALIDATION.md).

## Sources officielles vérifiées le 19 septembre 2026

- [Google Gmail : erreurs et champ reason](https://developers.google.com/workspace/gmail/api/guides/handle-errors)
- [Google Calendar : erreurs et limites](https://developers.google.com/workspace/calendar/api/guides/errors)
- [Google Cloud : activer un service dans un projet](https://cloud.google.com/service-usage/docs/enable-disable)
- [Google : OAuth pour les applications de bureau](https://developers.google.com/identity/protocols/oauth2/native-app)
