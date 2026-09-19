## Retained OAuth behavior

Google can use an explicit Desktop or Web OAuth client. Web remains the compatibility
fallback when no type or client JSON is configured. Desktop uses an IP-literal loopback
callback and a one-use launch ticket to establish the browser cookie on the callback host.
A validated callback returns to the original local UI origin. Only top-level GET navigation
to the two HTML entry paths is exempted from the global cross-site guard; APIs remain protected.
The Google client JSON cannot override provider URLs. See `OAUTH_FIX.md`.
The runtime remains a local Node server and browser UI, not a packaged native executable.

# Architecture — Essentiel 0.3.2

## Deployment boundary

Single Node.js 22+ process; built-in HTTP server, native fetch, built-in crypto and filesystem. No npm runtime dependencies. One local user, one Google account, one Microsoft account. Provider credentials are configured by the operator; the account holder authorizes delegated access. Production entry point never imports `tests/connected-fixture.mjs`.

The service listens only on 127.0.0.1 and accepts localhost/loopback Host values. Static responses come from a fixed allowlist. Same-origin custom-header checks protect local API requests against ordinary cross-site browser calls, but are not authentication against another local process. OAuth callbacks are the intentional cross-site exception, protected by state, a single-use browser-bound cookie and PKCE. HTTP-origin matching, callback state handling and private-file denial have unit/integration coverage.

## Data flow

```text
Provider consent -> server-side token exchange -> optional encrypted vault
Provider reads -> normalized, bounded source snapshots -> browser display
Selected source -> editable form -> immutable action proposal + approval hash
Human approval -> fresh source/state/calendar checks -> official provider write
Returned provider object ID -> explicit GET read-back -> receipt/status
```

Optional TypeSafe branch: displayed source excerpt -> separate consent -> typed judgment -> displayed assessment. It has no execution authority.

Optional drafting branch: displayed source excerpt -> separate consent -> operator-configured drafting engine (OpenAI-compatible HTTP, local LLM, Claude Code or Codex CLI) -> validated `{draft, notes}` -> editable composer. It neither judges nor executes. Saving the draft still goes through the immutable preview, explicit approval and read-back above. Jev remains the only typed judge. Local workspace/laboratory share the main shell with connected views; their data stores remain separate.

## Modules

| Module | Responsibility |
|---|---|
| `server.mjs` | Fixed static routes, HTTP guards, connected API and legacy Jev endpoints |
| `lib/connected/common.mjs` | Validation, timezone conversion, free windows, safe links, text/MIME helpers, charset decoding, HTML-to-text, HTML entity decoding, formatted-mail sanitizer |
| `lib/connected/vault.mjs` | Memory store, optional scrypt + AES-GCM persistence, lock/unlock/erase |
| `lib/connected/oauth.mjs` | Provider config, scope mapping, PKCE/state/cookie, token refresh |
| `lib/connected/providers.mjs` | Fixed-origin Google/Graph requests, normalized reads and narrow writes |
| `lib/connected/service.mjs` | Snapshots, explicit selections, source binding, approvals, execution and receipts |
| `public/connected.js`, `public/connected-scoped.css` | Mountable bilingual connected views; scoped events and styles; no provider secrets |
| `lib/connected/provider-errors.mjs` | Allowlisted provider diagnostics and fixed Google console URLs |
| `public/app.js`, `public/core.js`, `public/systemone.js` | Existing local tools and System One lab |
| `lib/provider.mjs`, `lib/domain.mjs`, `lib/questions.mjs` | Existing TypeSafe adapter, typed validation, deterministic policy |
| `lib/drafter.mjs` | Optional drafting engines, several at once (`DRAFT_ENGINES`): OpenAI-compatible HTTP, Claude Code, Codex and agy CLI children; `{draft, notes}` validation; no judgment or write authority |
| `lib/ai-journal.mjs` | Local AI activity journal: exact Jev and drafting exchanges, redacted, memory-only ring buffer (300 calls) |

## Unified navigation

`/` and `/workspace` serve `public/index.html`. `app.js` controls the sole navigation, theme and language. Its local routes retain their existing data model. Connected routes mount `connected.js` inside `#connectedHost`; modals are scoped under `#connectedOverlays`. No iframe or document reload is used for section changes. `connected.html` remains a test/legacy component fixture, not the root page.

Canonical connected hashes are `#connected-inbox`, `#connected-calendar`, `#connected-tasks`, `#connected-files`, `#connected-actions`, `#connections`. Local manually added sources use `#sources` to avoid the old connected `#inbox` alias. Browser history and old entry paths are normalized without changing storage origin.

## Local API

All `/api/connected/*` calls require `X-Essentiel-Request: 1`. All POST calls also require the matching local Origin and JSON content type.

| Method and route | Purpose |
|---|---|
| GET `/api/connected/status` | Token-free provider status, snapshots, selections and operation records |
| POST `/api/connected/oauth/start` | Begin provider-specific authorization and set HttpOnly callback cookie |
| GET `/oauth/{google|microsoft}/callback` | Validate single-use state/browser binding and exchange code |
| POST `/api/connected/sync` | Bounded mail/calendar/task reads for one authorized account |
| POST `/api/connected/diagnostics` | One minimal authorized GET per service; safe report; no provider writes |
| POST `/api/connected/selection` | Select returned calendars and native task list |
| POST `/api/connected/message` | Fetch one known message's capped plain-text body (declared charsets decoded; sanitized HTML kept in memory for the formatted view) |
| GET `/mail-view/{google|microsoft}/{id}` | Formatted view of an opened message: sanitized HTML, served only as a same-origin frame (`Sec-Fetch-Dest: iframe`), own CSP `default-src 'none'` without scripts or remote images, framed with `sandbox` by the page |
| POST `/api/connected/files` | Native remote metadata search |
| POST `/api/connected/slots` | Fresh, bounded selected-calendar read and deterministic free-window calculation |
| POST `/api/connected/actions/preview` | Validate and retain immutable action payload/source binding |
| POST `/api/connected/actions/execute` | Exact explicit approval, checks, single external write, read-back |
| POST `/api/connected/actions/cancel` | Cancel a pending proposal only; not a remote undo |
| POST `/api/connected/actions/verify` | Re-read known provider object ID without issuing another write |
| POST `/api/connected/disconnect` | Remove local account data, not remote OAuth grant |
| POST `/api/connected/vault` | Unlock/persist, lock or explicitly erase local connected data |

