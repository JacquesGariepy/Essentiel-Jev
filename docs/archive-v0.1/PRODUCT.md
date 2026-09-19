# Essentiel: product definition

## Human outcome

Reduce the effort required to notice and process the commitments a person chooses to manage. Do not create another conversation they must maintain. Do not promise that nothing will ever be missed.

The proposed product unit is an attention record: original text, declared source, narrow model assessments, a proposed bucket, selected source context, and the person's subsequent decision. It is not a generated summary detached from evidence.

## Interaction

The first screen distinguishes pending requests, review cases, informational documents, and unprocessed inputs. A person can always inspect all documents, including manually archived ones. A search is visibly labeled. Opening a record shows the original passage before offering a manual classification or a reminder export.

Examples are fictional and intentionally small. A school confirmation and project reply illustrate requested actions; an information newsletter illustrates absence of a personal request; a conditional administrative request illustrates missing context; a password request illustrates a sensitive operation that the application must never execute. None is a Jev benchmark.

## What Jev owns

Nine small judgments: the primary request, its textual status, the document category, a supporting passage identifier, a qualifying date candidate, presence of a time constraint, a sensitive-action signal, a manipulation signal, and relevance to an explicitly declared priority.

## What ordinary software owns

Text size limits, source spans, exact duplicate detection, calendar validation, arithmetic, response schemas, failure handling, visible review queues, storing human choices, export formats, and permissions.

## What the person owns

Their goals, whether a request is legitimate, whether the source is trustworthy, whether a suggested deadline is correct, whether to respond, and whether to take an external action. The application does not infer that a polished or urgent message deserves obedience.

## Why this is not just a chatbot

A chatbot produces a conversational answer. This interface exposes persistent records the person can inspect and correct. Jev is used for bounded classification rather than composing advice. The templates and explanations are application text, not prose secretly attributed to the model.

This is a design distinction, not a measured assertion that the prototype saves time or outperforms all alternatives. It must be compared against a simple manual inbox and a rules-only baseline.

## Product-quality measurements to collect

Measure missed explicit requests, false urgent classifications, false obligation creation, incorrect selected passages, unresolved date frequency, correction time, and overall time per correctly processed record. Record the cost of review; do not hide it behind fast inference figures. Also measure whether the user can recover and correct a mistake without external consequences.

Keep evaluation examples separate from prompt-development examples. Label status and deadlines against the information actually available at the time. Split closely related threads across evaluation sets carefully to avoid leakage. Evaluate French directly rather than assuming English results transfer. Compare pinned model versions on the same frozen test set.

## Boundary of this first release

This version can establish a working interaction and test the evaluation contract. It cannot establish end-to-end reliability without an authenticated model evaluation and representative user data. The longest-term product direction is a consent-based assistant that maintains context across sources; those connectors, durable scheduling, and thread semantics are not present here.
