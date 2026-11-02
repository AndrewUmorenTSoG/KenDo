# 03 · Security and threat model

## Assets

KenDo tasks, notes and projects of 1–4 people (some shared between them); the Firebase service account (server env only); OAuth tokens.

## Threats and mitigations

| # | Threat | Mitigation | Tested |
| --- | --- | --- | --- |
| 1 | Someone calls `/mcp` without signing in | Bearer token required; 401 with RFC 9728 `resource_metadata` | yes |
| 2 | Forged, expired, wrong-audience, disconnected tokens | Opaque random 256-bit tokens looked up by SHA-256; expiry; `resource` must equal `/mcp`; connection doc must exist | yes |
| 3 | One person reaching another's data (ids, project ids, plan ids, note links) | User id only from the token. Every id is resolved inside the person's reachable set (own + shared projects with current membership, re-checked each request); writes go to the path found that way, never one from input. Plans are bound to user and app; foreign ones look "not found" | yes |
| 4 | AI app tricked by text in a note ("ignore previous rules…") | Server instructions and tool descriptions say content is data. More importantly the server enforces scopes, ownership and preview→apply regardless of what the model is told; no tool fetches URLs, runs code or widens access | yes |
| 5 | Bulk or destructive changes without the person seeing them | Preview tools never write tasks. `apply_plan` needs the plan id and code, is marked destructive so clients ask for confirmation, expires in 15 min, single use, all-or-nothing, refuses if anything changed. Undo plans | yes |
| 6 | Lost updates between the app and an AI app | `expected_revision` check in a transaction; plans re-check every task's revision | yes |
| 7 | Duplicate tasks on retries | `idempotency_key` recorded in the same transaction as the write | yes |
| 8 | Stolen authorization code or refresh token | PKCE S256, 5-min single-use codes (reuse ends the connection), rotating refresh tokens with reuse detection | yes |
| 9 | Malicious client registration / open redirect | Redirect allowlist (exact or path prefix); errors with bad client or return address are shown, not redirected; DCR capped at 30/hour globally; names stripped of markup | yes |
| 10 | Client metadata document (CIMD) used for SSRF | https only, no IP literals or localhost, no redirects, 5 s timeout, 10 KB cap, cached 24 h | partly (fetch stubbed) |
| 11 | Consent clickjacking / CSRF on approval | Consent page refuses to run in a frame; decision endpoint needs the KenDo Origin and a fresh Firebase ID token (revocation checked) | yes (origin) |
| 12 | Cross-site browser calls / DNS rebinding | `Origin` allowlist on `/mcp` (desktop apps send none); CORS without credentials | partly |
| 13 | Abuse / cost | 256 KB bodies, list caps (100), plan cap (100 ops), 8 s tool timeout, 90 calls/min per person per warm instance, no long-lived streams | yes (size) |
| 14 | Secrets leaking | Only `FIREBASE_SERVICE_ACCOUNT` (already present). Tokens stored hashed; logs never include tokens or note text; errors are generic for unexpected failures | review |

## Known limits (honest list)

* **Approval relies partly on the AI app.** The server guarantees a preview happened, is unchanged, fresh, single-use and the person's own, but the confirmation code is returned to the AI app with the preview. The person's approval is the app's confirmation prompt for `apply_plan` (marked destructive) and the instruction to show the plan first. A stricter option is to show the code only inside KenDo (an "Approve" page) — a small UI addition if wanted.
* The rate limit is per warm function instance, not global (free plan has no shared cache).
* `firestore.rules` let a person write their own `users/{uid}/connections` and `mcpAudit` documents. That can't grant access (tokens live in a server-only collection), but a person could edit their own audit trail. Netlify function logs are the second record.
* Firestore TTL policies aren't set up; expired codes, tokens, plans and audit entries carry an `expireAt` field so one can be added later. Old ones are harmless (they fail checks).

## Logging and audit

* Each write tool adds `users/{uid}/mcpAudit/{id}`: time, app, tool, affected ids, outcome (no content), kept 90 days by `expireAt`.
* The task's own activity line says what changed and which app did it ("Rescheduled by ChatGPT · 02/11/2026, 15:40:00"), visible in the task editor.
* Function logs only record unexpected error messages.

## Disconnect, deletion, retention

* Settings → AI apps → Disconnect deletes the connection; the next request with any of its tokens fails.
* KenDo has no account-deletion feature. If an account is deleted from the Firebase console, its tokens can't be refreshed (the ID token check fails for new approvals) and its data is gone; leftover token documents expire within 30 days.
