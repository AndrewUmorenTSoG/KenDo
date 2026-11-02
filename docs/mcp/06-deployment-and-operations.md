# 06 · Deployment and operations

## Cost: stays free

| Piece | Plan | Use |
| --- | --- | --- |
| `/mcp`, `/oauth/*`, `/.well-known/*` | Netlify Free (300 credits/month) | Synchronous functions, ~100–500 ms each, no streams. A heavy month of 3,000 AI calls is roughly 0.5 GB-hours, about 5 credits. A production deploy is 15 credits, so batch merges as usual |
| Data | Firestore Spark (50k reads, 20k writes a day) | A tool call reads the person's tasks and projects (one read per document), so about 100–400 reads per call for Kenny today. ~100 calls a day stays well under the limit. Plans, tokens and audit add a handful of writes |
| Sign-in | Firebase Auth (free) | ID token verification is free |
| Reminders | Existing `send-reminders` | Nothing new |

Nothing here needs Firebase Blaze, Supabase, Vercel or a paid Netlify plan.

## Environment variables (Netlify → Site configuration → Environment variables)

| Name | Needed | Notes |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | already set | Same as for reminders |
| `KENDO_PUBLIC_URL` | optional | Defaults to Netlify's `URL` (production) or the preview's URL. Set it if you add a custom domain, and keep it stable: AI apps remember the issuer |
| `MCP_REDIRECT_URIS` | optional | Extra allowed return addresses, comma separated |
| `MCP_ALLOWED_ORIGINS` | optional | Extra browser origins for `/mcp` |

No new secrets.

## Deploying

1. Merge the PR into `main` (one 15-credit deploy). Netlify builds the app and the three functions (`send-reminders`, `calendar-feed`, plus new `mcp` and `oauth`).
2. Check: `https://kendoktb.netlify.app/.well-known/oauth-authorization-server` returns JSON, and `curl -i -X POST https://kendoktb.netlify.app/mcp` returns `401` with a `WWW-Authenticate` header.
3. Firestore rules: **no change needed** (new collections are server-only by default).
4. Optional: in Firebase console → Firestore → TTL policies, add `expireAt` on collection groups `oauthTokens`, `oauthCodes`, `mcpPlans`, `mcpIdempotency`, `mcpAudit` to clean up old records (only if your plan offers TTL; nothing breaks without it).

## Operations

* **See who's connected / revoke:** KenDo → Settings → AI apps → Disconnect. Instant.
* **Revoke everything:** delete the `oauthTokens` collection in the Firebase console (everyone reconnects).
* **Audit:** `users/{uid}/mcpAudit` in the Firestore console; each task's activity list names the app.
* **Logs:** Netlify → Logs → Functions → `mcp` / `oauth`. Only unexpected errors are logged, never tokens or note text.
* **Rollback:** redeploy the previous deploy in Netlify. The app keeps working without these functions; `matrixRank` is an optional field the old app ignores.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| AI app says "redirect URI not allowed" | Its return address isn't in the allowlist; add it to `MCP_REDIRECT_URIS` |
| Sign-in page shows "This app is not registered with KenDo" | Client registration was lost or the app sent a different `client_id`; remove and re-add the connector |
| Every call returns 401 after connecting | Disconnected in Settings, refresh token replayed, or the app keeps an old token; reconnect |
| `/mcp` returns the KenDo web page | Function not deployed (check Netlify → Functions) |
| Times an hour off | The profile's time zone; it's written when KenDo is opened on a device |
| `rate_limited` | More than 90 calls a minute |
