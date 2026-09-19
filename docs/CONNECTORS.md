> Active version 0.3.2: connected views share the personal workspace. For HTTP 403, use [Google diagnostics](GOOGLE_403.md). OAuth setup below remains applicable.

> Version 0.3.1: Google Desktop OAuth clients are now supported. Set `GOOGLE_OAUTH_CLIENT_TYPE=desktop` and follow [the desktop / localhost guide](OAUTH_FIX.md). The Web-client setup below remains an alternative, not a requirement for Desktop clients.

# Connect Google and Microsoft — developer setup

Essentiel 0.3.2 is a runnable, single-user local developer application. The production code calls official HTTPS provider APIs. It contains no populated client secrets, no preconnected account and no runtime simulated-provider switch. A provider application registration and the account holder's consent are necessary before any account can be read or changed.

The supplied tests use deliberately synthetic upstream responses. Successful tests are not proof that a particular Google project, Microsoft tenant or real account has accepted this client. Live account acceptance remains to be performed.

## 1. Start the local server

Use Node.js 22 or later. No npm runtime dependency installation is required.

```sh
cd essentiel-jev
cp .env.example .env
npm start
```

In PowerShell, use `Copy-Item .env.example .env`. `start-windows.cmd` is also supplied. Open `http://localhost:8787`. Keep this terminal running. The server binds only to IPv4 loopback. Do not expose it through a reverse proxy, tunnel or public network.

For Web OAuth clients, the hostname matters: opening `127.0.0.1` causes the OAuth callback to use `127.0.0.1`, while opening `localhost` uses `localhost`. Register the exact callback for the origin actually used. This guide consistently uses `localhost` to avoid Microsoft portal limitations for HTTP IP-literal callback entry. Changing PORT requires reviewing both registrations.

## 2. Register Google once as the developer

Create or select a Google Cloud project. Enable the APIs needed for the selected features: Gmail API, Google Calendar API, Tasks API and Drive API. Configure the Google Auth Platform branding, audience and data-access consent settings for your own application. In testing mode, include the actual test account in the allowed test users.

For a **Desktop app** client, set `GOOGLE_OAUTH_CLIENT_TYPE=desktop` and follow [the Desktop guide](OAUTH_FIX.md). For the **Web application** alternative, set `GOOGLE_OAUTH_CLIENT_TYPE=web` and add this exact authorized redirect URI:

```text
http://localhost:8787/oauth/google/callback
```

Copy the client ID and client secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. These are OAuth application credentials, not a Google API key. Do not put them in HTML, public JavaScript, screenshots or Git. Restart the server after changing `.env`.

In Essentiel, open Connections, choose the Google features, then connect. Google performs sign-in and consent; Essentiel never asks for the Google password. The provider may refuse access because of application status, account policy, a restricted scope, a disabled API, a tenant rule or an invalid redirect. Show and resolve that error; do not relabel the account as connected.

Google documents verification requirements for public applications and distinguishes sensitive/restricted scopes. `gmail.readonly` and `gmail.compose` are restricted scopes. This archive does not include Google public-app verification, a verified consent brand or an independent security assessment. Scope approval for a personal development test is not public-distribution approval.

## 3. Register Microsoft once as the developer

Use Microsoft Entra App registrations. Create an application with an account audience matching the intended users. For both organizational and personal Microsoft accounts, select the corresponding combined audience. For one organization, use its tenant instead and set `MICROSOFT_TENANT` accordingly.

Add a **Web** platform callback, because the Node server performs the code exchange using a client secret. Do not register this implementation as a browser-only SPA or use application/client-credentials permissions.

```text
http://localhost:8787/oauth/microsoft/callback
```

Create a client secret and copy its **value**, not its secret identifier. Fill `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and `MICROSOFT_TENANT` in `.env`. `common` is the default tenant and must agree with the application's supported audience. Restart the server.

Use delegated Microsoft Graph permissions for the selected features. The application requests them interactively; an organization can require administrative approval or block consent. It does not request application-wide mailbox access or `Mail.Send`. Open Connections, choose features and connect through Microsoft's consent page.

Microsoft's documentation notes that HTTP `127.0.0.1` redirect URIs cannot be added through the portal text box in the same way as `localhost`; special manifest handling is required. Follow the official instructions rather than replacing HTTPS or redirect validation in code.

## 4. Exact feature permissions

| Feature | Google scope suffix after `https://www.googleapis.com/auth/` | Microsoft delegated scope |
|---|---|---|
| Read mail | `gmail.readonly` | `Mail.Read` |
| Read calendars | `calendar.readonly` | `Calendars.Read` |
| Read tasks | `tasks.readonly` | `Tasks.Read` |
| Search file metadata | `drive.metadata.readonly` | `Files.Read` |
| Create drafts | `gmail.compose` | `Mail.ReadWrite` |
| Create personal time blocks | `calendar.events` plus calendar read | `Calendars.ReadWrite` |
| Create/complete tasks | `tasks` | `Tasks.ReadWrite` |

