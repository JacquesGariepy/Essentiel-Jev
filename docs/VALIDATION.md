# Validation — Essentiel 0.3.2

Executed September 19, 2026. These are implementation tests, not evidence of access to the user's Google account.

## Automated results

| Suite | Result | Mode |
|---|---:|---|
| `npm test` | 157 passed; 0 failed | Node unit and local HTTP integration; synthetic Google/Microsoft fixtures |
| `python tests/browser-check.py` | 34 passed | Regenerated offline local-tool previews in Chromium; documented storage/download/request shims |
| `python tests/unified-browser-check.py` | 17 passed | Delivered UI scripts/styles injected; API bridge to actual local HTTP server; synthetic upstream |

The 21 new Node cases cover recognized service errors, unknown 403 behavior, malicious diagnostic fields/URLs, non-JSON error bodies, per-service sync state, cached successful data, authorized minimal read probes, safe reports, failed/uncertain write handling, lock/disconnect lifecycle, one-shell routing and preserved API guards.

Unified UI checks cover all 16 routes, retained in-memory local task, shared FR/EN and theme, approved draft/task/calendar operations, file search, read probes, diagnostic export, 390px responsive width, three failed Google reads, separate account/read status and unknown-data counters. Complete check names: `validation-v0.3.2/unified-browser.json`. Local tool check names: `validation-v0.3.2/local-browser.json`. Node output: `validation-v0.3.2/node-tests.txt`.

## Exact browser limitation

Direct `page.goto` to the local server was attempted with managed Chromium. It failed before page load with **ERR_BLOCKED_BY_ADMINISTRATOR**. No attempt was made to circumvent that policy. UI tests instead inject the actual HTML/CSS and code, resolving module packaging in a test harness. Browser fetch uses a bridge to the real Node HTTP API; Google/Microsoft endpoints are replaced exclusively in the test harness.

History URL origin, local/session storage and download mechanics use explicit substitutes. Real browser module fetching, native loopback navigation, actual downloads, persisted browser storage and OAuth consent redirects are therefore not certified by these UI results. Independent Node tests exercise static paths, response security and OAuth redirect-chain contracts. No real Windows installer or executable exists in this release.

## No real provider acceptance

No real Google/Microsoft account, provider consent screen, tenant policy, end-user API activation, production mail/calendar/task write, paid TypeSafe inference, public OAuth verification or independent security audit was performed. The SERVICE_DISABLED screenshots in validation are labeled synthetic. They demonstrate error handling, not the actual cause of the user's HTTP 403. A successful read probe does not certify every resource or any write.

## Reproduction

Run `npm test` under Node.js 22+. Browser suites require Python with Playwright and Chromium installed separately. Their test file headers document substitutions and the expected executable path. `npm run preview` builds self-contained local-tool previews; it does not require credentials or connect accounts. The production server never loads the fixture provider or accepts a fixture-enabling flag.

## Release integrity

`SHA256SUMS` lists shipped files except itself. No configured `.env`, `.data`, OAuth JSON, node_modules or live credentials is shipped. The final archive is separately extracted and Node tests rerun before delivery; the extraction result is provided alongside the archive. Prior-version reports under validation-v0.3 and validation-v0.3.1 are historical and do not describe current test execution.
