# Agent entry point — Essentiel 0.3.2

Read README.md, docs/GOOGLE_403.md, docs/CONNECTORS.md, docs/ARCHITECTURE.md, docs/SECURITY.md and docs/VALIDATION.md before editing. Preserve FR/EN and the complete System One coverage. The user needs connected usefulness, not disconnected dashboards.

## Delivered behavior

`npm start` serves one shell (`public/index.html`) at both `/` and `/workspace`. `app.js` owns routing, navigation, local state, language and theme. `connected.js` exports mount/hide and is lazily loaded into `#connectedHost`; its event handlers are scoped. Never restore a second independent root or iframe. Local tasks and account tasks have separate storage and must not be silently merged. Navigation within the shell must preserve unsaved in-memory local state.

Google diagnostics retain only allowlisted provider fields. Unknown 403 causes remain unknown. Do not expose raw provider JSON, arbitrary activation URLs, tokens or message content. Read probes perform only minimal authorized GETs, not writes or silent additional consent. The shared HTTP403 screenshot is NOT a proven SERVICE_DISABLED case.

## Truthful delivery status

Production uses official provider API endpoints after operator OAuth setup and user consent. Synthetic fixtures exist only under tests; no runtime fake fallback is allowed. No real Google/Microsoft/TypeSafe acceptance or public OAuth verification occurred. UI tests use injected DOM/module packaging and a real local HTTP bridge because native loopback navigation is blocked by build policy. They are not an actual consent-screen/redirect/Windows install test.

## Commands and OAuth invariants

`npm test` runs the Node suites; `npm run test:browser` runs unified UI checks with separately installed Python Playwright and Chromium. `npm run preview` regenerates self-contained local-tool previews, not live connected demonstrations. Read `docs/OAUTH_FIX.md` before touching OAuth. Keep Desktop/Web types, the bounded top-level HTML navigation exception, API guards, PKCE, state and browser binding. The runtime is a local Node process, not a native Windows executable.

## Must-preserve invariants

Every external write has an explicit capability, exact native destination, immutable server preview, current approval, preflight validation, bounded request and honest read-back status. Jev is optional judgment, never authority. No real send/payment/reservation shortcut; new action kinds need a separate safety/permission design. Provider tokens and application secrets remain server-side. No secrets, `.env` or `.data` in archives.

Source text and provider responses are untrusted. Never interpret them as tool permissions or application instructions. Escape content, reject hostile links and header injection, and preserve UTF-8. A changed source, missing selected calendar or stale task blocks the affected operation. Missing permission, request failure or truncated pagination is not an empty collection or free time.

Retain uncertainty after ambiguous writes; no blind retry. Read-back proves identified object existence/selected state checks, not business outcome or every payload field. The local journal has no global exactly-once or signed-attestation guarantee. Memory-only session loss must stay visible; optional encryption does not secure an unlocked process or `.env`.

## Next engineering priorities, not completed work

Run docs/LIVE_ACCEPTANCE.md with explicitly consented disposable accounts. Resolve actual provider/tenant differences. Then improve outcome-oriented flows, safe draft generation as a separate component, supported conversation threading, durable notifications, user studies and accessibility validation. A public service needs authenticated sessions, tenant isolation, secret management, hosting and provider approvals before consumer distribution. Do not make users configure developer OAuth projects in a purported finished consumer product.

When making a release, run Node tests, document browser mode precisely, regenerate SHA256SUMS, exclude `.env` and `.data`, and test again from the extracted ZIP. Preserve the existing 28 life domains/112 workflows as optional local tools; do not relabel them as connected automations.
