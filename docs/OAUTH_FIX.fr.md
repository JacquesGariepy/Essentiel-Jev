# Essentiel 0.3.1 — correctif Google, localhost et client de bureau

## Origine de l’erreur

`{"error":"Requête intersite refusée."}` est produit par le serveur Essentiel, pas par Google.
Dans la version 0.3, la route `/oauth/google/callback` était déjà exemptée du refus intersite.
Le code pouvait échanger le code OAuth, enregistrer le compte, puis répondre `303` vers `/`.
La navigation suivante pouvait conserver `Sec-Fetch-Site: cross-site` à cause de la chaîne
Google → callback → accueil, et l’accueil était alors refusé en `403`.

La reproduction avec un fournisseur synthétique établit que le compte peut être enregistré
avant ce blocage d’affichage. Cela ne prouve pas que le compte de chaque utilisateur est connecté.

## Retrouver immédiatement l’interface

Sans arrêter le serveur, saisir directement dans la barre d’adresse :

```text
http://localhost:8787/#connections
```

Utiliser le nom d’hôte et le port déjà utilisés pour l’application. Ne pas recharger l’ancienne
URL contenant `code` et `state` : un code OAuth est à usage unique. Si le compte est déjà
indiqué connecté, l’échange a abouti malgré la page d’erreur. Sinon, recommencer depuis le
bouton de connexion après installation du correctif.

## Installer le correctif

Arrêter le serveur avant le remplacement des fichiers. Conserver `.env` et le dossier `.data`.
Extraire le projet corrigé par-dessus les fichiers du projet existant, ou les copier depuis
`essentiel-jev/`. Le ZIP ne contient ni `.env` renseigné ni `.data` ; il ne faut pas remplacer
la configuration existante par `.env.example`. Redémarrer avec `npm start` ou `start-windows.cmd`.
Les sessions non conservées dans le coffre chiffré sont perdues à l’arrêt du serveur, comme avant.
Les données navigateur des outils locaux restent associées à leur origine ; garder la même
adresse pour l’interface. Le nouveau passage par 127.0.0.1 pour Google revient à l’adresse initiale.

## Google Cloud : client « Application de bureau »

Ce type est maintenant pris en charge. Aucun hébergement public, tunnel ou domaine n’est requis.
Dans le fichier `.env` existant, renseigner :

```dotenv
GOOGLE_OAUTH_CLIENT_TYPE=desktop
GOOGLE_CLIENT_ID=identifiant_du_client.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=secret_fourni_dans_le_JSON_si_present
```

Le secret est facultatif dans le code pour un client desktop. Si Google en fournit un dans
le téléchargement, le recopier exactement ; ne pas inventer de secret et ne pas coller la
chaîne d’exemple ci-dessus comme une vraie valeur. Ce secret de client installé n’est pas
considéré comme confidentiel vis-à-vis du propriétaire de la machine. PKCE reste activé.

Le client est de type **Application de bureau**, pas **Application Chrome**, **Android** ou **iOS**.
Le code ouvre l’autorisation Google dans le navigateur normal, pas dans une WebView embarquée.
Le retour utilisé sur le port par défaut est :

```text
http://127.0.0.1:8787/oauth/google/callback
```

Cette adresse est construite par le code. Le mode bureau n’utilise pas la configuration de
retours d’un client Web et n’exige pas de transformer le client en application Web. Le serveur
existant réutilise son port local configuré ; ce n’est pas un récepteur temporaire sur port aléatoire.
Une seule tentative par fournisseur est active, avec expiration après dix minutes.

Le passage de `localhost` à `127.0.0.1` installe le cookie de liaison sur le bon hôte à l’aide
d’un ticket local à usage unique, avant l’ouverture de Google. Le callback vérifie encore
`state`, le cookie, le fournisseur, l’hôte attendu et le code PKCE. Après succès, l’interface
revient à l’origine depuis laquelle la connexion a commencé. Les API ne reçoivent aucune
exception CORS permissive.

### Utiliser directement le JSON téléchargé

Placer le JSON du client OAuth dans `google-oauth.json`, à côté de `server.mjs`. Il doit contenir
une section `installed`, pas une clé de compte de service. Choisir cette configuration :

```dotenv
GOOGLE_OAUTH_CLIENT_TYPE=desktop
GOOGLE_CLIENT_CONFIG_FILE=./google-oauth.json
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Le code lit les champs de ce fichier côté serveur. Il ignore ses éventuelles URL : les
points de terminaison Google restent fixés dans le code. Il refuse les configurations
contradictoires. Le JSON et `.env` ne doivent pas être publiés ni partagés.

## Conserver un client Web existant

Les clients Web restent compatibles. Utiliser `GOOGLE_OAUTH_CLIENT_TYPE=web`, l’identifiant
et le secret correspondants, et enregistrer l’adresse de retour exacte du client Web.
L’absence de `GOOGLE_OAUTH_CLIENT_TYPE` conserve ce comportement historique. La présence
d’un serveur local n’impose pas à elle seule un type OAuth : la configuration doit correspondre
au client créé dans Google Cloud. Microsoft reste en mode Web dans ce correctif.

## Ce qui reste protégé

Seules les navigations GET de document principal vers `/` et `/workspace` sont exemptées du
refus intersite global. Les API, écritures POST, scripts, images et iframes ne bénéficient pas
de cette exception. Les routes OAuth ont leur propre contrôle de navigation et de validité.
Aucune autorisation n’est accordée en fonction d’un simple paramètre `connected` dans l’URL :
le statut provient du compte réellement enregistré côté serveur.

## Limites de validation

136 tests Node réussis, dont 17 nouveaux tests de régression. Les tests HTTP utilisent
`http.request` pour conserver exactement les en-têtes de navigation ; `fetch` de Node
remplace `Sec-Fetch-Mode` et ne permettait pas de simuler fidèlement ce cas.
Le fournisseur des tests est simulé. Aucun compte Google réel, secret utilisateur, consentement
Google réel ou inférence TypeSafe n’a été utilisé.
Le test de navigation Chromium a été tenté mais bloqué par la politique de l’environnement
(`ERR_BLOCKED_BY_ADMINISTRATOR`). Il n’est pas compté comme réussi. Le test fourni peut être
exécuté dans un environnement de test autorisant localhost, toujours avec un fournisseur simulé.
Le mode « desktop » concerne le client OAuth ; le livrable reste un serveur Node local avec
interface navigateur. Il ne contient pas de nouvel exécutable Windows natif.

## Références officielles

Consultées le 19 septembre 2026.

- Fetch Metadata, chaîne de redirections : https://w3c.github.io/webappsec-fetch-metadata/#redirects
- OAuth Google pour applications installées : https://developers.google.com/identity/protocols/oauth2/native-app
- Maintien du retour loopback pour clients Desktop : https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration
- OAuth pour applications natives, RFC 8252 : https://www.rfc-editor.org/rfc/rfc8252.html
- OWASP, protection CSRF et navigation principale : https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
