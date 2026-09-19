# 0.3.1 — 2026-09-19

Fix the post-OAuth 303 landing-page 403 without exempting APIs or embedded requests.
Add explicit Google Desktop OAuth configuration, optional installed-client JSON input,
loopback-host cookie bootstrap, one-use launch tickets, original-origin return, and
client-type hints in both UI languages. Retain Web/Microsoft flows, PKCE and server-side
credentials. Add 17 regression tests using exact HTTP navigation headers.
See `OAUTH_FIX.md` for update instructions, security boundaries and test limitations.

# Release notes — 0.3.0 — 2026-09-19

The root experience is now connected work rather than a manual local organizer. Added Google/Microsoft OAuth authorization, explicit capabilities, bounded mail/calendar/task/file reads, source-linked action previews, approved native draft/task/time-block writes, task completion, fresh preflight checks, read-back receipts and optional encrypted local persistence. The connected UI and setup guides are French/English.

Preserved the full local v0.2 workspace at `/workspace`, including the optional life workflows and System One laboratory. The old self-contained HTML previews still demonstrate the local v0.2 workspace only. Archived original v0.2 general documentation under `docs/archive-v0.2/`.

No mail send, payment, purchase, external booking, bank connector, attachment analysis, autonomous background agent, mobile app or hosted multiuser deployment was added. The API adapters are actual implementations, not live-account acceptance evidence. Provider tests and screenshots use explicit synthetic fixtures; native OAuth consent and real accounts remain untested.
