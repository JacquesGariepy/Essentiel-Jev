# Essentiel — Jev personal attention inbox

A runnable, local, single-user prototype that turns supplied text into an advisory attention queue. Its purpose is to help a person notice explicit requests, inspect their source, and keep control of the response.

**Status:** implemented prototype, not a validated autonomous assistant. Native TypeSafe integration is coded against the published HTTP contract. No authenticated Jev inference was performed during delivery. Demonstration answers are hand-authored and prominently marked synthetic.

## Start without credentials

Requires Node.js 22 or later. There are no runtime or build dependencies to install.

```sh
npm start
```

Open `http://127.0.0.1:8787` in a browser. Windows also has `start-windows.cmd`; macOS/Linux has `./start.sh`.

Without a key, the application shows eight synthetic scenarios. Importing your own text remains possible, but it stays **Non analysés**. There is no hidden heuristic pretending to be Jev.

`preview.html` is a self-contained demonstration with embedded CSS, JavaScript, and synthetic results. It can be opened as a file; it deliberately cannot perform live inference. Browser features such as downloads or persistence may be restricted in embedded viewers.

## Enable native Jev inference

Copy `.env.example` to `.env`, insert a **TypeSafe API key**, and restart the server.

```dotenv
TYPESAFE_API_KEY=YOUR_TYPESAFE_KEY
JEV_MODEL=jev-1.13.0
PORT=8787
```

This is the native TypeSafe endpoint, **not** an OpenRouter adapter. An OpenRouter key is not used by this implementation.

The key stays in the server process. The browser never receives it. After importing text, select **Analyser avec Jev**, inspect the transmission notice, and explicitly authorize that batch. Only new or failed documents are submitted; built-in synthetic examples are not replayed as live tests. To analyze example text with Jev, import `examples/import-example.json` or paste it as a new document.

Each document is sent in a separate request with nine independent typed questions. Imported source metadata and user-declared priorities are also sent. Do not submit private third-party information without the appropriate rights. This application does not negotiate or verify provider retention terms or zero-data-retention settings.

The adapter uses `POST https://api.typesafe.ai/v1/systemone` with `model`, `state`, and `questions`, then validates the typed `answers` response. The model ID is pinned rather than using an evolving `latest` alias. See the primary sources below.

## Implemented behavior

- Paste text, or import UTF-8 `.txt`, `.md`, and `.json` documents; at most 40 records in a workspace and 8,000 characters per record.
- Identify a primary requested action, whether it remains pending, document category, relevant source passage, candidate ISO date, time constraint, sensitive-request signal, manipulation signal, and explicit priority match.
- Route records to **À traiter**, **À vérifier**, or **À lire**. Only an explicit human choice moves a record to **Classés**. All records remain accessible under the all-documents view.
- Copy source passages from a closed set of original spans. This prevents invented quote strings, not wrong selections or untruthful sources.
- Treat an unresolved date, inconsistent judgments, an incomplete response, or low certainty as a review condition. Confidence thresholds are provisional policy settings, not measured accuracy.
- Let the user correct the bucket, confirm a date, export a date-only `.ics` reminder, and edit a static reply template. Nothing is sent and no calendar is modified automatically.
- Search, filter, sort, inspect raw model answers, and export sources and decision history as JSON.
- Detect exact duplicate text. This is not semantic deduplication.
- Keep state in memory by default. Browser persistence is opt-in and not encrypted by this application. Explicit erasure clears application state and its browser-storage key, not exported files or provider-side copies.

Importing a JSON export restores source documents as **not analyzed**. It deliberately does not trust imported judgments, executable fields, or prior labels as fresh verified results.

## What is not implemented

No Gmail, Outlook, calendar, bank, school-portal, browser-extension, or phone connector; no email sending, payments, automatic notifications, or background scheduling; no generative model; no PDF/OCR/audio processing; no conversation-thread resolution; no extraction of every request in a multi-request document; no semantic cross-document deduplication; no encrypted database, user authentication, shared workspace, or signed audit log.

The app examines **one primary request in one supplied document**. It may miss secondary requests. It does not know about later cancellations unless those are in the supplied text. Sender identities and source assertions are not authenticated.

Only unambiguous literal `YYYY-MM-DD` candidates from years 2000–2099 are eligible for automatic date selection. Relative and other date formats require manual verification. Reminder exports are all-day calendar events, not time-zone-aware timed appointments and not guaranteed notification alarms.

The interface and server can run locally; **live Jev inference is remote**. The application is bound to `127.0.0.1` and is not a public multi-user service. Do not expose this prototype to a network without an authentication, authorization, storage, and threat-model redesign.

## Tests

```sh
npm test
```

36 Node tests cover schema validation, deterministic dates, conservative routing, provenance, error handling, mocked HTTP requests, consent, origin/host checks, and static-file restrictions. These are software tests, not model-quality benchmarks.

An optional offline browser harness is included:

```sh
python tests/browser-check.py
```

It requires an existing Python Playwright installation and a Chromium executable (`CHROMIUM_PATH` can override its path). It performs 12 DOM checks, including responsive layout, manual classification, and export payload generation. Browser storage and download transport are test doubles. It does not navigate to a live provider, save through the operating-system download dialog, or import into a calendar application. See `docs/VALIDATION.md`.

Rebuild the self-contained preview with:

```sh
npm run preview
```

## Source layout

```text
server.mjs               Local HTTP server; explicit transmission consent
lib/domain.mjs           Validation, candidate construction, deterministic policy
lib/questions.mjs        Nine typed Jev questions and closed answer sets
lib/provider.mjs         Native HTTP adapter, timeout, bounded retry, safe errors
lib/demo.mjs             Hand-authored examples, never a fallback for live data
public/                  French responsive UI; no external scripts or fonts
examples/                Importable source text without fabricated evaluations
tests/                   Node tests and an optional offline DOM harness
scripts/                 Self-contained preview builder
START_HERE.md            Agent handoff and invariants
```

## Primary sources consulted, 19 September 2026

The implementation is original application code. These references define the external model contract and its limitations, not proof that this particular application is accurate:

- [TypeSafe introduction](https://docs.typesafe.ai/introduction): typed decisions rather than generated prose.
- [HTTP API](https://docs.typesafe.ai/api): native endpoint, request/response shapes, errors.
- [Choice](https://docs.typesafe.ai/primitives/choice): closed options and returned distributions.
- [Confidence](https://docs.typesafe.ai/confidence): certainty is derived from answer distributions.
- [Models](https://docs.typesafe.ai/models): version identifier, text inputs, language and hosting characteristics.
- [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13): arithmetic, date comparisons, adversarial inputs, and generation limitations.
- [Pre-parsed extraction](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook): selecting candidates and copying original values.
- [OpenRouter listing](https://openrouter.ai/typesafe/jev-1.13): user-referenced distribution channel; not the protocol implemented here.
