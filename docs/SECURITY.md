## 0.3.1 OAuth and Fetch Metadata update

The cross-site exception is restricted to top-level GET document navigation to the two
HTML entry paths (`/` and `/workspace`). API responses and writes do not inherit the exception.
OAuth launch/callback routes require top-level navigation when metadata is present, or
still validate state/cookie for legacy clients with no Fetch Metadata. Google Desktop
uses a server-created one-use launch ticket to bind the cookie on the explicit loopback
host, with PKCE, state, expiry and exact callback-origin checking. Provider URLs cannot
be supplied through the client JSON. See `OAUTH_FIX.md` for the full local threat model.
This is not authentication against another process running on the same unlocked machine.

# Security boundary — Essentiel 0.3.2

This is a local, single-user developer application, not a security-audited consumer service. Provider tokens can expose personal mail, calendars, files and tasks. Treat an authorized instance as sensitive software.

## Implemented controls

OAuth authorization code with S256 PKCE; cryptographically random state; browser-bound HttpOnly SameSite=Lax cookie; short-lived, single-use callback; fixed Google, Microsoft and TypeSafe endpoints; the optional drafting endpoint is chosen by the operator in `.env` (https, or http on loopback only), never by the browser; no arbitrary HTTP proxy; granted-scope capability checks; code exchange and token refresh only on the Node server. Application keys are not returned by status. Browser APIs require a custom header and writes require the matching Origin. Static files are served through an allowlist. `.env`, vault files and arbitrary paths are not exposed by static routes.

Only selected read capabilities are requested; writes require additional explicit grants. External writes are limited to drafts, personal time blocks, task creation and task completion. Each proposal has a fixed account/target/content, expiring approval hash and explicit human consent. Model outputs and source text are data, never shell commands, tool permissions or OAuth instructions. This is not a general autonomous action engine.

Remote mail HTML is reduced to inert text; active remote content, tracking images and attachments are not loaded. Provider-derived strings are escaped in UI templates. External links are restricted to HTTPS provider domains. MIME headers reject line-break injection; Unicode encoded-word folding preserves code points.

Responses, pages, message lengths and requests are bounded. Write transport errors are not blindly retried. Source and task changes invalidate pending work. Selected calendar availability is re-read before calendar writes. Provider failures remain explicit, including unknown outcomes after a potentially successful write.

## Provider diagnostics and shared UI

Provider JSON is untrusted. Only recognized reason codes, bounded HTTP/status/category values, known service names, and a validated structured consumer project number are kept. Never return raw provider messages, arbitrary metadata, OAuth credentials, request URLs or provider activation URLs. Google Cloud URLs are reconstructed from a fixed HTTPS origin and known API identifiers. An unknown refusal stays unknown. Diagnostic exports differ from personal action exports and exclude account addresses, source bodies and provider object IDs; they can contain a Google project number.

Read-access probes are capability-gated and make minimal GET requests only. They do not enable APIs, grant scopes, certify writes or bypass organizational restrictions. Locking/disconnecting retains existing guards; no access test implies consent for a write.

The unified interface uses scoped connected handlers/styles and one parent router, not an iframe. Local and connected persistence remain separate; neither is silently mirrored into the other. A shared theme or menu does not establish shared access rights.

## Optional drafting engines

Drafting is off by default (`DRAFT_ENGINES` / `DRAFT_ENGINE`). `/api/draft` accepts only an engine that the server offers. When enabled, `POST /api/draft` sends only the excerpt edited in the preview, an optional instruction and fixed drafting rules, after explicit consent. It applies the same Origin, header and rate limits as the Jev routes. Output must be `{draft, notes}` within fixed bounds. Tool calls, extra fields and malformed JSON are refused, and nothing is substituted. Provider bodies and CLI stderr are not returned to the browser.

