# Essentiel — AI-assisted email, calendar, tasks and documents, judged by TypeSafe Jev

English · French version: [README.fr.md](README.fr.md)

**TypeSafe Jev gives typed, probability-backed judgments (Choice, Score, Noul) that local code validates before use. LLMs write the text: any OpenAI-compatible API, local models through Ollama, LM Studio, llama.cpp or vLLM, Claude Code or Codex. You approve every action in Gmail, Outlook, Google/Microsoft calendars, tasks and documents, and Essentiel reads back what actually happened.**

## Why TypeSafe + AI

Essentiel keeps three jobs apart that "AI assistants" often blur together: **judging**, **writing** and **acting**. Each job goes to the tool that suits it, and you keep the final decision.

### What TypeSafe Jev brings: judgments your code can check

TypeSafe describes Jev as "the first System One model", built "to make fast, structured decisions that software can use directly" ([introduction](https://docs.typesafe.ai/introduction)). In Essentiel, this means:

- **Typed answers instead of prose.** Jev answers **Choice** (one option among named criteria), **Score** (a level on a scale) and **Noul** (a yes/no-style value between 0 and 1). "No text generation, no parsing": the result is data, not a paragraph to interpret.
- **Probabilities and confidence.** Choice and Score answers carry the full probability distribution. According to TypeSafe, `confidence` "is a statistic computed from the probability distribution" ([confidence](https://docs.typesafe.ai/confidence)). Essentiel shows both and routes low-confidence results to review. Its thresholds (0.75 by default) are provisional and not calibrated on your data.
- **A contract checked by code before use.** The local validator refuses any answer whose count or type is wrong, whose probabilities do not sum to 1, whose Choice is not the most probable option, or whose Score is not the weighted mean of its scale. A malformed response is refused; no substitute result is invented.
- **Traceability.** The model identity and token usage returned by TypeSafe are kept with the result.
- **Consent per transmission.** Every assessment shows an editable preview of the exact text and needs its own consent. No mailbox or document corpus is sent implicitly.
- **Never authority.** A high probability is never a mandate to act. Jev cannot send, create or approve anything.

TypeSafe states that System One models "are trained for calibrated decisions" ([System One](https://docs.typesafe.ai/concepts/system-one)). Essentiel has not measured that calibration on your messages.

### What LLMs bring: fluent text you edit

System One models "do not write replies, produce code, or generate explanations". That is deliberate, and it is exactly where a generative LLM helps:

- **Drafting and summarizing:** a courteous reply draft or a 3–6 sentence summary of one message, in French or English, following your optional instruction ("formal", "decline politely"…).
- **Your choice of engine:** any **OpenAI-compatible API** (OpenAI, OpenRouter, Mistral, Groq…); a **local LLM** (Ollama, LM Studio, llama.cpp, vLLM), where the text stays on your computer and no per-request provider fee applies; **Claude Code** or **Codex**, which reuse your existing sign-in and run with no tools.
- **Structured, bounded output:** the engine must return `{draft, notes}`. The notes list what you should verify. A tool call, extra field or malformed reply is refused.

### How they work together

```text
Source message ──(your consent)──> LLM writes editable text        writing
               ──(your consent)──> Jev: Choice / Score / Noul       judging
Local code: validates contracts, applies deterministic rules, checks freshness
You: edit and approve the exact preview                            deciding
Server: writes to Gmail / Outlook / Tasks / Calendar, then reads back   acting + proof
```

No model sends mail, creates an object or approves an operation.

| Drafting engine (optional) | `.env` | Where the text goes |
|---|---|---|
| OpenAI-compatible API | `DRAFT_ENGINE=openai`, `LLM_BASE_URL=https://…/v1`, `LLM_API_KEY`, `LLM_MODEL` | The configured provider |
| Local LLM | `DRAFT_ENGINE=openai`, `LLM_BASE_URL=http://127.0.0.1:11434/v1` (Ollama), `LLM_MODEL` | Stays on this computer |
| Claude Code | `DRAFT_ENGINE=claude` (optional `CLAUDE_MODEL`, `CLAUDE_MAX_BUDGET_USD`) | Anthropic, through your sign-in |
| Codex | `DRAFT_ENGINE=codex` (optional `CODEX_MODEL`) | OpenAI, through your sign-in |

Setup, exact CLI flags, what is sent and the security model are in [docs/LLM-DRAFTING.md](docs/LLM-DRAFTING.md). Jev (`TYPESAFE_API_KEY`, `JEV_MODEL`) and the drafting engine are both optional: the connected tools work without any AI key.

**Honest limits.** Confidence is not correctness. A draft can be wrong or invent details, so read it. Only one message is used, never the whole thread. This build's tests use synthetic providers. No live TypeSafe inference and no real-message drafting were performed. The Claude Code and Codex flags were checked with one trivial, non-personal prompt.

## About this build

**Turn existing messages and commitments into reviewed actions in Google and Microsoft. Do not ask people to maintain another copy of their life.**

French / English interface and guides. Runnable single-user local developer build. Official API adapters are implemented; real-account acceptance and public OAuth verification have not been performed. No account, credentials or demo account is preconnected. All supplied provider tests are synthetic. Current release: 0.3.2. This repository also contains the unreleased assisted-drafting additions listed in [RELEASE_NOTES.md](docs/RELEASE_NOTES.md).

## Run

Node.js 22+; no npm runtime dependencies.

```sh
cd essentiel-jev
# New installation only: do not overwrite an existing .env.
cp .env.example .env
npm start
```

Open `http://localhost:8787`. Windows: `Copy-Item .env.example .env`, then `npm start`, or use `start-windows.cmd`. OAuth app registration is a one-time developer responsibility; [configure Google/Microsoft](docs/CONNECTORS.md) before authorizing accounts. An AI key is optional: `TYPESAFE_API_KEY` enables Jev judgments, `DRAFT_ENGINE` enables an optional drafting LLM ([guide](docs/LLM-DRAFTING.md)).

## Implemented connected workflows

| Starting point | Native action after explicit approval | What the record means |
|---|---|---|
| Gmail / Outlook message | Save an editable draft in the chosen mailbox | A draft exists; nothing was sent |
| An incoming request | Create a source-linked Google Task / Microsoft To Do task | A follow-up object exists; the underlying work is not done |
| Selected personal/work calendars | Search a time window and create a personal block | The selected calendars were checked before creation; no third party confirmed |
| An existing native task | Mark it completed after a fresh state check | The provider returned a completed task |
| A document name | Search Drive / OneDrive and open the original link | Returned metadata identifies a document; its content was not analyzed |

The main `/` page opens Today. A shared navigation includes connected mail, calendars, tasks, documents, receipts and connections alongside personal local tools. No dummy data appears when an account is absent. One Google account and one Microsoft account are supported.

Native writes are server-side, scoped, explicitly approved and followed by an object read-back. Read-back confirms the identified object and selected state checks, not message delivery, recipient agreement, correctness of every payload field or task outcome. A response lost after a write remains uncertain rather than being retried blindly.

## Existing local tools remain

All local tools remain within the same interface: 28 optional domains, 112 workflows, planning, money, lists, notebook, decisions and the System One lab. Their data stays separate from the connected vault; local tasks are not automatically copied to Google/Microsoft. `/workspace` remains an alias. `preview-*.html` files are offline local-tool previews; connected sections explain that a local server is required.

## Security and limits

The server binds only to loopback. It is not a hosted multiuser application. OAuth tokens stay server-side; `.env` holds application credentials. The connected workspace is memory-only by default. Optional passphrase encryption keeps tokens, cached sources and operation records in `.data/connected.vault`. Encryption does not protect an unlocked process or `.env`. Lock manually; browser closure alone does not lock it. Exported receipt JSON is plaintext and can contain personal information.

Permission grants can be broader than the UI operations. Gmail compose permits sending at the provider, although this app has no send route. Microsoft `Mail.Send` is not requested. Disconnecting locally does not revoke provider consent or delete objects already created in native tools.

The optional drafting engine is configured only in `.env`. Its HTTP endpoint must be https, or http on loopback only. Claude Code / Codex run as child processes without tools, in an empty temporary folder, with the prompt on stdin and an allowlisted environment ([details](docs/LLM-DRAFTING.md#security-model)).

No payments, purchases, booking service, automatic mail sending, full-thread or attachment analysis, mobile push, native mobile app, background daemon, bank feeds, household multiuser sharing, autonomous agent loop or generic MCP/browser-control execution is implemented. Calendar availability is scoped, bounded and not an atomic reservation. No universal demand, time saved, money recovered or real-user retention has been established.

## Jev / System One

Jev is optional typed judgment, not generation or authorization (see [Why TypeSafe + AI](#why-typesafe--ai)). Each connected-message assessment has an editable transmission preview and explicit TypeSafe consent. An optional drafting LLM writes editable text through a separate preview and consent; it never replaces a Jev answer. No document corpus or whole mailbox is sent implicitly. Choice, Score and Noul remain fully accessible through the existing laboratory. See [concept coverage](docs/SYSTEM_ONE_COVERAGE.md).

## Tests and handoff

```sh
npm test
# Optional DOM suite: requires separately installed Python Playwright and Chromium.
npm run test:browser
```

Validation details and limitations: [VALIDATION.md](docs/VALIDATION.md). Live release checklist: [LIVE_ACCEPTANCE.md](docs/LIVE_ACCEPTANCE.md). Architecture: [ARCHITECTURE.md](docs/ARCHITECTURE.md). Security: [SECURITY.md](docs/SECURITY.md). Product definition and priorities: [PRODUCT.md](docs/PRODUCT.md). Agent entry point: [START_HERE.md](START_HERE.md).

## Version history

### Version 0.3.2 — one interface and actionable errors

Connected and local tools now share the personal workspace navigation, theme and language. `/workspace` is a compatibility alias for the same application. Read-only per-service probes distinguish Google refusals from empty collections without exposing tokens or performing writes. **Update and HTTP 403 troubleshooting: [English guide](docs/GOOGLE_403.md).** Diagnostics must run on the user’s machine; their Google project was neither modified nor tested here.

### 0.3.1 fix — local Google sign-in

The OAuth return and its home-page redirect are no longer treated as cross-site API calls. Google **Desktop app** clients are supported with `GOOGLE_OAUTH_CLIENT_TYPE=desktop`. Configuration, safe updates preserving `.env`, and validation boundaries: [Google / localhost fix](docs/OAUTH_FIX.md).

**English product definition:** Essentiel turns information already present in your tools into concrete, approved actions, and keeps the evidence of what actually happened.
