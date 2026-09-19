# Essentiel 0.3.2 — unified workspace and Google 403 diagnostics

## Scope of this fix

Both `/` and `/workspace` now serve the same application shell. Mail, calendars, connected tasks, documents, connections and action receipts live in the personal workspace navigation alongside all local tools. Language and theme are shared. Switching sections does not reload a different application or discard in-memory local tasks. Old `/workspace` bookmarks remain supported.

Local and account data are not silently merged. A local task stays local; Connected tasks reads authorized Google Tasks/Microsoft To Do lists. Personal dashboard counters are not Gmail totals. System One, the 28 domains and 112 workflows remain available.

HTTP 403 alone does not establish a cause. The server previously discarded useful provider details. It now retains allowlisted technical diagnostics: service, HTTP code, recognized reason, category and Google consumer project number when explicitly returned in structured ErrorInfo. Raw error bodies are never reflected.

## Update on Windows

1. Stop the server with `Ctrl+C`. Preserve `.env`, `.data` and any OAuth JSON referenced by `GOOGLE_CLIENT_CONFIG_FILE`. Export unsaved local data from Preferences and data before reloading the browser.
2. Replace application files from the new `essentiel-jev` folder in your usual working directory. The archive contains no configured `.env`, vault or credentials. Do not overwrite existing configuration with `.env.example`.
3. Run `npm start`, open `http://localhost:8787`, then press `Ctrl+F5`. Keep the same hostname and port to retain access to existing browser storage. `localhost` and `127.0.0.1` have different storage origins.

Google Desktop OAuth remains supported:

```dotenv
GOOGLE_OAUTH_CLIENT_TYPE=desktop
```

Do not switch an otherwise configured client merely to address an undiagnosed API 403. This release remains a local Node server with browser UI, not a Windows installer. See [CONNECTORS.md](CONNECTORS.md) for configuration and [OAUTH_FIX.md](OAUTH_FIX.md) for callback/PKCE behavior.

## Diagnose the failed service

Open **Connections → Google → Test access**. The test performs at most one minimal GET per authorized read service. It sends no message, creates nothing and updates nothing at Google. Services without granted capabilities are marked not authorized and are not queried. A successful probe does not certify every resource or any write: synchronization and execution retain independent checks.

| Diagnostic | Remediation |
|---|---|
| API disabled (`SERVICE_DISABLED`, `accessNotConfigured`) | Open the provided Google Cloud link. Select the project containing the OAuth client used by `.env` or the configured client JSON. Enable the relevant API, allow propagation, then test and sync again. |
| Insufficient scopes (`ACCESS_TOKEN_SCOPE_INSUFFICIENT`, `insufficientPermissions`) | Select the necessary capabilities under Connections, then Reauthorize / extend permissions. Consent only to needed access. This does not enable disabled APIs. |
| Organization restriction (`domainPolicy`, etc.) | Have the Google Workspace administrator review app access. The local application does not bypass organization policy. |
| Usage limit (`rateLimitExceeded`, `quotaExceeded`, HTTP 429) | Space requests and review project/service limits. Reauthorizing may not address this condition. Never blindly repeat an uncertain write. |
| Reauthorization required | Restore account authorization, then check actual granted permissions. |
| Unidentified refusal | Do not assume the API is disabled. The report preserves available recognized reasons and HTTP status. Review project, grants and account restrictions. |

Exact API names: **Gmail API**, **Google Calendar API**, **Google Tasks API**, **Google Drive API**. Enable only the services being used. Creating an OAuth client or signing in does not automatically enable those APIs and is not proof that their reads work.

Essentiel cannot enable Google project services for the project owner. Configuration links are constructed to `console.cloud.google.com` with known API identifiers. The project is preselected only when explicitly returned in structured Google metadata; otherwise select it manually. The app never guesses a project from client-ID text or follows a provider-supplied activation URL.

## Honest state and export

Account identified is distinct from each API read result. A failed first read displays an unavailable counter (`—`), not a fabricated successful zero. Previously loaded data remains visible with a warning when a new attempt fails. Failed mailbox reading is not represented as an empty inbox.

**Export diagnostic** creates a technical JSON report: version, provider, time, services, outcomes, error codes and filtered metadata. No access/refresh token, client secret, account address, mail body or message/document identifier is included. A Google project number may appear and is technical information. Ordinary action-journal exports are different and may contain personal data.

## Validation and limits

157 passing Node tests, 34 local-tool browser checks and 17 unified-interface integration checks. Test providers are synthetic. UI checks inject delivered code and bridge to the real local HTTP server; managed Chromium blocks direct localhost navigation in the build environment. Browser storage, URL history and downloads use documented test substitutes.

No real Google/Microsoft account or TypeSafe inference was exercised. The actual cause of the user's screenshot was not determined on their account. The fix repairs navigation and error visibility; run diagnostics locally to establish the present refusal. See [VALIDATION.md](VALIDATION.md).

## Official sources checked on September 19, 2026

- [Gmail errors and reason field](https://developers.google.com/workspace/gmail/api/guides/handle-errors)
- [Calendar errors and limits](https://developers.google.com/workspace/calendar/api/guides/errors)
- [Enable a service within a Google Cloud project](https://cloud.google.com/service-usage/docs/enable-disable)
- [OAuth for desktop applications](https://developers.google.com/identity/protocols/oauth2/native-app)
