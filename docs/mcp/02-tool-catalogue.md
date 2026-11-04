# 02 · Tool catalogue

All 32 tools are implemented and covered by tests (see 07). Inputs are strict JSON Schema objects (unknown fields are refused). Dates are `YYYY-MM-DD` and times `HH:MM`, local to the person's time zone.

Every answer is JSON in both `structuredContent` and a text block:

```json
{ "success": true, "action": "created", "result": { … }, "warnings": [], "timezone": "Europe/London" }
{ "success": false, "error": { "code": "conflict", "message": "…", "details": { "revision": 1793 } } }
```

Error codes: `not_found` (also for anything belonging to someone else), `invalid_input`, `conflict` (changed since read, or stale plan), `blocked` (prerequisite open), `forbidden`, `plan_expired`, `plan_used`, `rate_limited`, `unavailable`, `internal`.

Tasks carry `revision` (their `updatedAt`). Pass it back as `expected_revision` to refuse overwriting newer edits. `create_project`, `create_note` and `add_subtasks` accept `idempotency_key` so retries never duplicate; a new task goes through a single-use plan, so it can't be added twice.

## Read (no changes; `readOnlyHint: true`)

| Tool | Scopes | What it returns |
| --- | --- | --- |
| `get_kendo_profile` | any | name, time zone, today, connected app, granted scopes |
| `search_kendo` | per type | tasks (title/description/tags), projects (name), notes (title/text); paged |
| `list_tasks` | tasks:read | filters: project, status, priority, important, date range, overdue, undated, tag, quadrant, blocked; sort date/priority/updated/created; paged (`limit` ≤ 100, `next_cursor`, `total`) |
| `get_task` | tasks:read | everything incl. steps with indexes, last comments and activity |
| `list_projects` | projects:read | each project with open/doing/done/overdue counts, progress %, next date, link |
| `get_project` | projects:read, tasks:read | project summary and its tasks |
| `get_project_matrix` | matrix:read | the four quadrants with their tasks in on-screen order, the rules, and a revision |
| `analyse_project_matrix` | matrix:read | `observations` (overdue, blocked, busy days over capacity, same-time clashes, idle projects) kept apart from `suggestions` (rule-based, nothing changes) |
| `get_agenda` | calendar:read | dated tasks by day for up to 62 days |
| `list_reminders` | tasks:read | pending reminders and when they fire |
| `list_notes`, `get_note` | notes:read | notes as plain text |

## Single changes (`readOnlyHint: false`)

| Tool | Scopes | Side effects |
| --- | --- | --- |
| `create_task` | tasks:write (`readOnlyHint: true`) | **Preview only**: plans one new task (`kind: new_task`) and returns it in full plus `plan_id` and `confirmation_code`; nothing is added until `apply_plan`. The task gets KenDo's defaults; dated tasks get a reminder (its time or 9:00); activity "Created by <app>". Repeats with `repeat` plus optional `repeat_every`, `repeat_on` (weekdays) and `repeat_until`; tasks report `repeat_rule` in words |
| `update_task` | tasks:write | Patch only the given fields; date/time change moves the reminder; project change moves the document for shared projects; `status` follows app rules |
| `complete_task` / `reopen_task` | tasks:write | As ticking it in KenDo: blocked while prerequisite open; repeating task gets its next occurrence once (none when paused or past `repeat_until`); completion counter |
| `add_subtasks`, `update_subtask` | tasks:write | Steps on a task |
| `reorder_matrix_items` | matrix:write, tasks:write | Exact order inside one quadrant (`matrixRank`); no dates or Important changes |
| `set_reminder`, `cancel_reminder` | reminders:write, tasks:read | Real KenDo reminder (`remindAt`), sent by the existing scheduled function; refuses past times |
| `create_project`, `update_project` | projects:write | Name and colour; only the owner can rename a shared project |
| `create_note`, `update_note` | notes:write | Plain text in, the editor's HTML stored; `append_text` adds to the end |

## Previews (save a plan, change nothing) and apply

| Tool | Scopes | Plans |
| --- | --- | --- |
| `preview_task_changes` | tasks:write | Up to 100 tasks: date, time, priority, Important, status To do/Doing, energy, estimate, colour, tags. Done tasks skipped unless `include_done` |
| `preview_matrix_reorganisation` | matrix:write, tasks:write | Explicit `moves` (quadrant, optional `position`, `new_date` required to cross urgent/not urgent) and/or rules (`important_when_priority`, `important_when_due_within_days`) and `order_by`. Lists from/to quadrant per task and conflicts |
| `suggest_schedule` | calendar:read, tasks:write | 1–7 days: fits untimed tasks between timed ones in working hours, prerequisites first, lists what doesn't fit and the assumptions |
| `preview_note_to_tasks` | notes:read, tasks:write | Tasks linked to the note, from given `items` or the note's open ☐ lines and bullets; skips duplicates of open tasks |
| `preview_delete_tasks` | tasks:write | Up to 25 deletions, plus clearing them as prerequisites |
| `apply_plan` | tasks:write (`destructiveHint: true`) | Applies a plan atomically with `plan_id` + `confirmation_code`; refuses expired, used, altered, cross-account or stale plans |
| `preview_undo` | tasks:write | A plan that reverses an applied one, refused if those tasks changed again |

A preview answer looks like:

```json
{ "plan_id": "plan_…", "summary": "Rearrange 2 tasks in the priority matrix", "change_count": 2,
  "changes": [{ "action": "update", "task_id": "…", "title": "Presentation prep",
                "before": { "important": false }, "after": { "important": true } }],
  "placements": [{ "task_id": "…", "from": "share_the_load", "to": "do_first" }],
  "conflicts": [], "confirmation_code": "4F09A2", "expires_at": "2026-11-02T15:45:00+00:00",
  "nothing_changed_yet": true, "next_step": "Show the person these changes…" }
```

## Not supported (and the smallest addition if wanted)

| Asked for | Status |
| --- | --- |
| Project status, start/end dates, project ordering | KenDo projects don't have them. Would need new project fields and UI |
| Task assignee, start date, several prerequisites | Not in KenDo |
| External calendar events / free-busy | KenDo doesn't read Google/Outlook. Would need a Google/Microsoft OAuth app (free, but extra setup) |
| Several reminders per task, recurrence exceptions, "only this occurrence" vs series | KenDo has one reminder per task. Each occurrence is its own task, so editing one through the connector changes only that one; the app offers this one / this and future / whole series |
| Archive tasks | KenDo has no archive for tasks; delete is available through a plan |
| Bulk completion | Complete one at a time (`complete_task`) so repeats and prerequisites behave |
