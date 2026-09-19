# Security and privacy boundaries

This release is a local single-user application, not a security-certified vault or an Internet service. The following describes implemented code and remaining risk; it is not a guarantee against a compromised device or provider.

## Data flow

Ordinary edits, planning, totals, matrices, lists and search run locally. No analytics, remote fonts, advertising requests, account polling or background model calls are present. Reading `/api/config` contacts only the local server. Loading sample data contacts only the local sample endpoint. Real provider calls happen after the user approves a displayed payload; model metadata lookup is an explicit separate action.

A TypeSafe request leaves the device. Its retention, processing and jurisdiction depend on the provider and account agreement. This application cannot certify zero retention, erase provider-side records or validate account-specific legal terms. Do not include passwords, recovery codes or unnecessary third-party information. Built-in warnings are not a guaranteed secret scrubber.

## Storage

Memory mode still places data in the browser process and may be visible to extensions, debugging tools, screenshots, operating-system swap or device compromise. Opt-in localStorage is plaintext under the browser profile. It is not encrypted by the application and has no separate user authentication.

Encrypted exports use Web Crypto AES-256-GCM with a random 16-byte salt, random 12-byte IV and PBKDF2-SHA256 with 250,000 iterations. The authenticated additional data identifies the backup format. The password is not intentionally persisted or transmitted. There is no password recovery. A strong passphrase and a protected destination remain necessary; minimum length is not a strength guarantee. Export encryption does not encrypt live memory, browser storage, unencrypted exports or files indexed in notes.

Imports bound file sizes, JSON depth, field lengths, reference graphs and entity counts. Password failure or ciphertext modification causes authenticated decryption to fail. An encrypted backup protects integrity under its password; it does not prove the identity of whoever created it. A plain JSON import is untrusted input. Imported AI results are not treated as verified model output.

## Local server

The server binds `127.0.0.1`, accepts the exact loopback Host/port, rejects cross-site Fetch Metadata, and protects POSTs with exact Origin and a custom header. Only allowlisted static assets are served. Security headers include a same-origin Content Security Policy, no framing, no MIME sniffing, no referrer and disabled camera/microphone/geolocation permissions. The self-contained HTML previews necessarily embed code/styles and do not run under that server CSP.

These controls reduce browser-origin attacks but are not local operating-system authentication. Any local program able to imitate headers can call the service. Do not change the listener to `0.0.0.0`, reverse-proxy it publicly or share the port without implementing authentication and a deployment threat model. No TLS, user accounts, tenant isolation, rate-limit persistence or remote session revocation is supplied.

The key lives in `.env` or process environment on the server. `.env` is excluded from version control and distribution. No API route returns it. The upstream destination is fixed, redirects are rejected and raw provider error bodies/request content are not intentionally logged. A device administrator or malicious process can still read secrets.

## Untrusted content and actions

User-supplied text is escaped for HTML rendering. CSV exports neutralize leading spreadsheet formula characters. Prompts treat imported content as data. That instruction is defense in depth, not proof of prompt-injection immunity. Typed schemas limit response shapes; they do not make an incorrect judgment true.

No response authorizes email, purchases, payments, bookings, cancellations, medical treatment, legal action, file deletion outside the local workspace or access changes. There are no remote tools for a model to call. A source excerpt proves only that a passage occurs in supplied text, not that the underlying claim is correct.

Manual source classification and date confirmation survive concurrent model evaluation. Erasing or replacing a workspace invalidates late results. Already transmitted bytes cannot be recalled. Stopping a batch prevents subsequent requests; it does not promise cancellation of a running upstream evaluation or charge.

## History and deletion

The activity history is bounded and editable through local data access; it is not an append-only, signed, tamper-evident legal audit. Undo temporarily retains recent states in memory. Erase clears local workspace storage, undo and drafts, but does not delete downloaded backups, copied text, browser/OS forensic remnants, external documents or provider records. Migration does not silently erase an old v0.1 storage key in another origin/profile.

No confidentiality, accuracy, medical/legal suitability, WCAG conformance, disaster recovery or penetration-test certification is claimed. The checked evidence is described in `VALIDATION.md`. Before wider deployment, independently validate browser behavior, export/import recovery, threat controls, permission boundaries and applicable legal requirements.
