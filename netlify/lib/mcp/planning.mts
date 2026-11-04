import { shift } from '../../../src/lib/dates'
import { isBlocked, priorityRank, quadrantOf, quadrants, byMatrixRank, type QuadrantId } from '../../../src/lib/taskRules'
import type { Priority } from '../../../src/lib/types'
import { hash, htmlToText, KenDo, newId, ToolError, type Plan, type PlanOp, type StoredTask, type TaskEntry, type TaskPatch } from './kendo.mts'
import { isoInZone, toLocal } from './zoned.mts'

// The priority matrix, analysis and the preview half of every bulk change. Nothing here writes a task:
// previews are saved as plans, and only apply_plan changes KenDo.

const minutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
const clock = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

const open = (t: TaskEntry) => t.data.status !== 'done'

function compact(t: TaskEntry, projectName: (id: string | null) => string | null, all: TaskEntry[]) {
  const linked = all.map((x) => ({ id: x.id, dependsOn: x.data.dependsOn, status: x.data.status }))
  return {
    id: t.id,
    title: t.data.title,
    status: t.data.status,
    priority: t.data.priority,
    important: !!t.data.important,
    date: t.data.date || null,
    time: t.data.time || null,
    estimate_minutes: t.data.estimate,
    project_name: projectName(t.data.projectId),
    blocked: isBlocked(t.data, linked),
    matrix_rank: t.data.matrixRank ?? null,
    revision: t.data.updatedAt,
  }
}

async function namer(k: KenDo) {
  const projects = await k.projects()
  return (id: string | null) => projects.find((p) => p.id === id)?.name ?? null
}

async function scope(k: KenDo, projectId?: string, taskIds?: string[]) {
  if (projectId) await k.project(projectId)
  const all = await k.tasks()
  let list = all.filter(open)
  if (projectId) list = list.filter((t) => t.data.projectId === projectId)
  if (taskIds?.length) {
    for (const id of taskIds) await k.task(id)
    list = list.filter((t) => taskIds.includes(t.id))
  }
  return { all, list }
}

// --- Matrix -------------------------------------------------------------------------------------------------

export const MATRIX_RULES = {
  urgent: 'Due today or tomorrow, including anything overdue (from the task date, in your time zone).',
  important: 'The task’s own “Important to me” switch.',
  shown: 'Only open tasks (To do and Doing). Done tasks leave the matrix.',
  order: 'Inside a quadrant, tasks given a place (matrix_rank) come first, lowest first; the rest follow in their usual order.',
}

export function matrixRevision(tasks: TaskEntry[]) {
  return hash(tasks.filter(open).map((t) => [t.id, t.data.updatedAt]))
}

export async function matrixView(k: KenDo, projectId?: string) {
  const [{ all, list }, name, today] = await Promise.all([scope(k, projectId), namer(k), k.today()])
  return {
    today,
    time_zone: await k.timeZone(),
    revision: matrixRevision(all),
    rules: MATRIX_RULES,
    quadrants: quadrants.map((q) => {
      const tasks = byMatrixRank(list.filter((t) => quadrantOf(t.data, today) === q.id), (t) => t.data.matrixRank)
      return { id: q.id, title: q.title, description: q.sub, urgent: q.urgent, important: q.important, count: tasks.length, tasks: tasks.slice(0, 100).map((t) => compact(t, name, all)) }
    }),
  }
}