Claude Code runs with `--tools ""`, `--restricted`, `--safe-mode`, `--strict-mcp-config`, `--no-session-persistence`, `--disable-slash-commands` and `--permission-mode dontAsk`. agy runs with `--sandbox`, a JSON schema and `--print-timeout 2m`; only its terminal `finish` step is accepted, any other tool or subagent step refuses the draft and stops the process. Codex runs `exec` with a read-only sandbox, `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, its shell and other agent tools disabled, and web search disabled. `--dangerously-bypass-approvals-and-sandbox` is never used.

Both CLIs are spawned without a shell, in a new empty temporary directory, with an allowlisted environment. `TYPESAFE_API_KEY`, OAuth secrets and `LLM_API_KEY` are not passed. Output and time are bounded. A reported tool attempt, permission denial, sub-agent or web request refuses the draft. Detecting a reported event is not the same as preventing its first side effect; the protection is that no tool is granted (Claude Code) or that the shell tool is disabled in a read-only sandbox (Codex). The CLIs use the person's own sign-in; their providers' terms and retention apply.

## AI log

The AI log keeps the exact Jev and drafting exchanges so a person can see what was sent and what came back. It is held in the local server's memory only, never written to disk, capped at 300 calls, and cleared on vault lock or erase, on disconnect of the account a call was sourced from, on explicit clear and on restart. Before storage, every configured secret value (`TYPESAFE_API_KEY`, `LLM_API_KEY`, OAuth client secrets, account access and refresh tokens, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) and common token patterns are replaced with `[REDACTED]`; long fields are truncated and marked. The log does contain the transmitted message excerpts, prompts and raw engine output: its routes use the same local guards as the connector API, and an export is a plain JSON file to protect like your mail. Absolute temporary paths in CLI arguments are replaced with `<temp dir>`; a CLI's own stderr may still mention local paths.

## Formatted mail view

The default message view is plain text. The optional formatted view renders sanitized HTML (scripts, event handlers, forms, frames, objects, SVG/MathML, meta refresh and non-http(s)/mailto/tel/cid links removed; data URLs only for images) inside an `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox">`. The frame route answers only same-origin iframe requests and sends its own `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox …` with `X-Frame-Options: SAMEORIGIN`. Remote images and tracking pixels are therefore not loaded. The regex sanitizer is one layer; the CSP without script sources and the sandbox without `allow-scripts`/`allow-same-origin` are the others. What Jev or an LLM receives is always the plain text.

## Persistence and local trust

By default, all connected data is process-memory-only. Optional persistence derives a 256-bit key with scrypt N=16384/r=8/p=1 and uses AES-256-GCM with random salt/nonce and authenticated metadata. The passphrase is not saved. The encrypted file is created under `.data/`; permissions are requested as 0700 directory/0600 file where the operating system supports them. Windows ACL equivalence is not guaranteed by Unix mode bits.

Encryption protects the file at rest, not an unlocked server, browser display, malware, swap, crash dumps, screenshots, copied data, `.env` client secrets or receipt exports. JavaScript memory erasure is best effort. Another local process can supply the same HTTP headers; origin checks are not local-user authentication. Close/lock the server explicitly. There is no idle auto-lock or per-browser authenticated session.

Temporary-file rename is used, but fsync/power-loss durability and multi-process access have not been certified. Run one process per working directory. Memory-only operation does not preserve idempotency or history across process restarts.

## Consent lifecycle

Google compose scopes permit sending at the provider even though no send route exists in Essentiel. Microsoft draft creation uses Mail.ReadWrite but not Mail.Send. Scope grants are broader than UI behavior and remain an exposure if the process is compromised.

Disconnect and erase are local operations. They do not revoke provider grants, delete remote objects or erase TypeSafe records. Use provider account settings for OAuth revocation. Client-secret rotation is configured outside Essentiel. Deleting the connected vault does not erase separately stored legacy workspace data or previously exported receipts. Journal exports are unencrypted personal data and contain no access/refresh tokens.

## Validation limits and release prerequisites

Automated tests use synthetic providers. Native consent screens, tenant policies, Google public verification, independent penetration testing, real-account revocation/refresh behavior, mobile browser behavior and cloud deployments have not been validated. Managed build Chromium blocked URL navigation; DOM checks use injected app code plus a controlled local-HTTP bridge. HTTP security tests are independent Node tests.

Do not expose this server on a public network. A hosted release requires independent threat modeling, authenticated sessions, tenant isolation, HTTPS, managed encryption keys, consent/revocation operations, retention/deletion implementation, operational monitoring, rate-limit/load validation and provider app approval. Use `LIVE_ACCEPTANCE.md` for live connector checks; it does not replace a security audit.
