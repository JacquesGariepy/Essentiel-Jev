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
