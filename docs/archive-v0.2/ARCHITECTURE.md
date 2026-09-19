# Architecture — Essentiel 0.2

## Ownership of decisions

User-entered facts → validated local records → ordinary deterministic engines → optional narrow System One request → typed-answer validation → visible suggestion/review → explicit human decision → local record or file export.

Nothing in the provider response is executable code, an authenticated sender, a consent grant or a confirmed external event. There is no external action executor. The product has no self-starting agent loop.

## Modules

| Path | Responsibility |
|---|---|
| `server.mjs` | Loopback-only HTTP service, static allowlist, request-origin controls, API routes, logical request caps |
| `lib/provider.mjs` | Native TypeSafe HTTP, key on server, bounded timeout/retry, model metadata |
| `lib/questions.mjs` | Nine independent inbox questions and source-based state |
| `lib/domain.mjs` | Original inbox policy, source fingerprinting, exact candidate passages and conservative date handling |
| `lib/demo.mjs` | Labeled synthetic source fixtures; no inference |
| `public/core.js` | Workspace normalization, graph validation, planning, recurrence, money, CSV/ICS, backup encryption |
| `public/systemone.js` | Generic Choice/Score/Noul validation, review gates, observations and refund checks |
| `public/catalog.js` | Original FR/EN life-domain and workflow catalog |
| `public/i18n.js` | Shared interface vocabulary and original inbox-policy display translations |
| `public/demo.js` | Labeled local demonstration tasks, money, lists, notes and decisions |
| `public/app.js` | Native browser views, forms, consent, mutations, file actions and user workflows |
| `public/styles.css` | Responsive light/dark design and reduced-motion support |
| `scripts/build-preview.mjs` | Dependency-free self-contained FR/EN preview bundler |
| `lib/contracts.d.ts` | Integration-facing type declarations, not a separate generated implementation |

The implementation uses native JavaScript ES modules. It is not a TypeScript build, React project or Electron installer. No npm runtime dependency is needed. Python/Playwright is optional validation tooling only.

## Data model and persistence

One schema-version-2 workspace contains language/display preferences, selected domains, explicit goals, tasks, routines, sources, financial records, lists, notes, decisions, evaluation runs and a bounded local activity history. Entity IDs are local UUIDs; they are not permissions. Task owners and document locations are human-entered labels.

Memory is the initial storage mode. Persistence opt-in writes `essentiel.workspace.v2` in the browser's localStorage. The Node server does not write a user database. Different browser profiles, origins or ports do not automatically share data. Multi-tab edits have no conflict protocol: use one active tab, export before changing origin, and treat localStorage clearing as data loss unless a backup exists.

Local mutations clone the previous workspace, normalize the candidate, append a bounded activity event and render. Invalid mutations revert to the prior workspace. Six undo states are held in memory. Erase removes the active storage entry, clears undo and draft state and replaces the workspace; exported files and external copies remain outside that deletion.

Imports validate structure, capacities, date formats, references, cycles, JSON keys and field lengths before replacement. External AI run history becomes `imported-unverified` and is excluded from quality observations. Imported source classifications, selected evidence and confirmed source dates return to unanalysed state. Imported manual task dates, amounts, chosen options and notes remain manual data. This is not cryptographic authenticity verification.

## Deterministic engines

**Planning.** An eligible task is open, available by the chosen date, not snoozed beyond it and unblocked. Ranking prioritizes overdue tasks, today's tasks, explicit priority and proximity; deterministic tie-breakers make the result inspectable. Useful capacity is available minutes minus the user-chosen percentage reserve. The planner greedily fits eligible tasks and keeps time/energy overflow visible. It is not a global optimization solver and does not know calendar availability.

**Dependencies.** IDs must exist; self-dependency and cycles are rejected. Completion requires resolved dependencies and completed checklist items. Done/cancelled predecessors resolve a dependency. A deleted predecessor cannot silently leave an invalid graph.

**Recurrence.** Daily/weekly/monthly/yearly tasks require a date. Completing one occurrence creates at most one next occurrence. The original monthly day is preserved when clamping short months. Missed dates advance to the next future occurrence rather than materialize an unbounded backlog. Routines are independently checked on chosen weekdays; they impose no streak score or penalties.

