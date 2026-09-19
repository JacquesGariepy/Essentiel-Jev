# Essentiel 0.3.2 — act in the tools people already use

**Turn existing messages and commitments into reviewed actions in Google and Microsoft. Do not ask people to maintain another copy of their life.**

French / English interface and guides. Runnable single-user local developer build. Official API adapters are implemented; real-account acceptance and public OAuth verification have not been performed. No account, credentials or demo account is preconnected. All supplied provider tests are synthetic.

## Version 0.3.2 — one interface and actionable errors

Connected and local tools now share the personal workspace navigation, theme and language. `/workspace` is a compatibility alias for the same application. Read-only per-service probes distinguish Google refusals from empty collections without exposing tokens or performing writes. **Update and HTTP 403 troubleshooting: [English guide](docs/GOOGLE_403.md).** Diagnostics must run on the user’s machine; their Google project was neither modified nor tested here.

## 0.3.1 fix — local Google sign-in

The OAuth return and its home-page redirect are no longer treated as cross-site API calls. Google **Desktop app** clients are supported with `GOOGLE_OAUTH_CLIENT_TYPE=desktop`. Configuration, safe updates preserving `.env`, and validation boundaries: [Google / localhost fix](docs/OAUTH_FIX.md).

## Run

Node.js 22+; no npm runtime dependencies.

```sh
cd essentiel-jev
# New installation only: do not overwrite an existing .env.
cp .env.example .env
npm start
```

Open `http://localhost:8787`. Windows: `Copy-Item .env.example .env`, then `npm start`, or use `start-windows.cmd`. OAuth app registration is a one-time developer responsibility; [configure Google/Microsoft](docs/CONNECTORS.md) before authorizing accounts. An AI key is optional.

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

No payments, purchases, booking service, automatic mail sending, full-thread or attachment analysis, mobile push, native mobile app, background daemon, bank feeds, household multiuser sharing, autonomous agent loop or generic MCP/browser-control execution is implemented. Calendar availability is scoped, bounded and not an atomic reservation. No universal demand, time saved, money recovered or real-user retention has been established.

## Jev / System One

Jev is optional typed judgment, not generation or authorization. Each connected-message assessment has an editable transmission preview and explicit TypeSafe consent. No document corpus or whole mailbox is sent implicitly. Choice, Score and Noul remain fully accessible through the existing laboratory. See [concept coverage](docs/SYSTEM_ONE_COVERAGE.md).

## Tests and handoff

```sh
npm test
# Optional DOM suite: requires separately installed Python Playwright and Chromium.
npm run test:browser
```

Validation details and limitations: [VALIDATION.md](docs/VALIDATION.md). Live release checklist: [LIVE_ACCEPTANCE.md](docs/LIVE_ACCEPTANCE.md). Architecture: [ARCHITECTURE.md](docs/ARCHITECTURE.md). Security: [SECURITY.md](docs/SECURITY.md). Product definition and priorities: [PRODUCT.md](docs/PRODUCT.md). Agent entry point: [START_HERE.md](START_HERE.md).

**English product definition:** Essentiel turns information already present in your tools into concrete, approved actions, and keeps the evidence of what actually happened.
