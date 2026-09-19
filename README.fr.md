# Essentiel — courriel, agenda, tâches et documents assistés par l'IA, jugés par TypeSafe Jev

Français · [English](README.md)

**TypeSafe Jev fournit des jugements typés, appuyés par des probabilités (Choice, Score, Noul), que le code local valide avant usage. Les LLM rédigent le texte : toute API compatible OpenAI, des modèles locaux via Ollama, LM Studio, llama.cpp ou vLLM, Claude Code ou Codex. Vous approuvez chaque opération dans Gmail, Outlook, les agendas, tâches et documents Google/Microsoft, et Essentiel relit ce qui s'est réellement produit.**

## Pourquoi TypeSafe + IA

Essentiel sépare trois rôles que les « assistants IA » confondent souvent : **juger**, **rédiger** et **agir**. Chaque rôle revient à l'outil qui lui convient, et la décision finale reste la vôtre.

### Ce que TypeSafe Jev apporte : des jugements vérifiables par le code

TypeSafe présente Jev comme « le premier modèle System One », conçu pour « prendre des décisions rapides et structurées que le logiciel peut utiliser directement » ([introduction](https://docs.typesafe.ai/introduction), traduction). Dans Essentiel, cela signifie :

- **Des réponses typées plutôt que de la prose.** Jev répond en **Choice** (une option parmi des critères nommés), **Score** (un niveau sur une échelle) et **Noul** (une valeur de type oui/non entre 0 et 1). Pas de texte généré, pas d'analyse de texte : le résultat est une donnée, pas un paragraphe à interpréter.
- **Probabilités et confiance.** Les réponses Choice et Score portent toute la distribution de probabilités. Selon TypeSafe, la `confidence` est « une statistique calculée à partir de la distribution de probabilités » ([confidence](https://docs.typesafe.ai/confidence)). Essentiel affiche les deux et renvoie les résultats peu sûrs vers une revue. Ses seuils (0,75 par défaut) sont provisoires et non calibrés sur vos données.
- **Un contrat vérifié par le code avant usage.** Le validateur local refuse toute réponse dont le nombre ou le type est faux, dont les probabilités ne totalisent pas 1, dont le Choice n'est pas l'option la plus probable, ou dont le Score n'est pas la moyenne pondérée de son échelle. Une réponse invalide est refusée ; aucun résultat de remplacement n'est inventé.
- **Traçabilité.** L'identité du modèle et l'usage de jetons renvoyés par TypeSafe sont conservés avec le résultat.
- **Consentement à chaque envoi.** Chaque évaluation montre un aperçu modifiable du texte exact et exige son propre consentement. Aucune boîte de réception ni aucun corpus documentaire n'est transmis implicitement.
- **Jamais d'autorité.** Une probabilité élevée n'est jamais un mandat d'agir. Jev ne peut rien envoyer, créer ni approuver.

TypeSafe indique que les modèles System One sont « entraînés pour des décisions calibrées » ([System One](https://docs.typesafe.ai/concepts/system-one)). Essentiel n'a pas mesuré ce calibrage sur vos messages.

### Ce que les LLM apportent : un texte fluide que vous modifiez

Les modèles System One « n'écrivent pas de réponses, ne produisent pas de code et ne génèrent pas d'explications ». C'est voulu, et c'est précisément là qu'un LLM génératif aide :

- **Rédiger et résumer :** un brouillon de réponse courtois ou un résumé de 3 à 6 phrases d'un message, en français ou en anglais, selon votre consigne facultative (« formel », « décliner poliment »…).
- **Le moteur de votre choix :** toute **API compatible OpenAI** (OpenAI, OpenRouter, Mistral, Groq…) ; un **LLM local** (Ollama, LM Studio, llama.cpp, vLLM), où le texte reste sur votre ordinateur et aucuns frais par requête ne sont facturés ; **Claude Code** ou **Codex**, qui réutilisent votre connexion existante et s'exécutent sans outils.
- **Une sortie structurée et bornée :** le moteur doit renvoyer `{draft, notes}`. Les notes indiquent ce qu'il faut vérifier. Un appel d'outil, un champ en trop ou une réponse invalide est refusé.

### Comment ils travaillent ensemble

```text
Message source ──(votre consentement)──> le LLM rédige un texte modifiable   rédiger
               ──(votre consentement)──> Jev : Choice / Score / Noul         juger
Code local : valide les contrats, applique des règles déterministes, vérifie la fraîcheur
Vous : modifiez et approuvez l'aperçu exact                                 décider
Serveur : écrit dans Gmail / Outlook / Tasks / Agenda puis relit             agir + preuve
```

Aucun modèle n'envoie de courriel, ne crée d'objet ni n'approuve d'opération.

| Moteur de rédaction (facultatif) | `.env` | Où va le texte |
|---|---|---|
| API compatible OpenAI | `DRAFT_ENGINE=openai`, `LLM_BASE_URL=https://…/v1`, `LLM_API_KEY`, `LLM_MODEL` | Le fournisseur configuré |
| LLM local | `DRAFT_ENGINE=openai`, `LLM_BASE_URL=http://127.0.0.1:11434/v1` (Ollama), `LLM_MODEL` | Reste sur cet ordinateur |
| Claude Code | `DRAFT_ENGINE=claude` (facultatif : `CLAUDE_MODEL`, `CLAUDE_MAX_BUDGET_USD`) | Anthropic, via votre connexion |
| Codex | `DRAFT_ENGINE=codex` (facultatif : `CODEX_MODEL`) | OpenAI, via votre connexion |

Installation, options exactes des CLI, contenu transmis et modèle de sécurité : [docs/LLM-DRAFTING.fr.md](docs/LLM-DRAFTING.fr.md). Jev (`TYPESAFE_API_KEY`, `JEV_MODEL`) et le moteur de rédaction sont tous deux facultatifs : les outils connectés fonctionnent sans aucune clé IA.

**Limites honnêtes.** La confiance n'est pas l'exactitude. Un brouillon peut être faux ou inventer des détails : relisez-le. Un seul message est utilisé, jamais le fil complet. Les tests de cette version utilisent des fournisseurs synthétiques. Aucune inférence TypeSafe réelle ni aucune rédaction d'un vrai message n'a été effectuée. Les options de Claude Code et de Codex ont été vérifiées avec une seule invite triviale et non personnelle.

## À propos de cette version

**Transformer les messages et engagements existants en opérations approuvées dans Google et Microsoft. Ne pas demander aux personnes de recopier leur vie dans un nouvel organisateur.**

Interface et guides français / anglais. Application locale exécutable pour un seul utilisateur. Les adaptateurs des API officielles sont implémentés ; l'acceptation sur de vrais comptes et la vérification publique OAuth restent à effectuer. Aucun compte ni secret n'est préconfiguré. Les tests fournisseurs utilisent exclusivement des données synthétiques. Version publiée : 0.3.2. Ce dépôt contient aussi les ajouts de rédaction assistée non encore publiés, décrits dans [RELEASE_NOTES.md](docs/RELEASE_NOTES.md).

## Démarrage

Node.js 22 ou plus récent ; aucune dépendance npm à installer pour l'exécution.

```sh
cd essentiel-jev
# Nouvelle installation seulement : ne pas écraser un .env existant.
cp .env.example .env
npm start
```

Ouvrir `http://localhost:8787`. Sous PowerShell : `Copy-Item .env.example .env`, puis `npm start`. Le script `start-windows.cmd` est également fourni. La configuration OAuth se fait une fois par le développeur de l'application : [guide Google / Microsoft](docs/CONNECTORS.fr.md). Une clé IA n'est pas nécessaire pour les outils connectés : `TYPESAFE_API_KEY` active les jugements Jev, `DRAFT_ENGINE` active un LLM de rédaction facultatif ([guide](docs/LLM-DRAFTING.fr.md)).

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

Le moteur de rédaction facultatif se configure uniquement dans `.env`. Son point d'accès HTTP doit être en https, ou en http sur la boucle locale seulement. Claude Code et Codex s'exécutent comme processus enfants sans outils, dans un dossier temporaire vide, avec l'invite sur l'entrée standard et un environnement filtré ([détails](docs/LLM-DRAFTING.fr.md#modèle-de-sécurité)).

Aucun paiement, achat, réservation externe, envoi automatique, analyse de pièces jointes ou de fils complets, notification mobile, application mobile native, service autonome en arrière-plan, compte bancaire, foyer multiutilisateur ou exécution générique MCP/navigateur n'est implémenté. La disponibilité des calendriers est limitée au périmètre lu et n'est pas une réservation atomique. Aucun gain de temps, gain financier, taux de rétention ou désir universel n'a été mesuré.

## Jev / System One

Jev apporte des jugements typés facultatifs, pas la rédaction ni l'autorisation d'agir (voir [Pourquoi TypeSafe + IA](#pourquoi-typesafe--ia)). Chaque analyse de message présente un extrait modifiable et un consentement distinct. Un LLM de rédaction facultatif écrit un texte modifiable, avec son propre aperçu et consentement ; il ne remplace jamais une réponse Jev. Aucun corpus documentaire ni boîte complète n'est transmis implicitement. Choice, Score et Noul restent disponibles dans le laboratoire existant. Voir la [matrice de couverture](docs/SYSTEM_ONE_COVERAGE.md).

## Validation et reprise

```sh
npm test
# Facultatif : Python Playwright et Chromium installés séparément.
npm run test:browser
```

Résultats et limites : [VALIDATION.md](docs/VALIDATION.md). Acceptation avec comptes réels : [LIVE_ACCEPTANCE.md](docs/LIVE_ACCEPTANCE.md). Architecture : [ARCHITECTURE.md](docs/ARCHITECTURE.md). Sécurité : [SECURITY.md](docs/SECURITY.md). Définition produit : [PRODUCT.md](docs/PRODUCT.md). Point d'entrée agent : [START_HERE.md](START_HERE.md).

## Historique des versions

### Version 0.3.2 — une seule interface et des erreurs exploitables

Les outils connectés et locaux partagent maintenant la navigation, le thème et la langue de l’espace personnel. `/workspace` reste un alias de la même application. Un diagnostic de lecture par service distingue les refus Google des collections vides, sans exposer de jetons ni écrire dans les comptes. **Mise à jour et résolution HTTP 403 : [guide français](docs/GOOGLE_403.fr.md).** Le diagnostic doit être exécuté sur le poste : le projet Google utilisateur n’a pas été modifié ni testé ici.

### Correctif 0.3.1 — connexion Google locale

Le retour OAuth et sa redirection vers l’accueil ne sont plus confondus avec un appel API intersite. Le client Google **Application de bureau** est pris en charge avec `GOOGLE_OAUTH_CLIENT_TYPE=desktop`. Configuration, mise à jour sans écrasement de `.env`, et périmètre de test : [correctif Google / localhost](docs/OAUTH_FIX.fr.md).

**Définition :** Essentiel transforme les informations déjà présentes dans les outils d'une personne en opérations concrètes, approuvées, et conserve la trace de ce qui s'est réellement produit.