**Money.** Amounts are safe integer minor units. Supported currencies all use two decimal places in this application. Cashflow sums entered transactions for one month/currency. Subscription monthly equivalents are a separate estimate: weekly × 52/12, quarterly ÷ 3, yearly ÷ 12. Savings projections are simple target-gap/contribution arithmetic, not compound-interest forecasts. No implicit currency conversion exists.

**Decision matrix.** Each criterion has a weight, each option a human score or unknown, cost/currency and an explicit constraint gate. Complete weighted scores are separate from eligibility. Unknown constraints or over-budget options remain marked. A human may record a different choice with a reason. Jev's optional per-option/per-criterion scores are separate evaluation runs; they do not overwrite the matrix.

**Calendar.** ISO dates are validated for calendar correctness in years 2000–2099. ICS exports use all-day DTSTART and an exclusive next-day DTEND, escape text and fold UTF-8 lines. No event time, timezone, notification or meeting invitation is inferred.

## Optional model paths

Inbox: original source → bounded candidate passages/date options → nine independent Choice/Noul questions → validated answers → deterministic routing. Conditional, contradictory, sensitive or uncertain material is routed for review. Proposed source dates never become confirmed dates without human input. The inbox focuses on a primary request; it is not a complete thread or multi-request extractor.

Lab: reviewed state + independent questions → generic contract validation → `/api/evaluate` → TypeSafe → strict response validation → local run with supplied model identity and usage. All questions in a call see the same state. Dependent questions use a separate next-step request. Plain text is encoded as a JSON string in the editor. Binaries are unsupported, not automatically OCR'd.

Consent binds to the displayed snapshot. Workspace replacement, undo or erase advances a local generation counter; stale source/lab responses are discarded. A response for a deleted or modified source is ignored. A manual source decision made before/during an evaluation is retained. These protections do not retract data already transmitted or terminate a provider request.

## Routes

`GET /api/config` reports configuration presence without the key. `GET /api/demo?today=YYYY-MM-DD&lang=fr|en` returns labeled fictional records. `POST /api/analyze` accepts `{ item, goals, today, consent: true }`. `POST /api/evaluate` accepts `{ state, questions, consent: true }`. `POST /api/models` accepts `{ consent: true }` for model metadata only.

POST routes require JSON, exact same-origin Origin and `X-Essentiel-Request: 1`. The browser never supplies an arbitrary provider URL or provider key. The server supplies `model` and Bearer authentication for `POST https://api.typesafe.ai/v1/systemone`. There is no `/chat/completions` compatibility layer. See the [native API](https://docs.typesafe.ai/api).

## Application capacities, not provider promises

| Item | Local limit |
|---|---:|
| Sources / source batch | 200 retained / 40 per batch |
| Source text / extracted candidate passages / date choices | 8,000 characters / 80 / 20 |
| Tasks / routines | 2,000 / 100 |
| Transactions / subscriptions / savings goals | 2,000 / 200 / 100 |
| List entries / notebook entries / decisions | 2,000 / 500 / 100 |
| Evaluation runs / activity entries / budget entries | 100 / 500 / 240 |
| Lab questions / Choice options / Score levels | 32 / 255 / 10 |
| Serialized lab state / state+questions | 30,000 / 80,000 characters |
| HTTP request / plain JSON backup | 350,000 bytes / 8 MB |
| Concurrent provider calls / logical calls per minute | 2 / 60 |
| Provider timeout / maximum attempts | 20 seconds per attempt / 2 |

A 6-option × 6-criterion matrix exceeds the lab's 32-question cap. Reduce the matrix or explicitly split the request; there is no hidden automatic chunking or extra charge. Request character limits are not provider token counts. Retries can make HTTP attempt counts exceed logical request counts. Model metadata also uses the shared limiter. Review provider terms and metering separately.

## Extension protocol

Add a new domain with unique stable ID and both languages. Add workflows with explicit outcome and four editable steps, avoiding automatic dates or external promises. Add an engine only with validation, UI operations, exports, test cases and stated unknowns. Adding OAuth, external execution or multiuser sharing requires a separate permission/threat model, per-action consent, idempotency, result evidence, retry/reconciliation, revocation and audit work; none is silently supplied by this version.
