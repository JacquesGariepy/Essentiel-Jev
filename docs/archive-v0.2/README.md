# Essentiel 0.2 — Your life. Your choices.

A local, bilingual daily workspace: capture what matters, turn it into manageable actions, organize everyday information, compare decisions, and inspect optional typed AI assessments. **The everyday tools work without an API key.** The application does not read accounts or execute external actions.

[Français](README.fr.md) · [Agent handoff](START_HERE.md) · [System One coverage](docs/SYSTEM_ONE_COVERAGE.md) · [Validation](docs/VALIDATION.md)

## Run the application

Node.js 22 or later is required. There are no npm runtime dependencies and no package installation step.

```sh
cd essentiel-jev
npm start
```

Open `http://127.0.0.1:8787`. On Windows, `start-windows.cmd` starts the same server; on Linux/macOS use `sh start.sh`. Keep the terminal running. Stop the server with Ctrl+C. The Windows/macOS launchers are included but were not executed on those operating systems during this delivery.

The server-hosted application starts with an empty workspace. Load explicitly marked fictional examples from Today or Settings to explore. Choose FR/EN in the header. Workspaces are held in memory initially: export before closing, or explicitly enable browser persistence in Settings. Browser persistence is not encrypted.

For immediate exploration, open `preview-fr.html` or `preview-en.html`. These are self-contained functional previews with fictional examples and **no real provider calls**, even when a key exists elsewhere. Use the localhost application for canonical daily use and real TypeSafe requests. File-origin persistence and cryptography depend on the browser; they are not a substitute for a verified backup.

## What is implemented

| Area | Working operations | Boundary |
|---|---|---|
| Today | Quick capture, capacity-based day plan, selected priorities, focus timer, routine completion | No invented availability, automatic task completion or closed-app notifications |
| Tasks and calendar | Create/edit/delete, checklists, dependencies, owner/project labels, dates, recurrence, snooze, filters, week view, CSV/ICS export | Owner labels do not assign work to someone else's account; calendars are not synchronized |
| Life spaces | 28 optional domains, 112 bilingual editable four-step workflows, six starting profiles | Templates create local tasks after confirmation, not external service integrations |
| Money | Manual income/expenses, separate currencies, monthly spending limits, subscriptions, arithmetic savings projections, CSV | No bank connection, tax filing, investment advice or movement of money |
| Meals and lists | Shopping, pantry, meals, packing and custom lists; explicit meal ingredients can be added to shopping | Quantities, dietary restrictions and actual purchases remain yours to verify |
| Decisions | Weighted human score matrix, explicit constraints and budgets, unknown states, personal selection and outcome notes | Optional Jev assessments never replace human scores or authorize a purchase |
| Notebook | Notes, contact records, document-location index, possessions, journal entries, ideas, local search, follow-up tasks | No binary attachments, password vault, remote contact access or secure document repository |
| Attention inbox | Original text, exact excerpts, proposed classification and dates, human review, fixed editable reply template, linked task | No email account connection or message sending; source text does not authenticate a sender |
| System One | Native Choice, Score and Noul contracts; structured state editor; consent preview; distributions, model, usage, review packets and observed labels | No generated prose, code or reasoning explanations; no automatic fallback to another model |
| Data and display | French/English UI, light/dark, larger text, reduced motion, opt-in storage, JSON/CSV/ICS, encrypted backup export, import, undo, erase | No cloud account, shared workspace, synchronization or production-grade multiuser security |

Every workflow has an original title, four concrete actions and an intended observable result, in both languages. The complete catalogs are in [Human needs — English](docs/HUMAN_NEEDS_EN.md) and [Besoins — français](docs/HUMAN_NEEDS_FR.md). They are an extensible product taxonomy, not evidence that every human has identical needs or will adopt the product.

## Practical starting paths

**Handle a message.** Attention inbox → Add source → paste text or load `.txt`, `.md`, or a JSON source batch → save locally. Optional Analyze with Jev shows the exact transmission and asks consent. Open the result, compare the selected passage with the original, choose a classification and confirm a date yourself. Create a linked task or export an all-day calendar event. A draft is an editable fixed template, not a Jev-generated answer; sending it happens outside Essentiel.

**Make a day fit.** Capture actual tasks, add duration, priority, dependencies and your own dates. Today → Build my day → enter real available minutes, self-reported energy and a reserve. The deterministic planner fills available capacity and leaves overflow visible. It neither deletes overflow nor invents a commitment. A completed recurring task creates the next occurrence; missed occurrences are not multiplied into a backlog.

