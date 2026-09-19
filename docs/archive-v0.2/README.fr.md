# Essentiel 0.2 — Votre vie. Vos choix.

Un espace quotidien local : capturer ce qui compte, préparer des actions réalisables, organiser ses informations, comparer ses choix et examiner des évaluations IA structurées facultatives. **Les outils quotidiens fonctionnent sans clé API.** L’application ne lit aucun compte et n’exécute aucune action externe.

[English](README.md) · [Prise en charge par un agent](START_HERE.md) · [Couverture System One](docs/SYSTEM_ONE_COVERAGE.md) · [Validation](docs/VALIDATION.md)

## Démarrer

Node.js 22 ou plus récent est requis. Aucune dépendance npm d’exécution à installer.

```sh
cd essentiel-jev
npm start
```

Ouvrir `http://127.0.0.1:8787`. Sous Windows, `start-windows.cmd` lance le même serveur ; sous Linux/macOS, utiliser `sh start.sh`. Garder le terminal ouvert. Ctrl+C arrête le serveur. Les lanceurs Windows et macOS sont fournis, mais n’ont pas été exécutés sur ces systèmes pendant cette livraison.

L’application servie localement démarre avec un espace vide. Les exemples fictifs se chargent uniquement par une action explicite. Le bouton FR/EN change la langue de l’interface. Par défaut, les données restent en mémoire : exporter avant de fermer ou activer explicitement la sauvegarde navigateur dans les préférences. Cette sauvegarde navigateur n’est pas chiffrée.

`preview-fr.html` et `preview-en.html` sont des aperçus autonomes fonctionnels, contenant des données fictives et **sans appel réel au fournisseur**. Le serveur local constitue le mode de référence pour l’usage quotidien et les appels TypeSafe. Le stockage et la cryptographie des fichiers ouverts directement dépendent du navigateur ; ils ne remplacent pas une sauvegarde vérifiée.

## Fonctions présentes

| Espace | Utilisation réelle | Limite explicite |
|---|---|---|
| Aujourd’hui | Capture rapide, plan selon le temps disponible, priorités, minuterie de concentration et routines | Pas de disponibilité inventée, de tâche terminée automatiquement ni d’alerte quand l’application est fermée |
| Tâches et agenda | Création, modification, suppression, listes de vérification, dépendances, responsable déclaré, projet, dates, répétition, report, filtres, semaine, CSV et ICS | Un nom de responsable n’est pas une assignation dans le compte d’une autre personne ; aucun calendrier synchronisé |
| Espaces de vie | 28 domaines facultatifs, 112 parcours bilingues de quatre étapes, six profils de départ | Les parcours créent des tâches locales après validation, pas des connexions à 112 services |
| Argent | Revenus/dépenses saisis, devises séparées, limites mensuelles, abonnements, projection arithmétique d’épargne, CSV | Aucune banque connectée, déclaration fiscale, opération d’investissement ou transaction financière |
| Repas et listes | Courses, provisions, repas, bagages et listes personnalisées ; ingrédients déclarés vers la liste de courses | Quantités, restrictions alimentaires et achats réels à vérifier personnellement |
| Décisions | Matrice de notes humaines pondérées, contraintes, budget, données inconnues, choix personnel et résultat observé | Les notes Jev facultatives restent séparées ; aucune commande automatique |
| Carnet | Notes, fiches de contact, index de documents, objets, journal, idées, recherche et tâches de suivi | Aucun fichier binaire joint, coffre de mots de passe ou répertoire externe connecté |
| Boîte d’attention | Texte original, extraits exacts, propositions de classement/date, revue humaine, modèle de réponse éditable et tâche liée | Aucun compte courriel lu et aucun message envoyé ; un texte ne prouve pas l’identité de son expéditeur |
| System One | Contrats Choice, Score et Noul, état structuré, consentement, distributions, modèle, usage, dossier de revue et observations | Pas de génération de prose, de code ou d’explication du raisonnement ; aucun autre modèle appelé automatiquement |
| Données et affichage | FR/EN, clair/sombre, texte agrandi, mouvement réduit, mémoire ou stockage choisi, export chiffré, import, annulation, effacement | Pas de compte infonuagique, d’espace partagé, de synchronisation ni de sécurité multiclient de production |

Le [catalogue français](docs/HUMAN_NEEDS_FR.md) et le [catalogue anglais](docs/HUMAN_NEEDS_EN.md) détaillent tous les domaines, résultats attendus et étapes. Cette couverture est extensible. Elle ne suppose pas que chaque personne a les mêmes désirs, contraintes ou priorités.

## Utilisation concrète

### Traiter une demande

Boîte d’attention → Ajouter une source → coller le texte ou charger `.txt`, `.md` ou un lot JSON. L’enregistrement seul reste local. Une analyse Jev facultative présente la transmission exacte et exige le consentement. Ouvrir le résultat, comparer l’extrait au message original, choisir le classement et confirmer soi-même la date. Créer ensuite une tâche liée ou un événement ICS. Le brouillon est un texte fixe modifiable ; il n’est ni rédigé par Jev ni envoyé par Essentiel.

### Préparer une journée réalisable

Saisir les tâches réelles avec durée, priorité, dépendances et dates choisies. Composer la journée à partir du temps disponible, de l’énergie déclarée et d’une réserve. L’algorithme remplit la capacité sans masquer les tâches restantes. Une tâche récurrente terminée crée son occurrence suivante ; les occurrences manquées ne sont pas multipliées automatiquement.

