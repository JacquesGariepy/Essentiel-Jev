# Unreleased — TypeSafe + LLM drafting

- **AI log (full transparency):** a live view of every TypeSafe Jev call and every drafting-engine call: exact requests (state, questions, prompts, CLI arguments and stdin), raw responses, per-option probability bars, validation verdicts, applied bucket, HTTP status, latency, tokens, CLI events/stderr and what each CLI adds on its own. Copy, export, filter and clear. Memory only (300 calls), redacted, cleared on lock, disconnect and restart. `GET /api/ai-log`, `GET /api/ai-log/{id}`, `GET /api/ai-log/export`, `POST /api/ai-log/clear`; "View in AI log" links after each Jev assessment and draft.
- **Several drafting engines at once:** `DRAFT_ENGINES=auto` (CLIs found on PATH + openai when configured) or an explicit list; pick the engine per draft in the consent dialog; each draft is labeled with its engine. New **agy (Antigravity)** engine (sandboxed, schema-enforced, only its terminal `finish` step accepted). `DRAFT_ENGINE` still works.
- **Mail display:** Gmail parts decoded with their declared charset (iso-8859-1 / windows-1252 accents fixed); HTML-only mail keeps paragraphs, lists and line breaks; named and numeric character references decoded; blank-line runs collapsed; links shown as their text. Optional **Formatted** view: sanitized HTML in a sandboxed frame with its own strict CSP (no scripts, forms or remote images/tracking pixels). Consent previews still send plain text.
- Tests: `tests/ai-journal.test.mjs` (10), `tests/draft-engines.test.mjs` (5), `tests/mail-display.test.mjs` (4). Full suite: 186 of 188 pass locally; the 2 failures are the existing Windows `localhost`→`::1` Google Desktop tests.
- agy 1.2.7 was checked live with one neutral prompt (a draft, and a question about its own context); Claude Code and Codex as before. No real message was drafted and no live TypeSafe call was made.

- README (EN) and README.fr.md now lead with TypeSafe + AI: a new title and tagline, then **Why TypeSafe + AI**, which covers:
  - what Jev's typed judgments bring, grounded in docs.typesafe.ai and the local validators;
  - what a generative LLM brings;
  - how judging, writing and approved actions fit together.
  Version history moved lower in both READMEs.
- Optional drafting engine (`DRAFT_ENGINE`), handled by `lib/drafter.mjs` behind `POST /api/draft`:
  - OpenAI-compatible HTTP, which covers OpenAI, OpenRouter, Mistral, Groq and local Ollama / LM Studio / llama.cpp / vLLM;
  - Claude Code CLI;
  - Codex CLI.
  It writes editable reply drafts and summaries only.
- Connected message view:
  - **Suggest a reply / Summarize with <engine>**, with an editable preview and separate consent;
  - the draft is prefilled in the composer, clearly labeled; saving it still requires the exact preview and approval.
  - Settings show the drafting engine status.
- New guides `docs/LLM-DRAFTING.md` / `.fr.md`. Architecture, security, product, `.env.example` and agent notes are updated.
- 12 new tests (`tests/drafter.test.mjs`), with synthetic HTTP and stand-in child processes, no live calls.
  - Full suite: 167 of 169 pass locally.
  - The 2 failures are the existing Windows `localhost`→`::1` Google Desktop tests, unchanged.
- Not claimed:
  - no live drafting of a real message;
  - no run of the OpenAI-compatible adapter against a real server.
  - Claude Code 2.1.278 and codex-cli 0.154.0 flags were checked with one trivial, non-personal prompt.

# Essentiel 0.3.2 — September 19, 2026

Baseline: Essentiel-Jev-v0.3.1.zip. Current user report: Google API HTTP 403 messages hide their cause; navigation switches to a different `/workspace` application.

## Fixed / added

- One shared personal workspace shell at `/` and `/workspace`, with all connected and local routes, FR/EN, shared theme, mobile layout and retained in-memory local state.
- Mountable connected module with scoped events/styles; no iframe and no silent fusion of local/account data.
- Allowlisted Google/Microsoft diagnostics: disabled API, insufficient scope, organization policy, limit, reauthorization, unknown refusal and transient failure.
- Read-only per-service access checks and filtered technical JSON export. Unrequested services are not queried.
- Account identification separated from service read results; unknown counters no longer claim zero; failed mail read no longer presents an empty mailbox.
- Cached data and success timestamps retained after failed attempts; API/write failure diagnostics preserve blocked/rejected/uncertain semantics.
- Existing Desktop/Web OAuth, PKCE, state/cookie binding and cross-site API guards retained.
- Updated troubleshooting, architecture, security and bilingual guides; local offline previews rebuilt.

## Verification

157 Node tests pass, including 21 new regressions. 34 local-tool browser checks and 17 unified UI integration checks pass. Tests use synthetic upstream providers; UI uses injected DOM/module packaging and a local HTTP bridge due managed-browser loopback restrictions. See VALIDATION.md for exact limits.

## Not claimed

No real Google account diagnostic was obtained, no Google Cloud API was enabled for the user, and no production OAuth/tenant acceptance was performed. This is not a Windows executable or a hosted consumer release. The integration does not automatically copy local tasks into Google/Microsoft or aggregate every local/remote count.
