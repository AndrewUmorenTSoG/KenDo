# 01 · Architecture

## Request path

```
ChatGPT / VS Code Copilot / Copilot Studio
   │  HTTPS, MCP Streamable HTTP, Authorization: Bearer <token>
   ▼
Netlify Function  mcp.mts        POST /mcp
   │  origin check → bearer token check (Firestore lookup, connection still exists, audience = /mcp)
   │  → per-request McpServer with only the tools the granted scopes allow
   ▼
netlify/lib/mcp/tools.mts       strict zod schemas, structured answers, rate limit, timeout, audit
   ▼
netlify/lib/mcp/kendo.mts       KenDo's rules for one person (same rules as src/data/tasks.ts,
netlify/lib/mcp/planning.mts    via src/lib/taskRules.ts and src/lib/recurrence.ts)
   ▼
Firestore (Admin SDK)            the same users/{uid}/... documents the app uses
   ▼
KenDo app (live onSnapshot)      changes appear immediately; send-reminders sends the push
```

One endpoint, one system of record. No second database, scheduler or UI. Reminders are the existing ones: the server only sets `remindAt`, and the existing `send-reminders` function (every 5 minutes) delivers them, whether or not the AI app is still open.

## Protocol

* SDK: `@modelcontextprotocol/server` **2.4.0** (the official TypeScript SDK, v2 line, released 23 October 2026). `createMcpHandler` serves the **2026-07-28** protocol and falls back to **stateless 2025-era Streamable HTTP** for clients that start with `initialize` (tested with `2025-06-18`). No deprecated HTTP+SSE transport.
* Stateless: a fresh server per request, JSON responses. `GET /mcp` (long-lived SSE) is refused with 405, which keeps Netlify function time (credits) tiny.
* Bodies over 256 KB are refused (413). Each tool has an 8 s budget (Netlify's synchronous limit is 10 s).

## Sign-in for AI apps (OAuth 2.1)

Firebase Auth isn't an OAuth server for third parties, so KenDo has a small authorisation server of its own (`netlify/lib/mcp/oauth.mts`, `netlify/functions/oauth.mts`). It costs nothing: Netlify Free + Firestore Spark.

```
AI app ──POST /mcp (no token)──────────────▶ 401 + WWW-Authenticate: resource_metadata=…/.well-known/oauth-protected-resource/mcp
AI app ──GET  /.well-known/oauth-protected-resource/mcp ─▶ { resource: …/mcp, authorization_servers: [site] }
AI app ──GET  /.well-known/oauth-authorization-server   ─▶ endpoints, S256, scopes, DCR + CIMD
AI app ──POST /oauth/register (DCR)  or  client_id = https URL of its metadata document (CIMD)
Browser ─GET /connect?client_id&redirect_uri&code_challenge&state&scope&resource
         KenDo SPA: normal Firebase sign-in, then "Connect ChatGPT?" with scope checkboxes
         SPA ─POST /oauth/authorize/check     (same-origin) validate and describe
         SPA ─POST /oauth/authorize/decision  (same-origin, fresh Firebase ID token verified server-side)
         ◀── redirect_uri?code&state&iss
AI app ──POST /oauth/token (code + code_verifier) ─▶ access token (1 h) + refresh token (30 days, rotating)
```

Decisions:

* **Authorization code + PKCE S256 only.** No implicit, no password grant.
* **Opaque tokens**, stored as SHA-256 hashes in `oauthTokens` (server-only collection). Each MCP request checks the token and that `users/{uid}/connections/{grantId}` still exists, so **Disconnect in Settings is instant**.
* **Audience**: tokens are bound to `https://<site>/mcp` (RFC 8707 `resource`); other values are refused.
* **Redirect allowlist**: ChatGPT, VS Code (loopback and vscode.dev), Power Platform consent hosts (Copilot Studio), Claude; extendable with `MCP_REDIRECT_URIS`. Bad client or return address → error shown on the page, never a redirect.
* **Refresh rotation with reuse detection**: replaying an old refresh token ends the whole connection. A code used twice also ends its connection.
* Consent page refuses to run inside a frame; the decision endpoint only accepts the KenDo origin and a freshly minted ID token (checked for revocation).

## Scopes

`kendo:tasks:read`, `kendo:tasks:write`, `kendo:projects:read`, `kendo:projects:write`, `kendo:matrix:read`, `kendo:matrix:write`, `kendo:calendar:read`, `kendo:notes:read`, `kendo:notes:write`, `kendo:reminders:write`. The person can untick any on the consent page; tools needing an ungranted scope are not offered at all.

## Preview → approve → apply

Bulk changes, matrix rearranging, rescheduling, note-to-tasks and deleting never write directly. A preview tool computes the change and stores a **plan** in `mcpPlans/{plan_id}`: bound to the person and the AI app, expires in 15 minutes, single use, with each task's `updatedAt` at preview time and a digest of the operations. `apply_plan` needs the plan id and its confirmation code, re-checks everything inside one Firestore transaction (all or nothing) and refuses if any task changed. Applied plans keep their before-values, so `preview_undo` can reverse them.

## Trust boundaries

| Boundary | Control |
| --- | --- |
| Internet → `/mcp` | Bearer token, audience, origin allowlist, size and rate limits |
| AI app → KenDo data | Scopes; user id comes only from the token; every id is looked up inside what that person can reach (own data + shared projects they're still in) |
| Browser → `/oauth/authorize/*` | Same-origin, Firebase ID token verified with the Admin SDK |
| Text inside tasks/notes → AI model | Treated as data; no tool can widen access, fetch URLs or run code |

## Where things are

| File | Role |
| --- | --- |
| `netlify/functions/mcp.mts`, `netlify/lib/mcp/mcpRoute.mts` | `/mcp` endpoint |
| `netlify/functions/oauth.mts`, `netlify/lib/mcp/oauth*.mts`, `config.mts` | OAuth endpoints and discovery metadata |
| `netlify/lib/mcp/tools.mts` | Tool catalogue |
| `netlify/lib/mcp/kendo.mts`, `planning.mts`, `zoned.mts` | KenDo rules on the server, plans, time zones |
| `netlify/lib/workspace.mts` | "What can this person reach", shared with the calendar feed |
| `src/lib/taskRules.ts` | Rules shared by the app and server |
| `src/pages/ConnectPage.tsx`, Settings → AI apps | Consent page; connected apps with Disconnect |