export async function analyseMatrix(k: KenDo, input: { projectId?: string; horizonDays?: number; dailyCapacityMinutes?: number }) {
  const [{ all, list }, name, today] = await Promise.all([scope(k, input.projectId), namer(k), k.today()])
  const horizon = shift(today, input.horizonDays ?? 7)
  const capacity = input.dailyCapacityMinutes ?? 360
  const c = (t: TaskEntry) => compact(t, name, all)
  const linked = all.map((x) => ({ id: x.id, dependsOn: x.data.dependsOn, status: x.data.status }))

  const overdue = list.filter((t) => t.data.date && t.data.date < today)
  const blocked = list.filter((t) => isBlocked(t.data, linked))
  const urgentNotImportant = list.filter((t) => quadrantOf(t.data, today) === 'share_the_load' && t.data.priority === 'high')
  const importantLow = list.filter((t) => t.data.important && t.data.priority === 'low')
  const undated = list.filter((t) => !t.data.date)
  const byDay = new Map<string, TaskEntry[]>()
  for (const t of list) if (t.data.date && t.data.date >= today && t.data.date <= horizon) byDay.set(t.data.date, [...(byDay.get(t.data.date) ?? []), t])
  const hotspots = [...byDay]
    .map(([date, tasks]) => ({ date, minutes: tasks.reduce((s, t) => s + (t.data.estimate || 0), 0), tasks: tasks.length }))
    .filter((d) => d.minutes > capacity)
    .sort((a, b) => a.date.localeCompare(b.date))
  const clashes: { date: string; time: string; task_ids: string[] }[] = []
  const slots = new Map<string, string[]>()
  for (const t of list) if (t.data.date && t.data.time) slots.set(`${t.data.date} ${t.data.time}`, [...(slots.get(`${t.data.date} ${t.data.time}`) ?? []), t.id])
  for (const [k2, ids] of slots) if (ids.length > 1) clashes.push({ date: k2.slice(0, 10), time: k2.slice(11), task_ids: ids })

  const projects = await k.projects()
  const idleBefore = Date.parse(`${shift(today, -14)}T00:00:00Z`)
  const idle = projects
    .map((p) => {
      const mine = all.filter((t) => t.data.projectId === p.id)
      const last = mine.length ? Math.max(...mine.map((t) => t.data.updatedAt ?? 0)) : 0
      return { project_id: p.id, name: p.name, open_tasks: mine.filter(open).length, last_activity: last || null }
    })
    .filter((p) => p.open_tasks > 0 && (p.last_activity ?? 0) < idleBefore)

  // A suggested next step per quadrant: unblocked, earliest date, then priority.
  const next = (['do_first', 'make_time'] as QuadrantId[]).flatMap((q) =>
    list
      .filter((t) => quadrantOf(t.data, today) === q && !isBlocked(t.data, linked))
      .sort((a, b) => (a.data.date || '9999').localeCompare(b.data.date || '9999') || priorityRank[a.data.priority] - priorityRank[b.data.priority])
      .slice(0, 3)
      .map((t) => ({ ...c(t), quadrant: q })),
  )

  return {
    today,
    revision: matrixRevision(all),
    observations: {
      counts: Object.fromEntries(quadrants.map((q) => [q.id, list.filter((t) => quadrantOf(t.data, today) === q.id).length])),
      overdue: overdue.map(c),
      blocked: blocked.map((t) => ({ ...c(t), waiting_on: t.data.dependsOn })),
      unscheduled: undated.length,
      busy_days: hotspots,
      same_time_clashes: clashes,
      idle_projects: idle,
    },
    suggestions: {
      note: 'Suggestions from simple rules (dates, priority, the Important switch). The person decides; nothing has changed.',
      high_priority_but_not_marked_important: urgentNotImportant.map(c),
      marked_important_but_low_priority: importantLow.map(c),
      good_next_steps: next,
    },
  }
}

export interface MatrixMove {
  taskId: string
  quadrant: QuadrantId
  newDate?: string
  position?: number
}