Google also requests `userinfo.email`; Microsoft requests `User.Read` and `offline_access`. Write features include the read permission needed to select and check their targets. Granted capabilities derive from the token response, not from a checked box. Incremental authorization preserves existing grants. Unchecking a feature does not revoke an existing provider grant.

Important: Google's compose scope includes sending capability even though this app implements **no send endpoint**. Microsoft's draft scope includes mailbox write capabilities beyond the narrow actions exposed here. A compromised server is not constrained solely by the UI's buttons; requesting fewer features reduces exposure.

## 5. First useful connected run

Synchronize an authorized inbox. Open one actual message and its original link. Choose **Prepare a draft** or **Create linked task**. Confirm the destination account and native list, edit the content, review the exact server-side proposal, then approve it. Read the receipt and inspect the object in the original service. Drafts are not sent by Essentiel.

For time, select the calendars in Connections, search a bounded time window, and prepare one personal block. Essentiel re-reads selected calendars immediately before creation and stops if the result is incomplete or conflicting. This is not an atomic reservation: another client can add an event after the check. It does not query other people's free/busy data, send invitations or book appointments with third parties.

For documents, choose Google Drive or OneDrive and search. Google searches filenames; OneDrive uses the provider's search behavior. Only returned metadata and links are displayed, not downloaded document bodies. No result is silently sent to TypeSafe.

## 6. Keep connections or forget them

By default, connected data and tokens are kept only in the local Node process memory. Stopping it loses that session. Use **Save encrypted** to opt into `.data/connected.vault`, protected by a passphrase of at least 12 characters. The passphrase is not saved. Lock before leaving the workstation; the app has no inactivity lock timer. Closing the browser does not stop the server or lock an unlocked vault.

OAuth application secrets in `.env` are not covered by the vault's encryption. Restrict access to the working directory and operating-system account. The app is single-user; another process or user able to access its unlocked local HTTP server can access its data.

Disconnect removes the chosen account's local tokens/cache and related local journal entries. Erase removes the connected vault. Neither operation deletes provider objects or revokes provider consent. Remove application access at Google or Microsoft for full revocation. Exported receipt JSON is deliberately unencrypted, token-free but potentially sensitive. Legacy `/workspace` data has its own separate browser storage and deletion controls.

## 7. TypeSafe is optional

Set `TYPESAFE_API_KEY` only for optional structured assessments. `JEV_MODEL` defaults to an explicit model identifier; change it to an available supported model when necessary. The application does not need TypeSafe to read accounts or create approved native objects.

A message assessment shows the exact editable text excerpt and requires separate consent. Jev returns judgments; it does not write replies or gain authority to execute actions. Fixed draft templates are labeled as templates. The complete Choice/Score/Noul laboratory remains available under System One in the shared navigation.

## 8. Boundaries and diagnosis

One Google account and one Microsoft account are supported. Only the latest 30 inbox messages per account, a selected task list, selected calendars and bounded search results are read. Mail bodies are capped at 8,000 characters. No attachments or full conversation threads are analyzed. Calendar display covers yesterday through 14 days ahead; slot search is capped at seven days. At most ten selected calendars and 50 document results are exposed. A 500-entry journal limit stops new proposals rather than silently pruning audit history.

A revoked grant, expired client secret or provider quota produces an explicit error. Cached results can remain visible with a stale-data warning. A missing permission is not an empty inbox. Calendar pagination failure is not free time. Ambiguous write failures remain uncertain and are not blindly retried. A returned object identifier without successful read-back is distinguished from a verified object.

For a release candidate, execute the live acceptance checklist in `LIVE_ACCEPTANCE.md` using disposable test resources and the account holder's explicit approval. Never use simulated results as evidence of production readiness.

## Official references

- Google web-server OAuth: https://developers.google.com/identity/protocols/oauth2/web-server
- Gmail scopes: https://developers.google.com/workspace/gmail/api/auth/scopes
- Gmail draft creation: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create
- Microsoft auth-code flow: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- Microsoft redirect restrictions: https://learn.microsoft.com/en-us/entra/identity-platform/reply-url
- Microsoft draft creation: https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0
- Tasks resource / date semantics: https://developers.google.com/workspace/tasks/reference/rest/v1/tasks
- Microsoft To Do task creation: https://learn.microsoft.com/en-us/graph/api/todotasklist-post-tasks?view=graph-rest-1.0
- System One: https://docs.typesafe.ai/concepts/system-one

References checked on 2026-09-19. Provider acceptance and policies can change; the live registration is the source of truth for a given account.
