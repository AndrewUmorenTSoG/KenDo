# 07 · Testing and acceptance

## Commands

```bash
npm ci
npm run lint        # oxlint, 0 errors (27 warnings, all from before this work)
npm run build       # type checks app, service worker and functions, then builds
npm test            # starts the Firestore emulator (needs Java 21) and runs every test
npm run test:unit   # without the emulator: only the time zone and matrix rule tests run
```

CI (`.github/workflows/ci.yml`) runs lint, build and the full tests on every pull request. It uses GitHub Actions minutes, not Netlify credits.

## Results (2 November 2026, this branch)

`npm test`: **5 files, 37 tests, all passing** (about 17 s). The MCP tests drive the real `/mcp` and OAuth handlers in-process with the official `@modelcontextprotocol/client` 2.4.0, against the Firestore emulator.

| Required case | Test |
| --- | --- |
| 1 Read/create/edit/complete round trip in KenDo's own documents | `mcp.test.mts` › tasks round trip |
| 2 Project link, matrix placement, status and order persist | round trip; "orders tasks inside a quadrant" |
| 3 Matrix preview makes zero writes; apply touches only reviewed items | "reads quadrants, previews with zero writes…" |
| 4 Stale, expired, altered or reused plan refused | "rejects a stale or expired plan"; reuse in the matrix test |
| 5 No access to another person's tasks, projects, notes or plans; shared projects follow membership | isolation (2 tests) |
| 6 Revoked, expired, under-scoped, wrong-audience, forged tokens refused | `oauth.test.mts` › tokens; scopes test |
| 7 Retries don't duplicate tasks or reminders | a new task needs approval and its plan applies once, even when applied twice at the same moment; reminders test |
| 8 Concurrent edits can't silently overwrite | "refuses a write based on an old revision" |
| 9 Recurring task keeps its local time across BST | `zoned.test.mts` (both changes) and the weekly Bible study test |
| 10 No duplicate or ghost reminders | `reminders.test.mts` runs the real `send-reminders` twice |
| 11 Bad ids, dates, extra fields, huge bodies fail safely | "scopes and bad input" |
| 12 Malicious note text can't cause unauthorised behaviour | note-to-tasks test (instruction text becomes nothing) and isolation tests |
| 13 Bulk changes all-or-nothing, with a repair path | "applies all or nothing when one task changed"; undo tests |
| 14 Discovery with real clients | Official MCP client: full OAuth discovery, DCR, PKCE, token, `tools/list`; plus a raw 2025-06-18 `initialize` |
| 15 Existing app unaffected | `npm run build` type checks the whole app; the matrix page uses the shared rules (`taskRules.test.ts`) |

Also checked: the `mcp` function bundles with esbuild and answers `401` with the right `WWW-Authenticate` header when run as a plain Node module.

## Still to check by hand (needs the deployed site and your accounts)

1. After merging, the two `curl` checks in 06.
2. ChatGPT: add the connector (04), approve, run the five prompts. Confirm the task appears in KenDo on your phone.
3. VS Code: add `kendo` (05), approve, ask for the agenda.
4. Copilot Studio, only if you have a licence or trial.
5. Settings → AI apps shows each app; Disconnect stops it.
6. A reminder set from ChatGPT arrives as a push within 5 minutes.

## Known gaps

* Client setup pages (OpenAI, VS Code, Microsoft) couldn't be read from the build environment, so the menu paths in 04/05 are from memory and should be checked once.
* The consent page and Settings section have no automated UI test; they're small and covered by the endpoint tests behind them.
* Firestore rules weren't changed and aren't unit tested with the rules emulator.
