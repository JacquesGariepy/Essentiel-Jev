# Rédaction assistée par LLM — API, modèle local, Claude Code, Codex ou agy

Français · [English](LLM-DRAFTING.md)

Essentiel sépare **juger** et **rédiger** :

- **TypeSafe Jev juge.** Il renvoie des réponses typées Choice / Score / Noul avec probabilités et confiance, que le code local valide. C'est le seul juge typé de l'application.
- **Un LLM facultatif rédige.** Il propose un brouillon de réponse modifiable ou un court résumé d'un message. Il ne juge pas, n'approuve pas, n'envoie rien et ne crée rien.
- **Vous décidez.** Le brouillon arrive dans le formulaire habituel. L'enregistrer comme vrai brouillon dans la messagerie exige toujours l'aperçu exact et votre approbation explicite, suivis d'une relecture.

La rédaction est désactivée par défaut. Les jugements Jev et les outils connectés fonctionnent sans elle. Chaque appel de rédaction, comme chaque appel à Jev, figure dans le **journal IA** avec ses invites, arguments et sortie brute exacts (voir [plus bas](#le-journal-ia)).

## Choisir un moteur

Configurer les moteurs dans le fichier `.env` du serveur, puis relancer `npm start`. Le navigateur ne fournit jamais d'URL, de clé ni de commande.

**Plusieurs moteurs à la fois.** `DRAFT_ENGINES=auto` propose chaque moteur réellement disponible : les exécutables Claude Code, Codex et agy trouvés dans le `PATH` (résolus sans shell ; les enveloppes `.cmd`/`.bat` sont ignorées), plus `openai` si `LLM_BASE_URL` et `LLM_MODEL` sont définis. `DRAFT_ENGINES=claude,codex,agy,openai` les énumère explicitement, dans l'ordre. Le premier moteur configuré est celui par défaut ; la fenêtre de consentement permet d'en choisir un autre pour chaque brouillon, et chaque brouillon indique le moteur qui l'a écrit. Un seul `DRAFT_ENGINE=…` fonctionne toujours.

| Moteur | Identifiant | Réglages | Où va le texte |
|---|---|---|---|
| API compatible OpenAI (OpenAI, OpenRouter, Mistral, Groq…) | `openai` | `LLM_BASE_URL` (https), `LLM_API_KEY`, `LLM_MODEL` | Le fournisseur configuré |
| LLM local (Ollama, LM Studio, llama.cpp, vLLM) | `openai` | `LLM_BASE_URL` sur `127.0.0.1` / `localhost` / `[::1]`, `LLM_MODEL`, généralement sans clé | Reste sur cet ordinateur |
| CLI Claude Code | `claude` | Facultatif : `CLAUDE_COMMAND`, `CLAUDE_MODEL`, `CLAUDE_MAX_BUDGET_USD` | Anthropic, via votre connexion Claude Code |
| CLI Codex | `codex` | Facultatif : `CODEX_COMMAND`, `CODEX_MODEL` | OpenAI, via votre connexion Codex |
| CLI agy (Antigravity) | `agy` | Facultatif : `AGY_COMMAND`, `AGY_MODEL` | Google, via votre connexion agy |

### API compatible OpenAI ou LLM local

Le point d'accès doit offrir `POST {LLM_BASE_URL}/chat/completions` et accepter `response_format: {type: "json_schema"}` (sortie structurée). Vérifier la documentation du serveur. Si le serveur ignore le schéma, la réponse est tout de même validée localement et refusée si elle n'est pas le JSON attendu.

```ini
# Ollama (après : ollama pull llama3.2)
DRAFT_ENGINE=openai
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL=llama3.2

# LM Studio : démarrer d'abord son serveur local
# LLM_BASE_URL=http://127.0.0.1:1234/v1
# llama.cpp llama-server : http://127.0.0.1:8080/v1
# vLLM (vllm serve) : http://127.0.0.1:8000/v1

# Exemples d'API hébergées (avec la clé du fournisseur)
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_BASE_URL=https://openrouter.ai/api/v1
# LLM_BASE_URL=https://api.mistral.ai/v1
# LLM_BASE_URL=https://api.groq.com/openai/v1
# LLM_API_KEY=...
```

Le `http` simple n'est accepté que pour les adresses de bouclage. Une URL contenant des identifiants, une requête ou un fragment est refusée. Sans `LLM_API_KEY`, aucun en-tête `Authorization` n'est envoyé. Les redirections sont refusées.

### Claude Code

Installer Claude Code et s'y connecter une fois dans un terminal (`claude`). Puis :

```ini
DRAFT_ENGINE=claude
# CLAUDE_COMMAND=C:\Users\vous\.local\bin\claude.exe   # défaut : claude.exe (Windows) / claude
# CLAUDE_MODEL=sonnet                                   # défaut : modèle par défaut de Claude Code
# CLAUDE_MAX_BUDGET_USD=0.50                            # plafond facultatif par requête (facturation par clé API)
```

Essentiel l'exécute ainsi. Les options ont été vérifiées avec `claude --help` pour Claude Code 2.1.278 :

```text
claude -p --output-format json --json-schema <schéma du brouillon> --tools "" --restricted --safe-mode
       --strict-mcp-config --no-session-persistence --disable-slash-commands
       --permission-mode dontAsk --system-prompt <règles fixes de rédaction> [--model …] [--max-budget-usd …]
```

- `--tools ""` retire tous les outils intégrés.
- `--restricted` ignore les fichiers de réglages utilisateur, projet et local, ainsi que leurs hooks.
- `--safe-mode` désactive les personnalisations : vos fichiers `CLAUDE.md`, la mémoire, les compétences, plugins, hooks, agents personnalisés et styles de sortie.
- `--strict-mcp-config` sans `--mcp-config` ne charge aucun serveur MCP.
- Le texte du message passe par **l'entrée standard**, jamais par la ligne de commande.
- La connexion existante est réutilisée via `CLAUDE_CONFIG_DIR` s'il est défini, ou via l'emplacement par défaut. `ANTHROPIC_API_KEY` est transmis s'il est défini.

### Codex

Installer Codex et s'y connecter une fois (`codex login`). Puis :

```ini
DRAFT_ENGINE=codex
# CODEX_COMMAND=C:\chemin\vers\codex.exe   # défaut : codex.exe (Windows) / codex
# CODEX_MODEL=gpt-5                       # défaut : modèle par défaut de Codex
```

Les options ont été vérifiées avec `codex exec --help` et `codex features list` pour codex-cli 0.154.0 :

```text
codex exec --sandbox read-only --ephemeral --skip-git-repo-check --ignore-user-config --ignore-rules
      --disable shell_tool --disable multi_agent --disable plugins --disable hooks --disable apps
      --disable browser_use --disable computer_use --disable in_app_browser --disable image_generation
      --disable view_image -c web_search="disabled" --output-schema <tmp>/schema.json
      -o <tmp>/last-message.json -C <tmp> --json --color never [-m …] -
```

Avec `--ignore-user-config`, votre `config.toml` (modèle par défaut, serveurs MCP, profils) n'est pas chargé. L'authentification utilise toujours `CODEX_HOME`. Définir `CODEX_MODEL` pour imposer un modèle. `--dangerously-bypass-approvals-and-sandbox` n'est jamais utilisé.

### agy (Antigravity)

Installer agy et s'y connecter une fois. Puis ajouter `agy` à `DRAFT_ENGINES` (ou `DRAFT_ENGINE=agy`) :

```ini
DRAFT_ENGINES=auto
# AGY_COMMAND=C:\Users\vous\AppData\Local\agy\bin\agy.exe   # défaut : agy.exe (Windows) / agy, trouvé dans le PATH
# AGY_MODEL=                                                   # défaut : modèle par défaut d'agy
```

Les options sont celles qu'ORIGIN a vérifiées avec agy 1.2.7 :

```text
agy --input-format stream-json --output-format stream-json --json-schema <schéma du brouillon>
    --print-timeout 2m --sandbox [--model …]
```

Les règles de rédaction et le message partent sur une seule ligne d'entrée standard, `{"event":"user","message":{"content":…}}`. Le brouillon est lu dans l'événement final `result` (`status: "SUCCESS"`, `structured_output`). agy 1.2.7 livre la sortie du schéma par son outil terminal intégré `finish` : exactement cette étape (outil et description d'outil `finish`, sans sous-agent) est acceptée, et **tout autre outil ou sous-agent fait refuser le brouillon et arrête le processus**. `--dangerously-skip-permissions` n'est jamais utilisé. Seuls `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GEMINI_API_KEY` et `GOOGLE_API_KEY` s'ajoutent à l'environnement filtré.

## Ce qui est transmis, exactement

Après **Proposer une réponse** ou **Résumer** dans un message, un aperçu montre le texte qui sera transmis. Vous pouvez en retirer ce que vous voulez. Rien ne quitte le serveur avant la case de consentement. La requête contient uniquement :

1. les règles fixes de rédaction (la source est une donnée non fiable, ne rien inventer, renvoyer `{draft, notes}`) ;
2. la consigne de tâche (réponse ou résumé, en français ou en anglais) ;
3. votre consigne facultative (500 caractères au maximum) ;
4. l'extrait modifié (8 000 caractères au maximum), placé entre `<<<SOURCE` et `SOURCE>>>`.

Essentiel n'ajoute aucun autre message, pièce jointe, calendrier, tâche, jeton OAuth ni résultat Jev.

**Ce que les CLI ajoutent d'eux-mêmes.** Cela fait partie du CLI, pas d'Essentiel, et ne peut pas être désactivé avec une connexion par abonnement (le mode `--bare` de Claude Code le retire, mais exige `ANTHROPIC_API_KEY`). Ces informations vont seulement au fournisseur auquel vous êtes connecté. Observé sur ce poste le 2026-09-19 :

- **Claude Code** (même avec `--safe-mode`) : l'**adresse courriel** du compte connecté, le système d'exploitation, la date et le chemin du dossier de travail temporaire, qui contient votre nom d'utilisateur Windows.
- **Codex** : le chemin du dossier de travail temporaire, le shell, la date et le fuseau horaire. Aucun compte ni adresse courriel.

- **agy** (question posée directement le 2026-09-19, agy 1.2.7) : le système d'exploitation, le shell, les chemins de ses dossiers de données et de travail (qui contiennent votre nom d'utilisateur Windows), l'heure locale avec son décalage horaire, le nom du modèle, et une liste d'environ 57 outils (fichiers, commandes, sous-agents). ORIGIN et Essentiel n'acceptent de lui aucun usage d'outil, sauf l'étape terminale `finish`.

Comme un modèle pourrait en déduire votre nom, les règles de rédaction interdisent d'ajouter un nom ou une signature absents de votre consigne ; le brouillon utilise `[signature]` à la place.

## Ce qui revient

Le moteur doit renvoyer `{"draft": chaîne, "notes": chaînes[]}`. Le brouillon est limité à 6 000 caractères. Il y a au plus 5 notes, de 300 caractères chacune au maximum. Un champ supplémentaire, un appel d'outil ou un JSON invalide est refusé, et rien n'est substitué. Le brouillon s'affiche dans le formulaire modifiable, étiqueté « Brouillon rédigé par <moteur> ». Les notes signalent ce qu'il faut vérifier. Un résumé s'affiche à côté du message et n'est jamais enregistré chez un fournisseur.

## Modèle de sécurité

- **Contrôles :** `POST /api/draft` applique les mêmes contrôles que les routes Jev : Origin locale exacte, `X-Essentiel-Request`, JSON, `consent: true` explicite. Il partage les limites de 2 requêtes simultanées et de 60 par minute.
- **Aucun secret vers le navigateur :** la configuration est lue uniquement dans l'environnement du serveur. `/api/config` expose, pour chaque moteur proposé, son identifiant, le libellé du modèle, un indicateur « local » et l'état configuré, ainsi que le moteur par défaut. Il n'expose jamais de clé, d'URL ni de chemin de commande. `/api/draft` n'accepte qu'un moteur proposé par le serveur.
- **Réponses HTTP :** limitées à 2 Mo. Délai de 110 s côté serveur ; le navigateur attend jusqu'à 125 s. Les corps de réponse du fournisseur et la sortie d'erreur des CLI ne sont jamais affichés ; les erreurs utilisent des messages et codes fixes comme `DRAFT_PROVIDER_ERROR`, `DRAFT_INVALID` et `DRAFT_TOOL_USE`.
- **Processus CLI :**
  - Ils sont lancés avec `shell: false`, dans un dossier temporaire neuf et vide, supprimé ensuite.
  - L'invite passe par l'entrée standard.
  - L'environnement est limité à une liste fixe : chemins système, profil, dossiers temporaires, langue, proxy, plus `CLAUDE_CONFIG_DIR` / `ANTHROPIC_API_KEY` pour Claude Code, `CODEX_HOME` / `OPENAI_API_KEY` pour Codex, ou les variables Google/Gemini ci-dessus pour agy. `TYPESAFE_API_KEY`, les secrets OAuth et `LLM_API_KEY` ne sont pas transmis.
  - La sortie est plafonnée, et un délai dépassé arrête le processus.
  - Toute tentative d'outil signalée fait refuser le brouillon : refus de permission Claude Code, sous-agents ou requêtes web, tout élément Codex autre qu'un message ou un raisonnement, ou toute étape d'outil ou de sous-agent agy autre que `finish`.
- **Limite honnête :** observer un événement d'outil signalé n'empêche pas son premier effet. Claude Code ne reçoit aucun outil. Pour Codex, l'outil shell est désactivé et le bac à sable est en lecture seule. agy annonce ses outils au modèle et s'exécute avec `--sandbox` ; le brouillon est refusé et le processus arrêté à la première étape d'outil signalée. Faire tourner le serveur sous votre propre compte, sur une machine de confiance.

## Le journal IA

Le **journal IA** des outils connectés liste en direct chaque appel de rédaction et chaque appel à Jev, du plus récent au plus ancien. Pour un brouillon, il montre le moteur, la consigne système et le message exacts, le corps de la requête HTTP ou le nom, les arguments et l'entrée standard du CLI, ses événements, la sortie standard et les erreurs, la sortie brute, le brouillon et les notes validés, le motif d'un refus, la durée, les jetons et le coût déclaré par le CLI, ainsi que ce que ce CLI ajoute de lui-même (ci-dessus). La sortie brute du moteur, que les erreurs de l'API ne reflètent jamais, y est visible, localement. Le journal reste dans la mémoire du serveur seulement (300 derniers appels), n'est jamais écrit sur disque, et se vide au verrouillage ou à l'effacement du coffre, à la déconnexion du compte dont venait le message, avec **Vider le journal** et au redémarrage. Les clés et jetons sont masqués avant stockage ; les chemins temporaires absolus sont remplacés par `<temp dir>`.

## Limites

- Un brouillon peut être faux, incomplet, mal ajusté ou inventer des détails avec assurance. Le relire avant de l'enregistrer. Les marqueurs comme `[à confirmer]` signalent une information manquante.
- Un seul message est utilisé, jamais le fil complet. Le rattachement au fil Outlook du brouillon enregistré n'est toujours pas garanti.
- Les tests de cette version utilisent des réponses HTTP synthétiques et des processus de substitution. Les options des CLI ont été vérifiées sur ce poste avec des invites triviales et non personnelles (Claude Code 2.1.278, codex-cli 0.154.0, agy 1.2.7). L'adaptateur compatible OpenAI n'a **pas** été exécuté contre un vrai serveur. Aucun vrai message n'a été rédigé pendant les tests.
- Les frais et conditions sont ceux de votre fournisseur ou abonnement. Essentiel n'en ajoute aucun et n'en mesure aucun.
