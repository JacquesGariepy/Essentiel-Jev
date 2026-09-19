# START HERE — Essentiel 0.2 engineering handoff

This is the complete local successor workspace for the supplied v0.1 archive. Read this before editing. Do not infer that packaging means approval, production deployment or merge authorization.

## Read in order

`README.md` → `docs/PRODUCT.md` → `docs/SYSTEM_ONE_COVERAGE.md` → `docs/ARCHITECTURE.md` → `docs/SECURITY.md` → `docs/VALIDATION.md`. The executable bilingual catalog is `public/catalog.js`; generated inventories are `docs/HUMAN_NEEDS_EN.md` and `docs/HUMAN_NEEDS_FR.md`.

## Reproduce

```sh
npm test
npm run preview
node examples/native-system-one.mjs
# Optional tooling, not runtime dependencies:
python tests/browser-check.py
python tests/browser-privacy.py
```

Use Node 22+. The runtime needs no npm installation. Python browser checks require Playwright plus Chromium; `CHROMIUM_PATH` overrides `/usr/bin/chromium`. The browser reports identify their test doubles. The native example prints its payload unless `--send` is passed with a real server-side/environment key. Never add a key to a browser bundle, demonstration file or committed fixture.

## Non-negotiable invariants

Real, pending, failed, synthetic and imported-unverified data must remain distinguishable. Do not use regex/rules as an undisclosed “Jev” fallback. A provider outage produces an error, not a plausible fabricated decision.

Jev produces only typed judgments. It does not author prose, code, explanations or external tool calls here. Source evidence must remain an exact passage from supplied text. Suggested dates are not confirmed dates. Confidence is not a per-answer accuracy guarantee; Noul has no separate confidence. Do not turn a Score into a probability of success.

Local engines own validation, recurrence, integer amounts, weighted scoring, dependencies, export formats and routing. User consent authorizes only the displayed outbound payload. No model answer authorizes a payment, message, purchase, booking, cancellation, legal filing, medical action or external account access.

The app starts blank on the server and in memory. Samples must be explicit and removable without silently destroying personal records. Storage opt-in, unencrypted-browser warning, encrypted-export boundary, replacement-import confirmation and no-undo erase must remain visible. Preserve generation guards for in-flight responses and manual source choices.

Every added domain, action or interface label needs French and English. Never auto-translate user-authored content while switching interface language. Keep theme, keyboard and 390px layout working. Add tests to the relevant engine and an end-to-end UI check when a form or action changes.

## Review and integration

Track the need/context in a parent item and code/test changes separately when the team's process requires it. Provide the actual diff, commands, test reports, known limitations and source documentation to the reviewer. Have an architect review the implementation before any approved integration. Only a person with required accreditation may perform a protected target-branch merge; no merge is performed by this artifact.

Where an organization requires current programming, JavaScript or design rules, consult the versions currently in force rather than freezing a filename/version in the procedure. No internal ruleset text was supplied or verified in this delivery, so conformance must not be claimed.

## Release checklist

Run all tests and regenerate both previews after every code change. Update bilingual manuals and the coverage matrix when behavior changes. Remove secrets and stale validation evidence. Keep documentation status specific: implemented local feature, tested mock integration, manually demonstrated process, or absent external integration. Build a new archive with a checksum inventory; retain the baseline for comparison.
