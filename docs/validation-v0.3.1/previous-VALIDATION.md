# Validation — Essentiel 0.3.1

Node.js v22.16.0. 136 Node tests pass: 119 retained tests and 17 new OAuth regression tests.
The regressions send exact browser navigation headers using raw local HTTP, validating
Google and Microsoft callback -> 303 -> HTML, API/POST/iframe blocking, Desktop loopback
cookie handoff, one-use tickets, state/replay checks, optional secret and JSON configuration.

The browser navigation test was attempted and blocked by the environment's managed
Chromium policy with `ERR_BLOCKED_BY_ADMINISTRATOR`, before the initial page loaded.
No native-browser OAuth test is claimed as passed. `npm run test:oauth-browser` provides
that test for environments permitting localhost; provider responses remain simulated.
No real Google/Microsoft account or TypeSafe API call was used. No native Windows binary
was built. See `OAUTH_FIX.md` and `validation-v0.3.1/` for evidence and scope.

The existing 22-check connected DOM suite was attempted with injected HTML and a controlled
bridge to the actual HTTP server. Nineteen checks completed successfully before the run
stalled during the remaining erase/empty-state sequence and was terminated at the execution
time limit. This is a PARTIAL run, not a passed 22-check suite. It does not test real browser
navigation, cookies or OAuth provider acceptance. Its progress log and completed screenshots
are in `validation-v0.3.1/`. The separate Node vault/erase tests do pass.

---

## Historical v0.3 validation (retained, not a current OAuth claim)

# Validation — Essentiel 0.3

Date: 2026-09-19. Runtime used: Node.js v22.16.0. The tests exercise implemented code. They do not certify provider acceptance, production security, user desirability or business outcomes.

## Automated results

**119 Node tests passed:** 77 retained baseline tests plus 42 connected-module/security/provider/HTTP checks. `npm test` executes `tests/*.test.mjs` with the built-in Node test runner. Logs are in `docs/validation-v0.3/node-tests.log`.

**22 connected Chromium DOM checks passed, with no uncaught JavaScript errors.** Results and screenshots are in `docs/validation-v0.3/`. The tests exercise both languages, six views, source-linked draft/task creation, task completion, calendar slots and blocks, metadata search, receipts, encryption/lock/unlock/erase, responsive layout and legacy-route presence.

## Exact test boundaries

The production provider adapters use native HTTPS endpoints. For these tests only, `tests/connected-fixture.mjs` substitutes a synthetic upstream transport. Test accounts and content are marked TEST and use reserved example.test addresses. The production entry point does not import the fixture, and no account is preconnected.

The build environment's managed Chromium blocks URL navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. The DOM suite therefore injects the unchanged app HTML/CSS/JS and bridges fetch to a real local Node HTTP server. This is not an end-to-end native-browser OAuth test. Native CORS/origin behavior, redirect navigation and the provider consent UI were not exercised through Chromium. Node tests independently exercise actual local HTTP guards, callback state/cookie handling and mocked token exchange.

The DOM suite uses explicit doubles for sessionStorage and receipt-download transport. It does execute the actual Node action service, HTTP routes, crypto and encrypted filesystem writes. Screenshots of connected accounts contain only synthetic fixture data. The disconnected screenshot displays the genuine empty state without preconnected accounts.

No live Google account, Microsoft account or TypeSafe inference was used. No public OAuth approval, provider rate-limit/load study, operating-system notification test, security audit, consumer usability study or accessibility certification was performed. A successful test adapter is not a provider approval.

## Covered failure paths

Forged/replayed/expired OAuth state; wrong browser cookie; denied scope; cross-account replacement; missing credentials and absent accounts; concurrent token refresh; hostile links/pagination origins; UTF-8 MIME folding and header injection; invalid dates; changed/forged message sources; expired or mismatched approval; duplicate execution; missing/disappeared calendar/list selections; stale task state; calendar conflict and incomplete pagination; ambiguous writes without automatic retry; read-back failure with known object ID; wrong vault passphrase; interrupted execution recovery; local-only disconnect/erase semantics; API origin/header guards and private-file denial.

## Reproduce

```sh
npm test
# Optional, after installing Python Playwright and Chromium in the test environment:
npm run test:browser
```

The DOM harness is test-only and does not use or modify real accounts. It starts/stops a local test server and removes its temporary vault. To validate real provider behavior, use `LIVE_ACCEPTANCE.md` with explicit consent and disposable native resources. That live checklist is intentionally marked NOT EXECUTED.

The archived v0.2 browser checks have different boundaries and are retained as historical evidence, not counted as newly executed connected browser tests. The final archive is also extracted and the Node tests rerun; the extraction log is included with the delivered validation artifacts.