export async function previewMatrix(
  k: KenDo,
  input: {
    projectId?: string
    taskIds?: string[]
    moves?: MatrixMove[]
    importantWhenPriority?: Priority[]
    importantWhenDueWithinDays?: number
    orderBy?: 'keep' | 'date' | 'priority' | 'date_then_priority' | 'priority_then_date'
  },
) {
  const [{ all, list }, today] = await Promise.all([scope(k, input.projectId, input.taskIds), k.today()])
  const tomorrow = shift(today, 1)
  const changes = new Map<string, TaskPatch>()
  const conflicts: { task_id: string; reason: string }[] = []
  const patch = (id: string, p: TaskPatch) => changes.set(id, { ...changes.get(id), ...p })

  // Rules first, then explicit moves, which always win.
  for (const t of list) {
    const byPriority = input.importantWhenPriority?.includes(t.data.priority)
    const bySoon = input.importantWhenDueWithinDays !== undefined && !!t.data.date && t.data.date <= shift(today, input.importantWhenDueWithinDays)
    if ((input.importantWhenPriority || input.importantWhenDueWithinDays !== undefined) && !!t.data.important !== !!(byPriority || bySoon))
      patch(t.id, { important: !!(byPriority || bySoon) })
  }
  for (const m of input.moves ?? []) {
    const t = all.find((x) => x.id === m.taskId)
    if (!t) throw new ToolError('not_found', `No task with id ${m.taskId}.`)
    if (!open(t)) {
      conflicts.push({ task_id: t.id, reason: 'The task is done, so it is not in the matrix.' })
      continue
    }
    const q = quadrants.find((x) => x.id === m.quadrant)!
    const date = m.newDate ?? changes.get(t.id)?.date ?? t.data.date
    const urgent = !!date && date <= tomorrow
    if (urgent !== q.urgent) {
      conflicts.push({
        task_id: t.id,
        reason: q.urgent
          ? `"${q.title}" needs a date on or before ${tomorrow}. Give new_date to move it; its date was left alone.`
          : `"${q.title}" needs a date after ${tomorrow} (or none). Give new_date to move it; its date was left alone.`,
      })
      patch(t.id, { important: q.important })
      continue
    }
    patch(t.id, { important: q.important, ...(m.newDate && m.newDate !== t.data.date ? { date: m.newDate } : {}) })
  }

  // Where each task ends up, then its place in the quadrant.
  const after = (t: TaskEntry) => ({ ...t.data, ...changes.get(t.id) }) as StoredTask
  const placed = all.filter(open)
  const orderBy = input.orderBy ?? 'keep'
  const explicit = new Map((input.moves ?? []).filter((m) => m.position !== undefined).map((m) => [m.taskId, m.position!]))
  if (orderBy !== 'keep' || explicit.size) {
    const scopeIds = new Set(list.map((t) => t.id))
    for (const q of quadrants) {
      const inQ = byMatrixRank(placed.filter((t) => quadrantOf(after(t), today) === q.id), (t) => t.data.matrixRank)
      const mine = inQ.filter((t) => scopeIds.has(t.id) || explicit.has(t.id))
      if (!mine.length) continue
      const cmpDate = (a: TaskEntry, b: TaskEntry) => (after(a).date || '9999').localeCompare(after(b).date || '9999')
      const cmpPri = (a: TaskEntry, b: TaskEntry) => priorityRank[after(a).priority] - priorityRank[after(b).priority]
      const sorted =
        orderBy === 'keep'
          ? mine
          : [...mine].sort((a, b) =>
              orderBy === 'date' ? cmpDate(a, b) : orderBy === 'priority' ? cmpPri(a, b) : orderBy === 'date_then_priority' ? cmpDate(a, b) || cmpPri(a, b) : cmpPri(a, b) || cmpDate(a, b),
            )
      // Explicit positions (1 = top) are slotted in after sorting.
      const pinned = sorted.filter((t) => explicit.has(t.id)).sort((a, b) => explicit.get(a.id)! - explicit.get(b.id)!)
      const rest = sorted.filter((t) => !explicit.has(t.id))
      for (const t of pinned) rest.splice(Math.min(rest.length, Math.max(0, explicit.get(t.id)! - 1)), 0, t)
      rest.forEach((t, i) => {
        const rank = (i + 1) * 1000
        if (t.data.matrixRank !== rank) patch(t.id, { matrixRank: rank })
      })
    }
  }

  const ops = toOps(all, changes, 'Rearranged in the priority matrix')
  if (!ops.length) return { nothing_to_change: true, conflicts }
  const name = await namer(k)
  const summary = `Rearrange ${ops.length} task${ops.length === 1 ? '' : 's'} in the priority matrix`
  const { planId, plan } = await k.savePlan('matrix', summary, ops)
  return planOut(k, planId, plan, all, name, {
    conflicts,
    placements: ops.map((op) => {
      const t = all.find((x) => x.id === op.taskId)!
      return { task_id: t.id, title: t.data.title, from: quadrantOf(t.data, today), to: quadrantOf(after(t), today) }
    }),
  })
}

// --- Bulk task changes and reschedules -------------------------------------------------------------------------

const BULK_FIELDS = ['date', 'time', 'priority', 'important', 'status', 'energy', 'estimate', 'colour', 'tags', 'matrixRank'] as const

function toOps(all: TaskEntry[], changes: Map<string, TaskPatch>, note: string): PlanOp[] {
  const ops: PlanOp[] = []
  for (const [id, set] of changes) {
    const t = all.find((x) => x.id === id)!
    const real = Object.fromEntries(Object.entries(set).filter(([key, v]) => JSON.stringify(t.data[key as keyof StoredTask] ?? null) !== JSON.stringify(v ?? null))) as TaskPatch
    if (!Object.keys(real).length) continue
    const before = Object.fromEntries(Object.keys(real).map((key) => [key, t.data[key as keyof StoredTask] ?? null])) as TaskPatch
    ops.push({ type: 'update', taskId: id, path: t.path, set: real, before, note })
  }
  return ops
}

