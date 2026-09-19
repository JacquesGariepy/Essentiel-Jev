# Release notes — 0.2.0

Delivery date: 2026-09-19. Input baseline: supplied `Essentiel-Jev-v0.1.zip`. The original archive was not modified. This is a successor package, not an in-place update of a repository or an approved production release.

## Added

French/English local workspace; ten navigation areas; capacity-based Today; complete tasks, dependencies, checklists, recurrences and routines; week view; 28 life domains and 112 editable bilingual workflows; manual money tools; meals/lists; decision matrices; notebook/index; global search; display preferences; JSON/CSV/ICS; authenticated encrypted exports; validated replacement import; undo and local erasure.

Full generic System One editor and validator for Choice, Score and Noul; four request presets; raw distributions; model/usage inspection; explicit payload consent; independent batching; manual next-step requests; review-packet export; observed-label statistics excluding fixtures/imported AI history; native metadata lookup.

## Preserved from the inbox baseline

Original source text, exact candidate excerpts, closed date choices, conservative classification, manual review/date approval, local editable reply template, linked tasks, JSON source import/export and native TypeSafe HTTP integration. The original archive remains the baseline of record; archived documentation is clearly separated in `docs/archive-v0.1`.

## Corrected

Client/server source identifiers and 200-character title limits align. Retry-after values are honored or the retry is refused when outside the bounded local wait budget; the client no longer retries earlier than requested. Score legends and probability-weighted expectations are checked. Imported synthetic records keep their provenance. A late result cannot overwrite manual source decisions or repopulate an erased/replaced workspace.

## Migration

Export the old workspace before changing applications or origins. In v0.2, Settings → Import accepts a whole backup and validates before asking to replace. A legacy source-only JSON batch can instead be loaded from Add source to append texts without analysis. This batch path skips exact text duplicates; the full-backup path replaces, not merges.

Imported source classification, evidence selection and source date approval are reset to unanalysed. Imported AI run history is unverified and excluded from quality observations. Manual task dates and financial data remain manual data. Old storage entries are not secretly deleted in another origin or browser profile. The v0.2 server and standalone preview may have different browser origins and therefore different storage.

## Release qualifications

No paid TypeSafe call or model-quality benchmark was run. The shipped evidence covers local code, mock-backed HTTP and offline browser behavior, including race conditions; see `VALIDATION.md`. Windows/macOS launchers and real calendar applications were not executed here. No architect approval, production deployment, accredited branch merge, independent security assessment or accessibility certification is represented by this package.
