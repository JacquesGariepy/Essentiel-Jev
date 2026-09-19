# Validation report — Essentiel 0.2

Date: 2026-09-19. Runtime: Node.js v22.16.0, npm 10.9.2, Python 3.13, installed Playwright and Chromium. Status refers to this packaged source snapshot only.

## Executed evidence

| Check | Result | Evidence |
|---|---:|---|
| Node engine, policy, provider and real local HTTP tests | 77 passed, 0 failed | `validation/node-tests.tap` |
| Offline browser workflows | 34 checks passed, no uncaught JavaScript errors | `validation/browser-checks.json` |
| Offline browser concurrency/privacy checks | 4 checks passed, no uncaught errors | `validation/browser-privacy.json` |
| Native request example, all three primitives | Validated local dry run, not sent | `validation/native-dry-run.json` |
| Native request example, refund composition | Validated local dry run, not sent | `validation/refund-dry-run.json` |
| Self-contained FR/EN preview build | Completed | `preview-fr.html`, `preview-en.html` |
| Human-needs inventories | Generated from the shipped catalog | `HUMAN_NEEDS_EN.md`, `HUMAN_NEEDS_FR.md` |

Tests use fixed fictional fixtures and injected upstream behavior. There was **no paid TypeSafe inference**. Zero API input/output tokens in fixtures is a label for no model execution, not evidence of free production inference. The new native dry-run example never transmits unless `--send` is explicitly passed with a key.

## Node coverage

Strict calendar validation, month/year and leap-day boundaries, dates across daylight-saving periods, recurrence anchoring, no duplicate recurrent child, task graph references and cycles, completion prerequisites, time/energy planning, retained overflow, integer monetary parsing, separated currencies, subscription equivalents, savings arithmetic, CSV escaping/import validation, all-day ICS formatting and UTF-8 folding, JSON migration/provenance, authenticated backup encryption and wrong-password/tamper rejection.

Catalog uniqueness, all 28 domains, all 112 bilingual workflows, four steps per workflow, shared interface language coverage, FR/EN fictional data. Generic requests test strings/objects/arrays, safe structured descriptions, 255 Choice options and the rejection of a 256th, all three primitives, malformed distributions, invalid types and exact Score legend/expectation checks. Observation metrics exclude fixtures and imported-unverified histories, and can separate model versions. Refund checks never execute a refund.

The original inbox tests cover source normalization, original excerpts, candidate dates, inconsistent or conditional requests, uncertainty/sensitivity, visible provider errors and explicit sample provenance. Server tests exercise actual loopback HTTP with injected mock providers: missing key, explicit consent, Origin/Host controls, static allowlisting, typed response routes and model metadata. Provider tests cover native request shape, bounded failures and honoring or refusing an excessive retry-after delay.

## Browser method and limitations

The environment's managed Chromium policy blocked navigation to URLs, including localhost. Tests did not disable or bypass that policy. Instead, they injected the generated self-contained HTML into an offline page. The workflow test supplies explicit localStorage and download test doubles. The privacy test additionally supplies controlled fetch/provider responses. This checks DOM behavior and action logic, not a real browser-to-localhost deployment under the server's HTTP security headers.

Actual HTTP behavior is checked separately by Node's local HTTP tests. AES backup cryptography is exercised with Node Web Crypto; the injected browser page has an opaque origin, so it does not establish Web Crypto availability in each browser/file-origin mode. Clipboard permissions, operating-system downloads, calendar application import, a real TypeSafe account and browser-profile persistence were not end-to-end validated here.

The 34 workflow checks include navigation, storage opt-in, task CRUD/checklists/dependencies/recurrence, capacity planning, focus, editable workflow activation, profile filtering, money/CSV-related UI paths, routines, meals/lists, notes and inert markup, original-source excerpts, manual source date/classification, ICS/download data, linked tasks, legacy JSON source import and duplicate handling, decision choice, three primitive rendering, fixture exclusion from metrics, a separate dependent request, outbound consent, local search, backup import/reset, undo/restore, mobile layout, theme/language and English samples.

The 4 concurrency checks use held response promises to verify that human classification/date decisions survive an evaluation and that erasing while source/lab requests are pending prevents late results from repopulating the workspace. These do not demonstrate server cancellation, provider retention or cancellation of charges.

## Visual inspection

The following Chromium screenshots were generated from the tested DOM and visually inspected for general layout and obvious overflow:

- `validation/desktop-fr.png`: French Today, 1440-pixel viewport, fictional examples.
- `validation/mobile-fr.png`: French mobile, 390-pixel viewport, includes explicitly entered test data.
- `validation/desktop-dark-en.png`: English dark mode after test interactions.
- `validation/spaces-en.png`: English life spaces, all 28 domains.

The mobile check asserts no horizontal document overflow at 390 pixels. This is not exhaustive responsive, screen-reader or WCAG validation. Color contrast and all browser/assistive-technology combinations have not been independently certified.

## Reproduction

```sh
npm test
npm run preview
node scripts/build-catalog-docs.mjs
node examples/native-system-one.mjs
node examples/native-system-one.mjs --refund
python tests/browser-check.py
python tests/browser-privacy.py
```

Node runtime needs no npm install. Browser checks require Python Playwright and an installed Chromium; set `CHROMIUM_PATH` when it is not `/usr/bin/chromium`. Generated previews must be rebuilt before the browser checks if any browser module changes.

## Not established

Jev inference accuracy, probability calibration on representative data, multilingual parity, real model availability, provider billing or latency, vendor-side retention, Windows/macOS launcher execution, real OS calendar import, offline notification delivery, a production deployment, independent security review, accredited repository merge, market demand, guaranteed time savings, adoption by every person or completeness of all possible human needs.

The evidence supports a functional local implementation and its tested contracts. Real model use and broader deployment still require validation in the actual target environment with authorized data and account terms.