export async function previewTaskChanges(k: KenDo, changes: { taskId: string; set: TaskPatch }[], skipDone: boolean, kind: 'task_changes' | 'schedule' = 'task_changes') {
  const all = await k.tasks()
  const linked = all.map((x) => ({ id: x.id, dependsOn: x.data.dependsOn, status: x.data.status }))
  const map = new Map<string, TaskPatch>()
  const skipped: { task_id: string; reason: string }[] = []
  for (const c of changes) {
    const t = await k.task(c.taskId)
    const bad = Object.keys(c.set).find((f) => !(BULK_FIELDS as readonly string[]).includes(f))
    if (bad) throw new ToolError('invalid_input', `${bad} can't be changed in bulk. Use update_task for one task.`)
    if (c.set.status === 'done') throw new ToolError('invalid_input', 'Complete tasks one at a time with complete_task, so repeats and prerequisites are handled.')
    if (skipDone && t.data.status === 'done') {
      skipped.push({ task_id: t.id, reason: 'Already done; left as it is.' })
      continue
    }
    if (c.set.status === 'doing' && isBlocked(t.data, linked)) {
      skipped.push({ task_id: t.id, reason: 'Waiting on a prerequisite, so it cannot move to Doing.' })
      continue
    }
    if (map.has(t.id)) throw new ToolError('invalid_input', `Task ${t.id} is listed twice.`)
    map.set(t.id, c.set)
  }
  const ops = toOps(all, map, kind === 'schedule' ? 'Rescheduled' : 'Changed with others')
  if (!ops.length) return { nothing_to_change: true, skipped }
  const summary = `${kind === 'schedule' ? 'Reschedule' : 'Change'} ${ops.length} task${ops.length === 1 ? '' : 's'}`
  const { planId, plan } = await k.savePlan(kind, summary, ops)
  return planOut(k, planId, plan, all, await namer(k), { skipped })
}

export async function previewDelete(k: KenDo, ids: string[]) {
  const all = await k.tasks()
  const ops: PlanOp[] = []
  for (const id of [...new Set(ids)]) {
    const t = await k.task(id)
    ops.push({ type: 'delete', taskId: t.id, path: t.path, before: t.data })
  }
  // As in the app, a deleted task stops being anyone's prerequisite.
  for (const t of all) {
    if (t.data.dependsOn && ids.includes(t.data.dependsOn) && !ids.includes(t.id))
      ops.push({ type: 'update', taskId: t.id, path: t.path, set: { dependsOn: null }, before: { dependsOn: t.data.dependsOn }, note: 'Prerequisite deleted' })
  }
  const deleting = ops.filter((o) => o.type === 'delete').length
  const { planId, plan } = await k.savePlan('delete', `Delete ${deleting} task${deleting === 1 ? '' : 's'}`, ops)
  return planOut(k, planId, plan, all, await namer(k), {})
}

// --- Scheduling suggestions --------------------------------------------------------------------------------------