### Mettre un domaine de vie en ordre

Espaces de vie → domaine → parcours. Modifier les quatre étapes, choisir ou laisser vide la première date, puis confirmer. Sans première date, les tâches sont non datées. Les durées sont des estimations modifiables. Les domaines visibles se sélectionnent librement ; des tâches et notes personnelles couvrent les besoins non présents dans les modèles.

### Examiner son argent

Saisir les revenus et dépenses réels, dans leur devise. CAD, USD, EUR et GBP restent séparés : aucune conversion implicite. Les équivalents mensuels des abonnements ne sont pas retirés une seconde fois des mouvements saisis. La projection d’épargne dépend uniquement de l’objectif, de l’épargne déjà présente et de la contribution déclarée, sans intérêt ni rendement supposé.

### Comparer un choix

Créer au moins deux options, des critères, leurs poids, des contraintes et un budget facultatif. Une note vide reste inconnue. Confirmer l’état des contraintes. Lire le résultat pondéré et inscrire son propre choix. Choisir une option inadmissible reste possible, mais le motif d’inadmissibilité demeure visible. Rien n’est acheté.

### Sauvegarder et reprendre

Dans les préférences, exporter un fichier JSON ou une sauvegarde chiffrée. Cette dernière exige une phrase secrète d’au moins 12 caractères, saisie deux fois, à conserver séparément. Aucun service ne permet de la récupérer. L’import valide le fichier et demande confirmation avant de remplacer l’espace ; ce n’est pas une fusion. Les classifications IA et approbations de date des sources importées sont invalidées. Les données manuelles des tâches restent manuelles. L’effacement local ne supprime pas les copies déjà exportées.

## Jev facultatif

L’adaptateur utilise l’[API HTTP native TypeSafe](https://docs.typesafe.ai/api), pas un adaptateur de conversation OpenRouter supposé. Copier `.env.example` vers `.env` à côté de `server.mjs` :

```dotenv
TYPESAFE_API_KEY=votre_cle_typesafe
JEV_MODEL=jev-1.13.0
PORT=8787
```

Relancer le serveur. « Configurée » signifie seulement qu’une clé est présente côté serveur, pas qu’un appel réel a réussi. La clé n’est pas exposée au navigateur. Le modèle est explicite ; les alias peuvent évoluer. Consulter la [page des modèles](https://docs.typesafe.ai/models) pour l’offre et les prix en vigueur. Aucun plafond de facturation monétaire n’est implémenté.

Le laboratoire accepte un état JSON de type chaîne, objet ou tableau et des questions indépendantes. Choice : 2 à 255 options ; Score : 2 à 10 niveaux descriptifs ; Noul : réponse probabiliste oui/non. Le bouton de fixture génère une distribution uniforme identifiée comme fictive, pas une inférence locale. Une question dépendante s’exécute dans un appel suivant distinct après revue. Le dossier de revue est exportable pour une personne ou un autre système, mais aucun modèle de raisonnement n’est connecté automatiquement.

L’interface et les exemples sont disponibles dans les deux langues. Les données rédigées par l’utilisateur ne sont pas traduites automatiquement. La qualité de Jev en français doit être évaluée séparément : la disponibilité d’une interface française n’est pas une mesure de précision du modèle. Aucun appel TypeSafe réel ni benchmark linguistique n’a été réalisé dans cette livraison.

## Formats et limites

Lot de sources : tableau JSON ou objet contenant `records`, jusqu’à 40 sources par import, avec `title`, `text`, `source` et `receivedAt` facultatifs. Maximum de 8 000 caractères par texte. Les doublons textuels exacts normalisés sont ignorés pendant l’import de sources. Aucun PDF, image, audio ou document binaire n’est interprété.

CSV financier : en-têtes exacts `title,direction,amount,currency,date,category`, montant positif, direction `income` ou `expense`, date ISO. L’import ajoute après confirmation ; importer deux fois le même fichier financier crée des doublons. Les exports ICS sont des événements sur une journée entière issus des dates choisies ou confirmées, pas des écritures dans un compte calendrier.

```sh
npm test
npm run preview
python tests/browser-check.py
python tests/browser-privacy.py
```

Les deux scripts Python sont réservés au développement et nécessitent Playwright/Chromium. Les preuves livrées rapportent **77 tests Node réussis, 34 vérifications de parcours navigateur et 4 vérifications de concurrence navigateur**. Le navigateur a reçu le HTML hors ligne, avec les substituts de stockage, téléchargement et réseau signalés dans les rapports. Les contrats HTTP ont été testés avec un vrai serveur local Node et un fournisseur simulé. Ce n’est pas une certification de sécurité, d’accessibilité ou de précision Jev.

Ne pas exposer ce serveur à Internet ou à un réseau partagé. Il n’a ni authentification applicative ni isolation de clients. Utiliser un seul onglet et un seul rédacteur actif : la concurrence entre plusieurs onglets n’est pas coordonnée. Les sauvegardes JSON sont limitées à 8 Mo ; les autres plafonds sont détaillés dans [Architecture](docs/ARCHITECTURE.md). Les règles de sauvegarde et d’effacement figurent dans [Security](docs/SECURITY.md).
