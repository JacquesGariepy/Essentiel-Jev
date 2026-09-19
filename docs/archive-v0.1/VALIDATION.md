# Validation record

Delivery date: 2026-09-19.

## Executed

**36 / 36 Node tests passed** under Node.js v22.16.0 on Linux. These include native-adapter request-shape assertions with a fake transport, deterministic policy tests, malformed-response tests, local HTTP server tests, and host/origin/consent checks.

**12 / 12 offline Chromium DOM checks passed.** The application was rendered at desktop width 1440 and mobile width 390. Tested interactions include filters, full-text search, opening the source, manual reclassification, confirmed-date requirements, .ics payload content and UTF-8 line folding, reply templates, HTML escaping, JSON export payloads, storage round-trip logic, and local erasure. No JavaScript exceptions occurred in those checks.

The environment's browser navigation policy prohibited opening URLs. The DOM harness therefore uses `set_content` with the self-contained preview. Storage and download transport are explicit test doubles. Local server routes were tested separately through Node HTTP requests. Screenshots show actual rendered application markup and CSS, not an image-generation mockup.

Machine-readable browser results are in `validation/browser-tests.json`. Node results are in `validation/node-tests.tap`.

## Not executed

- No authenticated request to TypeSafe or OpenRouter.
- No measurement of Jev classification quality, latency, or real billing for this application.
- No claims that the eight synthetic examples predict real model behavior.
- No Windows execution of the launch script.
- No native browser file-download flow, real browser persistence across operating-system restarts, or import into Outlook, Google Calendar, or another calendar application.
- No independent security audit, accessibility certification, or production load test.

## Interpretation

Passing tests means the checked implementation paths behaved as expected with controlled inputs. It does not establish model correctness, scam detection reliability, universal usefulness, or production readiness. A high confidence value is not an independently validated success probability for this application.

Live release requires a representative labeled corpus, held-out testing, language-specific evaluation, calibration of review thresholds, budget and retry observations, and a data-handling review for the intended users. These are release requirements, not work completed in this delivery.