export async function suggestSchedule(
  k: KenDo,
  input: {
    startDate?: string
    days?: number
    workStart?: string
    workEnd?: string
    gapMinutes?: number
    taskIds?: string[]
    projectId?: string
    includeUndated?: boolean
    includeOverdue?: boolean
  },
) {
  const [{ all, list }, today, tz] = await Promise.all([scope(k, input.projectId, input.taskIds), k.today(), k.timeZone()])
  const start = input.startDate ?? today
  if (start < today) throw new ToolError('invalid_input', 'start_date cannot be in the past.')
  const days = Array.from({ length: input.days ?? 1 }, (_, i) => shift(start, i))
  const last = days[days.length - 1]
  const [ws, we] = [minutes(input.workStart ?? '09:00'), minutes(input.workEnd ?? '17:30')]
  if (we <= ws) throw new ToolError('invalid_input', 'work_end must be after work_start.')
  const gap = input.gapMinutes ?? 5
  const nowLocal = toLocal(k.now(), tz)

  // What's already fixed: open tasks that have a time on these days.
  const busy = new Map<string, [number, number][]>(days.map((d) => [d, []]))
  for (const t of all.filter(open)) {
    if (t.data.time && busy.has(t.data.date)) busy.get(t.data.date)!.push([minutes(t.data.time), minutes(t.data.time) + (t.data.estimate || 30)])
  }

  const candidates = list
    .filter((t) => !t.data.time)
    .filter((t) =>
      !t.data.date ? !!input.includeUndated : t.data.date < start ? input.includeOverdue !== false : t.data.date <= last,
    )
    .sort(
      (a, b) =>
        Number(!(a.data.date && a.data.date < start)) - Number(!(b.data.date && b.data.date < start)) ||
        Number(!b.data.important) - Number(!a.data.important) ||
        priorityRank[a.data.priority] - priorityRank[b.data.priority] ||
        (a.data.date || '9999').localeCompare(b.data.date || '9999') ||
        (a.data.estimate || 0) - (b.data.estimate || 0),
    )

  const placedAt = new Map<string, { date: string; end: number }>()
  const proposals: { task_id: string; title: string; date: string; time: string; end: string; moves_date: boolean; reason: string }[] = []
  const unschedulable: { task_id: string; title: string; reason: string }[] = []

  // Prerequisites go first when both are in the list.
  const pending = [...candidates]
  const ordered: TaskEntry[] = []
  while (pending.length) {
    const i = pending.findIndex((t) => !pending.some((p) => p.id === t.data.dependsOn))
    ordered.push(...pending.splice(i === -1 ? 0 : i, 1))
  }

  for (const t of ordered) {
    const duration = Math.max(5, t.data.estimate || 25)
    const prereq = t.data.dependsOn ? all.find((x) => x.id === t.data.dependsOn) : undefined
    let after: { date: string; end: number } | undefined
    if (prereq && prereq.data.status !== 'done') {
      after = placedAt.get(prereq.id) ?? (prereq.data.date && prereq.data.time ? { date: prereq.data.date, end: minutes(prereq.data.time) + (prereq.data.estimate || 30) } : undefined)
      if (!after) {
        unschedulable.push({ task_id: t.id, title: t.data.title, reason: `Waits on "${prereq.data.title}", which has no time yet.` })
        continue
      }
    }
    const earliest = t.data.date && t.data.date >= start ? t.data.date : start
    let slot: { date: string; at: number } | undefined
    for (const d of days) {
      if (d < earliest || (after && d < after.date)) continue
      let from = ws
      if (d === nowLocal.date) from = Math.max(from, Math.ceil((minutes(nowLocal.time) + 5) / 5) * 5)
      if (after && d === after.date) from = Math.max(from, after.end + gap)
      const blocks = busy.get(d)!.sort((a, b) => a[0] - b[0])
      for (const [s, e] of blocks) {
        if (from + duration + gap <= s) break
        from = Math.max(from, e + gap)
      }
      if (from + duration <= we) slot = { date: d, at: from }
      if (slot) break
    }
    if (!slot) {
      unschedulable.push({ task_id: t.id, title: t.data.title, reason: `No free ${duration}-minute gap between ${clock(ws)} and ${clock(we)} in these days.` })
      continue
    }
    busy.get(slot.date)!.push([slot.at, slot.at + duration])
    placedAt.set(t.id, { date: slot.date, end: slot.at + duration })
    const overdue = !!t.data.date && t.data.date < start
    proposals.push({
      task_id: t.id,
      title: t.data.title,
      date: slot.date,
      time: clock(slot.at),
      end: clock(slot.at + duration),
      moves_date: slot.date !== t.data.date,
      reason: overdue ? 'Overdue, so placed first.' : t.data.important ? 'Marked important.' : `${t.data.priority} priority.`,
    })
  }

  const assumptions = [
    `Working hours ${clock(ws)}–${clock(we)} (${tz}), ${gap} minutes between tasks.`,
    'Busy time is only KenDo tasks that already have a time. KenDo does not read Google or Outlook calendars, so check those yourself.',
    'Each task takes its estimate (25 minutes when it has none).',
  ]
  if (!proposals.length) return { assumptions, proposals, unschedulable }
  const changes = proposals.map((p) => ({ taskId: p.task_id, set: { date: p.date, time: p.time } as TaskPatch }))
  const preview = await previewTaskChanges(k, changes, true, 'schedule')
  return { assumptions, proposals, unschedulable, ...preview }
}

// --- Notes to tasks ---------------------------------------------------------------------------------------------

