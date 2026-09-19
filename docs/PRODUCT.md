# Essentiel — useful outcomes before feature counts

## Français

### Le problème produit

Un catalogue de 28 domaines ne rend pas un produit essentiel. Il augmente surtout la quantité de choses que la personne peut devoir saisir. Le produit doit partir des systèmes déjà utilisés, réduire un travail identifiable et montrer ce qui a réellement été accompli.

La proposition : **« Mes outils contiennent déjà les informations. Essentiel m'aide à terminer ce qui en découle, sans tout recopier ni abandonner le contrôle. »**

Cette promesse est une direction produit, pas une mesure d'adoption. Aucun produit ne peut garantir que chaque humain le désirera. Les habitudes, outils disponibles, besoins d'accessibilité, contraintes de confidentialité et capacités de paiement varient. Une base commune utile peut servir plusieurs publics sans imposer le même tableau de bord à tous.

### Les parcours prioritaires implémentés

Un courriel contient une demande. La personne ouvre son original, prépare une tâche ou un brouillon dans son outil, confirme la destination et le contenu. Le logiciel écrit l'objet puis affiche son identifiant et la dernière relecture réussie. La demande n'est pas déclarée résolue parce qu'une tâche a été créée.

Un engagement nécessite du temps. La personne choisit une fenêtre et des calendriers. Le logiciel calcule les intervalles libres dans ce périmètre, puis revérifie avant de créer un créneau personnel. Il n'invente ni la disponibilité d'un tiers ni une réservation de service.

Un document est difficile à retrouver. La personne cherche son nom dans Drive ou OneDrive et ouvre l'original. Essentiel ne crée pas une copie documentaire à entretenir et ne prétend pas avoir compris le contenu.

Les outils Google et Microsoft peuvent être combinés : une source d'un compte peut mener à une tâche dans l'autre. Le transfert entre comptes est visible avant approbation. Aucune information professionnelle ne doit être déplacée vers un compte personnel par défaut ou silencieusement.

### Une expérience grand public reste à construire

Le développeur configure une fois les clients OAuth ; le futur utilisateur grand public ne doit jamais créer un projet Cloud, copier un secret ou installer Node pour profiter du service. Ce ZIP livre le code local de cette étape, pas ce service hébergé et opéré. Présenter la configuration développeur comme un parcours universel serait incorrect.

Le produit distribué doit permettre de connecter un seul outil utile, de refuser les autres autorisations et d'obtenir une première opération vérifiable sans importer toute sa vie. Il doit avoir une forme accessible aux personnes qui utilisent un lecteur d'écran, de gros caractères ou des interactions limitées. Une interface responsive et des attributs accessibles sont présents ; une certification d'accessibilité et des essais avec ces publics ne le sont pas.

Le succès n'est pas le nombre de modules ouverts ni le temps passé dans Essentiel. Les mesures à établir sont le nombre d'opérations confirmées dans les outils, la précision des propositions sur données réelles consenties, les corrections et refus, les erreurs récupérées, les doubles opérations, le temps effectivement économisé mesuré par comparaison, et la réutilisation volontaire. Aucun chiffre fictif de minutes ou de dollars économisés ne doit être affiché.

### Extensions utiles, non implémentées

| Besoin concret | Résultat réellement attendu | Dépendance qui doit exister avant la promesse |
|---|---|---|
| Répondre moins péniblement | Réponse pertinente prête dans le bon fil | Contexte de conversation, rédaction distincte de Jev, validation, rattachement natif testé |
| Ne pas oublier une demande | Suivi jusqu'à clôture observable | Synchronisation durable, échéance vérifiée, notifications autorisées, état externe confirmé |
| Réduire les renouvellements subis | Décision puis arrêt effectivement confirmé | Sources de contrats fiables, API du service ou parcours officiellement autorisé, preuve d'annulation |
| Simplifier le foyer | Engagements partagés sans exposer les comptes privés | Comptes multiples, invitations, droits par personne, consentement individuel, isolation |
| Préparer un déplacement | Documents et contraintes réunis au bon moment | Sources de réservation, horaires actualisés, notifications ; aucune réservation fictive |
| Réduire les démarches | Documents exacts et étape soumise au bon destinataire | Connecteur officiel, autorisation explicite, dépôt confirmé, règles propres au service |
| Protéger les finances | Anomalie explicable, décision humaine et résultat suivi | Agrégateur autorisé, couverture régionale, consentement, modèle d'erreur ; aucune transaction autonome |

Ces extensions doivent être livrées par résultat, pas par logos de connecteurs. Aucun accès bancaire, portail public, achat, réservation ou dossier médical n'existe dans la v0.3. Le concept ne doit pas contourner les permissions d'un service ni laisser croire à une connexion universelle par navigateur ou MCP.

### Rôle de Jev

Jev juge un état via Choice, Score et Noul. Il peut aider à classer, orienter ou signaler une incertitude. Le code valide les contrats, applique les règles déterministes, calcule le temps et réalise les appels autorisés. Une personne approuve les changements. Un éventuel modèle génératif distinct pourrait rédiger un texte ; il n'est pas fourni dans ce lot. Une probabilité ou une confiance élevée ne devient jamais un mandat d'agir.

## English

### Product definition

**“My tools already hold the information. Essentiel helps me finish what follows, without re-entering everything or losing control.”**

Essentialness is not a feature count. A product should remove a recognizable burden and keep evidence of the resulting native action. This is a product direction, not proof that every person will want it. Different needs, providers, access requirements and privacy constraints demand optional capabilities rather than one compulsory life dashboard.

### What this build actually changes

The connected entry point starts with mail, calendars, tasks and file metadata. A source-linked proposal leads to an approved native draft/task/time block and a provider object read-back. A local task card is no longer presented as an external action. Existing optional life tools remain available, but are no longer prerequisites to using the connected workflow.

A draft is not a sent response. A new task is not resolved work. A personal time block is not a third-party appointment. A file link is not comprehension of the document. These distinctions belong in the interface and the product metrics.

### Distribution standard

A consumer must not create an OAuth developer project or paste a client secret. A future operator registers the applications once, completes provider requirements, runs secure hosting and offers a simple account consent flow. This ZIP is the local developer implementation, not that operated consumer service. No marketing claim should hide this remaining deployment work.

Start with one useful account, progressive permissions and one verified operation. Measure voluntary repeat use, observed completion, corrections, refusal rates, failures and genuinely measured time saved. Do not fabricate savings or optimize for unnecessary time inside the app. Accessibility and account isolation require real validation with intended users, not only responsive screenshots.

### Next capabilities must close real loops

Relevant draft generation requires a separate generative model, conversation context, native threading and review. Reliable follow-up needs durable synchronization, authorized notifications and external closure evidence. Subscription cancellation needs a supported service interface and explicit confirmation of cancellation. Household support needs separate identities, individual consent and object-level sharing. Administrative submissions need authentic documents, authorized endpoints and receipt semantics. Financial integrations need authorized providers, region coverage and carefully bounded consent; no autonomous transfers are implied.

None of those capabilities is implemented merely by describing it. The release criterion is a working provider-backed workflow with permission, failure and live-account tests, not an integration logo or an agent prompt.

The practical standard is simple: **existing information → fewer manual steps → an approved native result → an honest receipt.**