**Organize one part of life.** Life spaces → choose a domain → open one workflow → edit its four steps → optionally set a first date and dependencies → confirm. A blank first date creates undated tasks. Durations are editable estimates, not measurements. Select only useful spaces or create tasks and notes for needs outside the catalog.

**Review money.** Enter or import actual income and expenses in CAD, USD, EUR or GBP. Use one currency at a time. Add subscriptions separately; their monthly equivalents are estimates and are not deducted again from entered cash movements. Enter a savings target, existing savings and a planned monthly contribution; the projection assumes no interest, inflation or return.

**Compare choices.** Decisions → create at least two options, descriptive criteria, weights and your constraints. A blank score stays unknown. Confirm each option's constraint status and costs. Inspect the weighted result, then record your own choice. The matrix can display an ineligible choice without hiding why it is ineligible; choosing it does not purchase anything.

**Keep control of data.** Settings → inspect storage mode → export a backup. An encrypted export asks for a passphrase of at least 12 characters, entered twice. Keep it outside the file; there is no recovery service. Imports replace rather than merge after validation and confirmation. Imported source AI classifications and date approvals are invalidated; manual task data remains manual. Exported copies are not deleted when the local workspace is erased.

## Optional native Jev connection

The runtime uses the documented TypeSafe HTTP interface, not a speculative OpenRouter chat adapter. See the [API](https://docs.typesafe.ai/api) and [models](https://docs.typesafe.ai/models) documentation. Model selection is explicit; this release's `.env.example` pins `jev-1.13.0`, the version documented when checked on 2026-09-19. Provider availability, prices and limits must be checked at use time.

Copy `.env.example` to `.env` beside `server.mjs`, then edit it:

```dotenv
TYPESAFE_API_KEY=your_typesafe_key
JEV_MODEL=jev-1.13.0
PORT=8787
```

Restart `npm start`. The browser displays configured/not configured; configured means only that a server-side key is present, not that a paid inference has succeeded. The key is not sent to the browser. Native requests require an explicit user confirmation for the displayed payload. Settings also provides an explicit model-metadata lookup.

In System One, choose a preset, edit the JSON state and independent questions, then validate and review transmission. `state` may be a string, object or array. The lab supports Choice with 2–255 options, Score with 2–10 descriptive levels, and Noul. Its “fixture” button produces clearly synthetic uniform answers for testing layout; it is not offline AI. A dependent next-step question is a separate user-reviewed request. A review packet can be exported to a human or manually supplied to another system; there is no connected reasoning-model executor.

The English interface and English examples do not establish equivalent French/English model accuracy. TypeSafe documents language differences; validate your own content separately. No live TypeSafe inference or language benchmark was performed for this release.

## Import/export contracts

Source batch: JSON array or `{ "records": [...] }`, up to 40 documents per import, each with `title`, `text`, optional `source` and `receivedAt`. Maximum source text: 8,000 characters. Exact normalized duplicate texts are skipped within source batch import. Binary documents are not parsed. `examples/import-example.json` contains fictional French sources; `examples/import-example-en.json` contains English sources.

Transactions: exact headers below, positive decimal amount, `income` or `expense`, ISO date. Import is append-only after confirmation; importing the same financial CSV twice creates duplicates.

```csv
title,direction,amount,currency,date,category
Groceries,expense,42.10,CAD,2026-09-19,Food
```

ICS exports are all-day events from manually supplied/confirmed dates, without guessed timezones or event times. They are files, not calendar writes. User-authored text is preserved when changing UI language; it is not machine-translated.

## Verification and limits

```sh
npm test
npm run preview
# Optional development-only Python + Playwright tooling:
python tests/browser-check.py
python tests/browser-privacy.py
# Native request example; prints a validated payload without sending:
node examples/native-system-one.mjs
```

The delivered evidence records **77 passing Node tests, 34 browser workflow checks and 4 browser race-condition checks**. Browser content was injected offline because managed Chromium blocked URL navigation; storage/download/fetch test doubles are identified in the reports. Real local Node HTTP tests cover the server with mock upstreams. These are implementation checks, not Jev accuracy, accessibility certification, security certification, Windows installation validation or product-market-fit evidence.

Do not expose this server to the Internet or a shared network. There is no application login or tenant isolation. Use one tab and one active writer: multi-tab concurrent edits are not coordinated. The app has bounded local capacities; JSON backups are limited to 8 MB. Its displayed local request limits are application safety settings, not a provider quota or a monetary billing cap. Refer to [Architecture](docs/ARCHITECTURE.md), [Security](docs/SECURITY.md), and [Validation](docs/VALIDATION.md).