const normal = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

export interface NoteItem {
  title: string
  date?: string
  time?: string
  priority?: Priority
  projectId?: string | null
  description?: string
}

export async function previewNoteToTasks(k: KenDo, noteId: string, items: NoteItem[] | undefined) {
  const note = await k.note(noteId)
  const all = await k.tasks()
  // Without a list from the AI app, offer the note's open checklist lines and bullets.
  const text = htmlToText(note.body ?? '')
  const proposed: NoteItem[] =
    items ??
    text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^(☐|•|-|\*)\s+\S/.test(l))
      .map((l) => ({ title: l.replace(/^(☐|•|-|\*)\s+/, '').slice(0, 180) }))
  if (!proposed.length) throw new ToolError('invalid_input', 'The note has no open checklist lines or bullets. Pass items to say which tasks to make.')
  if (proposed.length > 50) throw new ToolError('invalid_input', 'At most 50 tasks from one note.')

  const ops: PlanOp[] = []
  const skipped: { title: string; reason: string; existing_task_id?: string }[] = []
  const seen = new Set<string>()
  for (const item of proposed) {
    const key = normal(item.title)
    const existing = all.find((t) => open(t) && normal(t.data.title) === key)
    if (existing) {
      skipped.push({ title: item.title, reason: 'An open task with this title already exists.', existing_task_id: existing.id })
      continue
    }
    if (seen.has(key)) {
      skipped.push({ title: item.title, reason: 'Listed twice.' })
      continue
    }
    seen.add(key)
    const projectId = item.projectId === undefined ? note.projectId : item.projectId
    if (projectId) await k.project(projectId)
    const data = await k.newTaskData({ title: item.title, description: item.description ?? '', date: item.date, time: item.time, priority: item.priority, projectId, noteId }, 'Created from a note')
    const ref = (await k.taskCollection(projectId ?? null)).doc(newId())
    ops.push({ type: 'create', taskId: ref.id, path: ref.path, data })
  }
  if (!ops.length) return { nothing_to_change: true, skipped }
  const { planId, plan } = await k.savePlan('note_to_tasks', `Make ${ops.length} task${ops.length === 1 ? '' : 's'} from the note "${note.title}"`, ops)
  return planOut(k, planId, plan, all, await namer(k), { skipped })
}

// One new task, shown to the person before it's added.
export async function previewNewTask(k: KenDo, input: TaskPatch & { title: string; subtasks?: string[]; noteId?: string | null }) {
  const op = await k.planNewTask(input)
  const { planId, plan } = await k.savePlan('new_task', `Add the task "${input.title}"`, [op])
  // Show the whole task as it will be, so the person sees its reminder, repeat and steps too.
  const task = await k.taskOut({ id: op.taskId, path: op.path, data: op.data }, true)
  return planOut(k, planId, plan, await k.tasks(), await namer(k), { task })
}

// --- Plan output ---------------------------------------------------------------------------------------------------

export async function planOut(k: KenDo, planId: string, plan: Plan, all: TaskEntry[], name: (id: string | null) => string | null, extra: Record<string, unknown>) {
  const tz = await k.timeZone()
  const fields = (p: TaskPatch) => {
    const out: Record<string, unknown> = { ...p }
    if ('projectId' in p) out.project = name(p.projectId ?? null)
    return out
  }
  return {
    plan_id: planId,
    kind: plan.kind,
    summary: plan.summary,
    change_count: plan.ops.length,
    changes: plan.ops.map((op) => {
      const title = op.type === 'create' ? op.data.title : op.type === 'delete' ? op.before.title : (all.find((t) => t.id === op.taskId)?.data.title ?? '')
      if (op.type === 'update') return { action: 'update', task_id: op.taskId, title, before: fields(op.before), after: fields(op.set) }
      if (op.type === 'create')
        return { action: 'create', task_id: op.taskId, title, date: op.data.date || null, time: op.data.time || null, priority: op.data.priority, project: name(op.data.projectId) }
      return { action: 'delete', task_id: op.taskId, title }
    }),
    ...extra,
    confirmation_code: plan.confirmation,
    expires_at: isoInZone(plan.expiresAt, tz),
    nothing_changed_yet: true,
    next_step:
      'Show the person these changes. Only after they clearly approve, call apply_plan with this plan_id and confirmation_code. After applying, preview_undo can reverse it.',
  }
}
