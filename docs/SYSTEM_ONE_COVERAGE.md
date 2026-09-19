# System One — complete concept-to-implementation map

Scope: every substantive concept on the requested [System One page](https://docs.typesafe.ai/concepts/system-one), checked on 2026-09-19. This is original implementation documentation, not a reproduction of that page. Navigation links are references, not a claim that every product on every linked page has been implemented.

## English

System One is the typed-judgment layer in Essentiel, not the whole application. Jev supplies optional assessments; ordinary code and the person own the workflow. The name refers to Kahneman's fast/intuitive versus slower/deliberate distinction. It is not a claim that this application models a human mind. The product keeps externally consequential actions subject to explicit human approval; v0.3 performs only the narrowly approved native writes in the connected application.

| ID | Concept covered | Concrete integration and status | Evidence location |
|---|---|---|---|
| S01 | System One category; Jev implementation | Dedicated lab and native Jev adapter; no chatbot substitution | `public/systemone.js`, `lib/provider.mjs` |
| S02 | A supplied state is evaluated | Editable and previewed `state`, retained with each lab run; no implicit whole-workspace upload | `readLab`, `consentLab`, `executeLab` in `public/app.js` |
| S03 | Text, objects and arrays | All three root forms validated; presets include structured records and a list | `validateRequest`, `makeLabPresets`; workspace tests |
| S04 | No image/audio/video input | Source text and JSON only; document notebook is an index, not a media parser | Source file form, bounded JSON validator, README |
| S05 | Typed outputs, not generated text | Answer discriminator and complete request/response checks; reply template is separately labeled fixed text | `validateTypedAnswers`, `sourceReply` |
| S06 | Calibrated probabilities are not individual guarantees | Raw probabilities retained; observed labels and reliability bins; no quality number from fictional data | `evaluationMetrics`; live/fixture/imported provenance tests |
| S07 | Choice | Named alternatives, full distribution, selected maximum and reported confidence | Lab answer rendering, `/api/evaluate`, Choice tests |
| S08 | Score | Ordered descriptive rubric, weighted expectation, full level probabilities, legend and confidence | Lab plus optional decision assessments; Score tests |
| S09 | Noul | Probability of affirmative answer; no fabricated confidence | Noul display, review gates and response tests |
| S10 | Name and judgment/workflow distinction | This explanation and architecture keep the narrow classifier separate from planning and action | This document; `ARCHITECTURE.md` |
| S11 | Refund state: message, transactions and policy | Editable refund preset with a fictional transaction pair and stated policy | `makeLabPresets('en')[1]` |
| S12 | Independent refund questions together | Refund requested, duplicate indicated and policy support are separate Noul questions in one payload | Refund preset; native dry-run example `--refund` |
| S13 | Deterministic checks and routing | Exact transaction fields/amount checks plus typed judgments produce review/gather-evidence result | `refundChecks`; unit test |
| S14 | Inspect and compose typed answers | Inbox policy, lab review and separate per-option assessments; no executable text | `applyPolicy`, `reviewAnswers`, `decisionRequest` |
| S15 | Escalation to a person or reasoning system | Human review UI and JSON review-packet export; another model may receive the packet manually | Run details / packet export / next-step request |
| S16 | SDK or direct HTTP | Direct HTTP alternative implemented; SDK is documented as an alternative, not an extra installed runtime | `askJev`; primary API/SDK references below |
| S17 | Model selection, defaults and aliases | Server-side `JEV_MODEL`; pinned sample; configured vs actual identity shown; explicit metadata lookup | `.env.example`, `server.mjs`, settings |
| S18 | State/primitives preparation | Editable presets, structured criteria, validation before transmission, invalid-response rejection | Lab, contract module and tests |

“Covered” does not mean that every possible action described by the documentation is automatically executed. S15 is a working export/manual handoff, **not** an automatic reasoning-model connector. S13 intentionally does not refund money. The “fast” model category is represented architecturally; no latency or accuracy benchmark was performed.

### Complete primitive contracts

**Choice.** The editor accepts 2–255 named alternatives. The request contains `type`, `instructions` and a criteria map. Responses must contain the selected option, a probability for every alternative and confidence. The validator checks completeness, finite ranges, total probability and agreement with a maximum. Names/descriptions must distinguish alternatives; include an explicit unknown/other option where appropriate. Question IDs identify returned fields, not the semantic question itself. [Choice reference](https://docs.typesafe.ai/primitives/choice).

**Score.** The rubric is an ordered array of 2–10 self-contained descriptions. Its output is the expected index, not a percentage of success: `sum(index * probability)`. The complete distribution matters even when two outputs have the same mean. The native JSON legend/probability keys are strings. The validator checks bounds, expectation within a small rounding tolerance and exact rubric-to-legend correspondence. A normalized Score used in a composite remains a rescaled rubric value, not a probability. [Score reference](https://docs.typesafe.ai/primitives/score).

**Noul.** The value is a probability in `[0,1]` that the answer is affirmative. The question may provide descriptions for `true` and `false`. There is no additional `confidence` field. The interval between configured low/high gates routes to review; a value around 0.5 is not a “medium level” on a skill or suitability scale. [Noul reference](https://docs.typesafe.ai/primitives/noul).

Instructions and descriptions support text and structured JSON, with null descriptions where appropriate; unsafe JSON keys, excessive depth and unsupported shapes are rejected locally. Descriptions should express their meaning independently rather than refer to another answer. The generic editor does not guarantee that a user's rubric is well designed. [Structured descriptions](https://docs.typesafe.ai/primitives/advanced).

### Composition and real application behavior

Independent questions can share a request. A subsequent decision that depends on an earlier answer uses a separate request with explicit prior context and new observations. The “Next step” action prepares that second editable state; it does not claim questions in one request can read each other's outputs. [Building workflows](https://docs.typesafe.ai/concepts/how-to-build-with-system-one).

The refund example uses two supplied captured charges, matching order/currency/positive integer amount, distinct transaction IDs, and three separate text judgments. A matching pair does not establish the same service was charged twice; the outcome stays a human-review packet. Changing a charge or weakening one judgment changes routing. `refundExecuted` remains false in every branch. This is implemented application policy, not provider-provided financial authorization.

Confidence on Choice/Score is inspected as a distribution-derived statistic, not an independent probability of correctness. Lab defaults are local starter settings (`0.75`, Noul `0.15/0.85`), not validated universal thresholds. The inbox uses its separate conservative source-review policy. There is no auto-action threshold in either: `externalActionAllowed` is always false. [Confidence reference](https://docs.typesafe.ai/confidence).

Observed metrics include binary Brier score and reliability bins, categorical Brier/accuracy and Score mean absolute error. They only use human-labeled live runs. Synthetic and imported-unverified runs never count. Model filtering is available; question contracts, datasets and languages still need controlled separation for a valid evaluation. The limited local history is not a representative benchmark or a statistical calibration certification.

### Calling and operational handling

The adapter uses `POST https://api.typesafe.ai/v1/systemone` with Bearer authentication and the explicit `model`, `state`, `questions` shape. It retains returned answers/model/token usage, rejects malformed responses, bounds attempts and honors retry-after or refuses to retry when the requested wait exceeds its local budget. Model metadata uses a separate authenticated GET. [HTTP reference](https://docs.typesafe.ai/api).

The official SDK route is an alternative to that adapter, not a second prerequisite. Python documentation exposes `TypeSafeClient`, `Choice`, `Score`, `Noul` and `client.system_one(...)`; JavaScript has the official TypeSafe client. They are not installed or executed in this release. Native HTTP avoids an extra runtime dependency and keeps the consent boundary explicit. SDK adoption would require matching its typed return values to the native validator, particularly Score's level-key representation.

The configured model can be pinned or an alias. The shipped default is the documented `jev-1.13.0` at the review date; `jev-latest` and `jev-preview` can change. Actual returned identity, rather than a UI label, belongs with results. Costs/limits are provider-controlled and are not hardcoded as a permanent promise. English and French workloads require their own validation. [Models reference](https://docs.typesafe.ai/models).

## Français

La couverture S01–S18 ci-dessus relie chaque concept substantiel de la page demandée à un écran, un contrat, une fonction ou une limite explicitement documentée. Elle ne transforme pas tous les liens du site en fonctionnalités de ce produit.

Dans Essentiel, Jev reste un composant facultatif d’évaluation. Les tâches, montants, dates, dépendances, calculs et validations sont gérés par le code et la personne. Le lien historique du nom avec la distinction de Kahneman est expliqué ; aucune reproduction d’un esprit humain n’est prétendue.

| Ensemble | Présence dans l’application |
|---|---|
| S01–S05 : modèle, état et formats | Laboratoire System One, état chaîne/objet/tableau, validation des sorties, refus des médias ; aucun texte généré par Jev |
| S06–S10 : probabilités, primitives et rôle | Choice, Score et Noul, distributions visibles, observations manuelles, séparation entre évaluation et décision |
| S11–S14 : exemple de remboursement et composition | Message/politique/transactions, trois questions indépendantes, vérifications déterministes et orientation vers la revue |
| S15 : escalade | Revue humaine, export JSON et préparation d’un appel suivant ; pas de connexion automatique à un autre modèle |
| S16–S18 : appel, modèle et préparation | API HTTP native, clé serveur, modèle explicite, métadonnées sur demande, contrats et état modifiables |

Les résultats synthétiques servent seulement à vérifier le logiciel. Ils ne deviennent pas des mesures de qualité de Jev. Une classification proposée ou une probabilité élevée ne confirme ni une date, ni l’identité d’un expéditeur, ni une autorisation de paiement. Le dossier de remboursement peut être préparé, mais aucun remboursement n’est exécuté.

Le parcours réel est : saisir les faits → définir les questions → vérifier la transmission → autoriser l’appel facultatif → examiner la sortie typée → appliquer les contrôles locaux → prendre la décision humaine → conserver le résultat observé. Les exemples natifs sont dans `examples/native-system-one.mjs` ; sans `--send`, ils restent une validation locale du contrat et n’appellent pas TypeSafe.

## v0.3 connected-message bridge

The complete existing laboratory and the S01–S18 coverage remain at `/workspace`. The connected front page adds an optional message-text assessment through the existing `/api/analyze` adapter. The exact text can be redacted and requires a distinct TypeSafe consent. Model judgments never submit an external operation. `public/connected.js` renders the assessment separately; `lib/connected/service.mjs` owns previews, approvals and narrow provider writes. Draft templates are fixed editable text, not Jev generation. No TypeSafe key or live inference was used in this release's tests.
