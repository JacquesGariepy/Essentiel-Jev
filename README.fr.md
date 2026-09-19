# Essentiel 0.3.2 — agir dans les outils déjà utilisés

**Transformer les messages et engagements existants en opérations approuvées dans Google et Microsoft. Ne pas demander aux personnes de recopier leur vie dans un nouvel organisateur.**

Interface et guides français / anglais. Application locale exécutable pour un seul utilisateur. Les adaptateurs des API officielles sont implémentés ; l'acceptation sur de vrais comptes et la vérification publique OAuth restent à effectuer. Aucun compte ni secret n'est préconfiguré. Les tests fournisseurs utilisent exclusivement des données synthétiques.

## Version 0.3.2 — une seule interface et des erreurs exploitables

Les outils connectés et locaux partagent maintenant la navigation, le thème et la langue de l’espace personnel. `/workspace` reste un alias de la même application. Un diagnostic de lecture par service distingue les refus Google des collections vides, sans exposer de jetons ni écrire dans les comptes. **Mise à jour et résolution HTTP 403 : [guide français](docs/GOOGLE_403.fr.md).** Le diagnostic doit être exécuté sur le poste : le projet Google utilisateur n’a pas été modifié ni testé ici.

## Correctif 0.3.1 — connexion Google locale

Le retour OAuth et sa redirection vers l’accueil ne sont plus confondus avec un appel API intersite. Le client Google **Application de bureau** est pris en charge avec `GOOGLE_OAUTH_CLIENT_TYPE=desktop`. Configuration, mise à jour sans écrasement de `.env`, et périmètre de test : [correctif Google / localhost](docs/OAUTH_FIX.fr.md).

## Démarrage

Node.js 22 ou plus récent ; aucune dépendance npm à installer pour l'exécution.

```sh
cd essentiel-jev
# Nouvelle installation seulement : ne pas écraser un .env existant.
cp .env.example .env
npm start
```

Ouvrir `http://localhost:8787`. Sous PowerShell : `Copy-Item .env.example .env`, puis `npm start`. Le script `start-windows.cmd` est également fourni. La configuration OAuth se fait une fois par le développeur de l'application : [guide Google / Microsoft](docs/CONNECTORS.fr.md). Une clé IA n'est pas nécessaire pour les outils connectés.

## Parcours connectés implémentés

| Point de départ | Opération native après approbation | Signification de la preuve |
|---|---|---|
| Un message Gmail ou Outlook | Enregistrer un brouillon modifiable dans la messagerie choisie | Le brouillon existe ; aucun envoi |
| Une demande reçue | Créer une tâche Google Tasks ou Microsoft To Do liée à sa source | Le suivi existe ; le travail sous-jacent reste à faire |
| Des calendriers personnels ou professionnels sélectionnés | Chercher du temps et créer un créneau personnel | Le périmètre choisi a été relu ; aucun tiers n'a confirmé |
| Une tâche native existante | La marquer terminée après vérification de son état | Le fournisseur retourne une tâche terminée |
| Un nom de document | Chercher dans Drive ou OneDrive puis ouvrir l'original | Le document est localisé ; son contenu n'est pas analysé |

La page principale `/` ouvre Aujourd’hui. Une navigation commune donne accès aux outils connectés et aux outils personnels locaux. Aucune donnée fictive ne remplace un compte absent. Un compte Google et un compte Microsoft sont pris en charge.

Les écritures sont réalisées côté serveur, autorisées par usage, approuvées explicitement et suivies d'une relecture de l'objet. Cette relecture confirme l'identifiant et certains états, pas l'envoi d'un message, l'accord d'une autre personne, l'égalité exhaustive de tous les champs ni la résolution du besoin métier. Une réponse perdue après une écriture reste incertaine ; aucune répétition aveugle n'est effectuée.

## Les outils existants sont conservés

Les outils locaux restent dans la même interface : 28 domaines facultatifs, 112 parcours, planification, argent, listes, carnet, décisions et laboratoire System One. Leurs données restent séparées du coffre connecté ; aucune copie automatique de tâches entre les deux n’est effectuée. Les fichiers `preview-*.html` sont des aperçus hors ligne des outils locaux ; les rubriques connectées y indiquent qu’un serveur est nécessaire.

## Sécurité et limites

Le serveur écoute seulement sur la boucle locale. Ce n'est pas une application infonuagique multiutilisateur. Les jetons OAuth restent côté serveur ; `.env` contient les identifiants applicatifs. Par défaut, les données connectées restent en mémoire. Le chiffrement facultatif par phrase secrète conserve les jetons, sources et opérations dans `.data/connected.vault`. Il ne protège ni le processus déverrouillé ni les secrets de `.env`. Verrouiller explicitement ; fermer l'onglet ne suffit pas. Les exports de reçus JSON sont en clair et peuvent contenir des données personnelles.

Les autorisations du fournisseur peuvent être plus larges que les boutons implémentés. Gmail compose permet techniquement l'envoi, même si Essentiel n'a aucune route d'envoi. Microsoft `Mail.Send` n'est pas demandé. Une déconnexion locale ne révoque pas le consentement et ne supprime pas les objets créés dans les services.

Aucun paiement, achat, réservation externe, envoi automatique, analyse de pièces jointes ou de fils complets, notification mobile, application mobile native, service autonome en arrière-plan, compte bancaire, foyer multiutilisateur ou exécution générique MCP/navigateur n'est implémenté. La disponibilité des calendriers est limitée au périmètre lu et n'est pas une réservation atomique. Aucun gain de temps, gain financier, taux de rétention ou désir universel n'a été mesuré.

## Jev / System One

Jev apporte des jugements typés facultatifs, pas la rédaction ni l'autorisation d'agir. Chaque analyse de message présente un extrait modifiable et un consentement distinct. Aucun corpus documentaire ni boîte complète n'est transmis implicitement. Choice, Score et Noul restent disponibles dans le laboratoire existant. Voir la [matrice de couverture](docs/SYSTEM_ONE_COVERAGE.md).

## Validation et reprise

```sh
npm test
# Facultatif : Python Playwright et Chromium installés séparément.
npm run test:browser
```

Résultats et limites : [VALIDATION.md](docs/VALIDATION.md). Acceptation avec comptes réels : [LIVE_ACCEPTANCE.md](docs/LIVE_ACCEPTANCE.md). Architecture : [ARCHITECTURE.md](docs/ARCHITECTURE.md). Sécurité : [SECURITY.md](docs/SECURITY.md). Définition produit : [PRODUCT.md](docs/PRODUCT.md). Point d'entrée agent : [START_HERE.md](START_HERE.md).

**Définition :** Essentiel transforme les informations déjà présentes dans les outils d'une personne en opérations concrètes, approuvées, et conserve la trace de ce qui s'est réellement produit.