The legacy `/api/config`, `/api/models`, `/api/analyze`, `/api/evaluate`, `/api/demo` routes remain. `POST /api/draft` returns an editable draft or summary from the optional drafting engine. It uses the same Origin, custom header, JSON, explicit consent and shared 2-concurrent / 60-per-minute limits as `/api/analyze`. `/api/config` describes the drafting engine (`engine`, `model`, `local`, `configured`) without its key, URL or command. Demo routes belong to legacy explicit fixtures; the connected page never silently calls them to populate an empty account.

## Operation state and guarantees

`pending -> executing -> verified | created_unverified | uncertain | rejected`; a preflight failure is `blocked`; an explicitly cancelled proposal is `cancelled`. Each approval binds an action ID, account binding, payload and source. Proposals expire after ten minutes. The server refuses duplicate execution of the same proposal and serializes external writes. Separate human-created proposals can still duplicate work; this is not globally exactly-once execution.

When persistence is enabled, the executing state is written before the provider request. A restart with an executing action yields uncertain status. With memory-only operation, process loss also loses the journal; the UI states that trade-off. File replacement uses a temporary file and rename, not a transactional database with power-loss durability certification. No distributed transaction spans Google, Microsoft and the local vault.

Read-back validates an object identifier and selected state conditions. It does not compare every payload field, confirm delivery or prove the user's underlying goal was met. A known object ID can be verified again. A lost write response without an ID requires checking the original service; no blind retry button exists.

For calendars, incomplete pagination, disappeared selected calendars, missing permissions or request errors stop availability confirmation. The algorithm considers only returned selected calendars. It cannot reserve across independent clients atomically, infer travel time, inspect unknown accounts or determine another person's availability.

AI log routes (same local guards: `X-Essentiel-Request`; exact Origin for POST):

| Method and route | Purpose |
|---|---|
| GET `/api/ai-log?after=<rev>` | Compact summaries created or changed after a revision; `epoch` changes when the log is cleared |
| GET `/api/ai-log/{id}` | One full entry: exact request, raw response, per-option probabilities, validation, CLI arguments/events, timing, tokens |
| GET `/api/ai-log/export` | All full entries as JSON |
| POST `/api/ai-log/clear` | Empty the journal |

`/api/analyze`, `/api/evaluate`, `/api/models` and `/api/draft` return an `aiLogId`. `/api/config.draft` lists the offered engines (`engines`, `default`) and keeps the legacy single-engine fields for the default.

## Storage separation

Connected vault: provider tokens, bounded source snapshots, selections, actions and technical diagnostics. Server memory only: the AI log and the sanitized HTML of the last 30 opened messages; both are cleared on lock, erase and account disconnect (and on restart). `.env`: operator application secrets, not vault-encrypted. Browser: optional local workspace storage uses the existing `essentiel.workspace.v2` key; the same workspace owns language/theme. Connected account content is not copied into that local workspace or its exports. Browser renders connected data from server snapshots; account tokens remain server-side. Provider: original objects and approved writes. TypeSafe: only separately consented text/state. Erasing the connected vault does not erase local workspace data, and erasing local workspace data does not remove provider objects.

## Diagnostics and failure states

`provider-errors.mjs` parses Google ErrorInfo/legacy reasons and Microsoft structured codes. It keeps an allowlist of fields; raw messages are inspected only for narrowly recognized cases and are not reflected. Console links are synthesized from known API identifiers. Consumer projects are taken only from structured `projects/<number>` metadata. Unknown reasons do not become guessed causes.

Sync retains per-service last-success timestamps and cached data, records the current errors and declares the attempt `ok`, `partial` or `failed`. A first read failure cannot create a successful zero count. Explicit probes are read-only and do not certify write access, all resources or future availability. Reports are persisted only when the existing vault persistence is enabled. Approval and uncertain-write rules are unchanged.

## Extension contract

A new connector needs fixed endpoint origins, explicit capability/scopes, typed normalization, visible coverage/pagination limits, consent setup documentation, bounded reads, an exact target preview, freshness checking, idempotency analysis, receipt semantics, failure tests and a real-account acceptance report. A logo, mock fixture, MCP tool schema or generic browser controller is not a completed connector.

A drafting engine is operator-configured in `.env`, never supplied by the browser. HTTP engines use https, or http on loopback only, with redirects refused. They need structured output validated locally, bounded responses and time, and fixed error messages that never reflect provider bodies. CLI engines run with `shell: false`, no tools, a fresh empty temporary directory, the prompt on stdin, an allowlisted environment, capped output and a kill on timeout. A reported tool attempt refuses the draft. A drafting engine never substitutes for a Jev answer and never gains write authority.

Before hosted/multiuser use, build authentication, tenant isolation, HTTPS deployment, managed secret encryption, session controls, background job durability, revocation lifecycle, abuse controls and production monitoring. None is implied by the local prototype.
