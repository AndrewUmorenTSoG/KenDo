# 00 · Existing system audit

What KenDo actually is, read from the code on `main` at commit `06e9331` (2 November 2026), before any MCP work.

## Stack

| Area | Fact | Where |
| --- | --- | --- |
| App | Vite 8 + React 19 + TypeScript 7, installable PWA (`vite-plugin-pwa`, injectManifest) | `package.json`, `vite.config.ts`, `src/sw.ts` |
| Data | Firebase Firestore (Spark, free), persistent offline cache in the browser | `src/lib/firebase.ts` |
| Sign-in | Firebase Auth: email/password and Google. **Not an OAuth server** for third parties | `src/pages/SignInPage.tsx`, `src/hooks/useAuth.tsx` |
| Server code | Netlify Functions (Free plan): `send-reminders` (scheduled `*/5`), `calendar-feed` (`/feed/:uid/:token`) | `netlify/functions/`, `netlify/lib/` |
| Admin access | Firebase Admin SDK with `FIREBASE_SERVICE_ACCOUNT` (server only) | `netlify/lib/admin.mts` |
| Push | Firebase Cloud Messaging data messages to `users/{uid}/devices/{token}` | `netlify/lib/push.mts`, `src/lib/notifications.ts` |
| Tests | None before this work. Lint is `oxlint` | `package.json` |
| Hosting | Netlify, `https://kendoktb.netlify.app`, SPA redirect `/* → /index.html` | `netlify.toml` |

Not used: Supabase, Vercel, SQL, RLS. "Row level security" here means **`firestore.rules`**.

## Data model (Firestore)

Everything lives under `users/{uid}`:

| Path | Contents |
| --- | --- |
| `users/{uid}` | Profile: `name`, `timeZone` (written by the app from the browser), theme and switches, `completedTotal`, `calendarToken`… (`src/lib/types.ts` `Profile`) |
| `users/{uid}/tasks/{id}` | Task (`src/lib/types.ts` `Task`): `title`, `description`, `projectId`, `priority` high/medium/low, `status` todo/doing/done, `energy`, `important`, `date` "YYYY-MM-DD" and `time` "HH:MM" **local wall-clock**, `estimate` minutes, `repeat` never/daily/weekly/monthly, `recurringFrom`, `colour`, `tags`, `subtasks[{title,done}]`, `comments`, `activity` (last 30 lines), `dependsOn` (one prerequisite), `noteId`, `reminder`, `remindAt` (ms), `reminderSent`, `completedOn`, `uid`, `createdAt`, `updatedAt` |
| `users/{uid}/projects/{id}` | `name`, `colour` (purple/green/yellow/pink), `uid`, `createdAt`; sharing adds `shared`, `members`, `memberNames`, `inviteCode` |
| `users/{owner}/projects/{id}/tasks/{id}` | Tasks of a **shared** project live next to it so members can reach them |
| `users/{uid}/joined/{projectId}` | Pointer to a project someone shared with you (`owner`) |
| `users/{uid}/notes/{id}` | `title`, `body` (sanitised HTML; checklist lines start with ☐/☑), `colour`, `projectId`, `pinned`, `archived` |
| `habits`, `focusSessions`, `reflections`, `devices` | Not exposed to AI apps |

Projects have **no** status, start/end dates or ordering field. Tasks have no assignee, no start date, no multiple dependencies. There is no separate calendar-event store: **the calendar is dated tasks**. Google Calendar / Outlook is a one-way private ICS feed out of KenDo (`calendar-feed.mts`); nothing is read back in.

## Security rules

`firestore.rules`: a user can read/write everything under `users/{uid}`; shared projects are readable by `members`, joinable with the invite code, and their tasks are read/write for members. **No other path is allowed**, so new top-level collections are server-only by default.

## Business rules found (and reused)

| Rule | Source |
| --- | --- |
| New task defaults; every dated task gets a reminder at its time, or 9:00 if none; past times get none | `blankTask`, `remindTime`, `withReminder` in `src/data/tasks.ts` |
| Editing date/time recomputes the reminder; moving into/out of a shared project moves the document | `updateTask` |
| Can't start/finish while the prerequisite is open; completing a repeating task creates the next one once (`recurringFrom`); completion counts toward `completedTotal` | `setStatus`, `useTaskActions.tsx` |
| Deleting a task clears it as anyone's prerequisite | `deleteTask` |
| No dependency loops | `dependsOnChain` |
| Recurrence: next day / +7 days / +1 month, on the local date key | `src/lib/recurrence.ts` |
| Reminder delivery: scheduled function every 5 minutes; marks `reminderSent` before sending, skips done tasks | `send-reminders.mts` |

## What "Project Matrix" means in KenDo

There is one matrix: the **Priority matrix** page (`src/pages/MatrixPage.tsx`, route `/matrix`, eyebrow "PRIORITY MATRIX"). It **is an Eisenhower matrix** with four quadrants:

| Id (MCP) | Label in the app | Rule |
| --- | --- | --- |
| `do_first` | Do first · Urgent & important | urgent and important |
| `make_time` | Make time · Important, not urgent | important, not urgent |
| `share_the_load` | Share the load · Urgent, less important | urgent, not important |
| `let_it_wait` | Let it wait · Neither urgent nor important | neither |

* **Urgent** = the task's `date` is today or tomorrow, or overdue. **Important** = the task's own `important` flag ("Important to me" in the task editor). Only open tasks show.
* Placement is **derived**, not stored. There is no drag and drop on the matrix and **no persisted order inside a quadrant** (tasks appeared in Firestore id order).
* The Projects page is a separate Kanban board (To do / Doing / Done per project) — not a matrix.

## Gaps and the minimal changes made

| Gap | Change |
| --- | --- |
| Matrix order within a quadrant isn't stored, so "move X ahead of Y" couldn't persist | Additive optional field `matrixRank` on tasks. The matrix page shows ranked tasks first, in rank order; everything else stays as before. No migration needed |
| Matrix and task rules lived only in browser code that imports the Firebase web SDK | Pure rules moved to `src/lib/taskRules.ts` (quadrants, urgency, blocked, loops, defaults), used by the app and the server |
| Reminder times were computed in the browser's zone | Server computes the same rule in the profile's `timeZone` (default `Europe/London`) — `netlify/lib/mcp/zoned.mts` |
| Firebase Auth can't act as an OAuth server for AI apps | A small OAuth 2.1 authorisation server on Netlify Functions that approves with the existing Firebase sign-in (see 01) |
| No tests | Vitest + the Firestore emulator |

## Risky assumptions (checked, or flagged)

* `profile.timeZone` is written by the app from the browser; if it is missing the server uses `Europe/London`.
* Netlify functions with a `path` take precedence over the `/*` SPA redirect (the existing `/feed/...` function relies on the same behaviour).
* A client-side edit can recompute `remindAt` from date/time and overwrite a custom reminder set by an AI app (same as snooze in the app today).
