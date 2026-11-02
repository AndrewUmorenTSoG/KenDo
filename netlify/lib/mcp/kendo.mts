import { createHash, randomBytes } from 'node:crypto'
import { FieldValue, type DocumentSnapshot, type Firestore, type Transaction } from 'firebase-admin/firestore'
import { describe as describeRule, nextOccurrence, ruleOf } from '../../../src/lib/recurrence'
import { dependsOnChain, isBlocked, quadrantOf, taskDefaults } from '../../../src/lib/taskRules'
import type { Note, NoteColour, Priority, Project, ProjectColour, Recurrence, Repeat, Status, Task, TaskColour } from '../../../src/lib/types'
import { sharedProjects } from '../workspace.mts'
import { PLAN_SECONDS } from './config.mts'
import { DEFAULT_TIME_ZONE, isoInZone, localToday, validTimeZone, zonedToMillis } from './zoned.mts'

// KenDo's own rules, run on the server with the Firebase Admin SDK for one signed-in person. The Admin SDK
// skips firestore.rules, so every read here starts from what this person can reach (their own data and
// shared projects they belong to), and every write goes to a document found that way, never to an id or
// path taken straight from the AI app.

export class ToolError extends Error {
  constructor(
    readonly code:
      | 'not_found'
      | 'invalid_input'
      | 'conflict'
      | 'blocked'
      | 'forbidden'
      | 'plan_expired'
      | 'plan_used'
      | 'ambiguous'
      | 'unsupported'
      | 'rate_limited'
      | 'unavailable',
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export type StoredTask = Omit<Task, 'id' | 'path'>

export interface TaskEntry {
  id: string
  path: string
  data: StoredTask
}

export interface ProjectEntry {
  id: string
  owner: string
  name: string
  colour: ProjectColour
  shared: boolean
  mine: boolean
  memberCount: number
  createdAt: number
}

export interface Actor {
  db: Firestore
  uid: string
  clientId: string
  clientName: string
  now?: () => number
}

// Older tasks may lack fields added later; fill them the way the app would.
const asTask = (data: unknown) => ({ ...taskDefaults, ...(data as object) }) as unknown as StoredTask

export const newId = () => randomBytes(15).toString('base64url').replace(/[-_]/g, 'x').slice(0, 20)
export const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('base64url').slice(0, 16)

export const MAX_PLAN_OPS = 100

// Fields an AI app may change on a task, in KenDo's names.
export interface TaskPatch {
  title?: string
  description?: string
  projectId?: string | null
  priority?: Priority
  status?: Status
  important?: boolean
  energy?: 'low' | 'medium' | 'high'
  date?: string
  time?: string
  estimate?: number
  repeat?: Repeat
  recurrence?: Recurrence | null
  colour?: TaskColour | null
  tags?: string[]
  dependsOn?: string | null
  matrixRank?: number | null
}

export type PlanOp =
  | { type: 'update'; taskId: string; path: string; set: TaskPatch; before: TaskPatch; note: string }
  | { type: 'create'; taskId: string; path: string; data: StoredTask }
  | { type: 'delete'; taskId: string; path: string; before: StoredTask }

export type PlanKind = 'task_changes' | 'matrix' | 'schedule' | 'delete' | 'note_to_tasks' | 'undo'

export interface Plan {
  uid: string
  clientId: string
  kind: PlanKind
  summary: string
  ops: PlanOp[]
  // Each touched task's updatedAt when the plan was made; any change since makes the plan stale.
  baseline: Record<string, number>
  confirmation: string
  digest: string
  status: 'pending' | 'applied'
  createdAt: number
  expiresAt: number
  appliedAt?: number
  after?: Record<string, number>
  undoOf?: string
  expireAt: Date
}

export class KenDo {
  readonly db: Firestore
  readonly uid: string
  readonly clientId: string
  readonly clientName: string
  private readonly clock: () => number
  private cache: {
    profile?: Promise<Record<string, unknown>>
    shared?: ReturnType<typeof sharedProjects>
    projects?: Promise<ProjectEntry[]>
    tasks?: Promise<TaskEntry[]>
    notes?: Promise<(Note & { id: string })[]>
  } = {}

  constructor(actor: Actor) {
    this.db = actor.db
    this.uid = actor.uid
    this.clientId = actor.clientId
    this.clientName = actor.clientName
    this.clock = actor.now ?? Date.now
  }

  now() {
    return this.clock()
  }

  private user() {
    return this.db.collection('users').doc(this.uid)
  }

  // --- Reads ---------------------------------------------------------------------------------------------

  profile() {
    this.cache.profile ??= this.user()
      .get()
      .then((s) => (s.data() ?? {}) as Record<string, unknown>)
    return this.cache.profile
  }

  async timeZone() {
    const tz = (await this.profile()).timeZone
    return validTimeZone(tz) ? tz : DEFAULT_TIME_ZONE
  }

  async today() {
    return localToday(await this.timeZone(), this.now())
  }

  private shared() {
    this.cache.shared ??= sharedProjects(this.db, this.uid)
    return this.cache.shared
  }

  projects() {
    this.cache.projects ??= (async () => {
      const [own, shared] = await Promise.all([this.user().collection('projects').get(), this.shared()])
      const entry = (d: DocumentSnapshot, mine: boolean): ProjectEntry => {
        const p = d.data() as Project
        const ownerName = p.memberNames?.[p.uid]
        return {
          id: d.id,
          owner: mine ? this.uid : p.uid,
          // Named after the owner too, as the app does, so a joined "Family & friends" isn't mistaken for your own.
          name: !mine && ownerName ? `${p.name} · ${ownerName}` : p.name,
          colour: p.colour,
          shared: !!p.shared,
          mine,
          memberCount: p.members?.length ?? 1,
          createdAt: p.createdAt ?? 0,
        }
      }
      return [...own.docs.map((d) => entry(d, true)), ...shared.joined.map((d) => entry(d, false))].sort((a, b) => a.createdAt - b.createdAt)
    })()
    return this.cache.projects
  }

  tasks() {
    this.cache.tasks ??= (async () => {
      const shared = await this.shared()
      const snaps = await Promise.all([
        this.user().collection('tasks').get(),
        ...[...shared.owned, ...shared.joined].map((p) => p.ref.collection('tasks').get()),
      ])
      return snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, path: d.ref.path, data: asTask(d.data()) })))
    })()
    return this.cache.tasks
  }

  notes() {
    this.cache.notes ??= this.user()
      .collection('notes')
      .get()
      .then((s) => s.docs.map((d) => ({ ...(d.data() as Note), id: d.id })))
    return this.cache.notes
  }

  private forget() {
    delete this.cache.tasks
    delete this.cache.projects
    delete this.cache.shared
    delete this.cache.notes
  }

  async task(id: string) {
    const found = (await this.tasks()).find((t) => t.id === id)
    if (!found) throw new ToolError('not_found', `No task with id ${id} in this KenDo account.`)
    return found
  }

  async project(id: string) {
    const found = (await this.projects()).find((p) => p.id === id)
    if (!found) throw new ToolError('not_found', `No project with id ${id} in this KenDo account.`)
    return found
  }

  async note(id: string) {
    const found = (await this.notes()).find((n) => n.id === id)
    if (!found) throw new ToolError('not_found', `No note with id ${id} in this KenDo account.`)
    return found
  }

  // Where a task in this project is stored: next to a shared project, otherwise in the person's own list.
  async taskCollection(projectId: string | null) {
    if (!projectId) return this.user().collection('tasks')
    const project = await this.project(projectId)
    return project.shared ? this.db.collection('users').doc(project.owner).collection('projects').doc(project.id).collection('tasks') : this.user().collection('tasks')
  }

  // --- Helpers that mirror src/data/tasks.ts -----------------------------------------------------------------

  async stamp(text: string) {
    const when = new Date(this.now()).toLocaleString('en-GB', { timeZone: await this.timeZone() })
    return `${text} · ${when}`
  }

  private via(text: string) {
    return `${text} by ${this.clientName}`
  }

  // Every dated task gets a notification at its time, or 9am when it has none; times already gone get none.
  async reminderFor(date: string, time: string) {
    if (!date) return { reminder: false, remindAt: null, reminderSent: false }
    const { ms } = zonedToMillis(date, time || '09:00', await this.timeZone())
    const remindAt = ms > this.now() ? ms : null
    return { reminder: remindAt !== null, remindAt, reminderSent: false }
  }

  private async checkLinks(taskId: string | null, patch: TaskPatch) {
    if (patch.projectId) await this.project(patch.projectId)
    if (patch.dependsOn) {
      const all = (await this.tasks()).map((t) => ({ id: t.id, dependsOn: t.data.dependsOn, status: t.data.status }))
      const parent = all.find((t) => t.id === patch.dependsOn)
      if (!parent) throw new ToolError('not_found', `No task with id ${patch.dependsOn} to depend on.`)
      if (taskId && (patch.dependsOn === taskId || dependsOnChain(parent, taskId, all)))
        throw new ToolError('invalid_input', 'That dependency would make a loop.')
    }
  }

  // --- Idempotency ---------------------------------------------------------------------------------------------

  private idempotencyRef(tool: string, key: string) {
    return this.db.collection('mcpIdempotency').doc(hash([this.uid, this.clientId, tool, key]))
  }

  // Runs `work` once per key: a retry with the same key gets the first answer back instead of a duplicate.
  async once<T extends Record<string, unknown>>(tool: string, key: string | undefined, work: (tx: Transaction) => Promise<T>): Promise<T & { replayed?: boolean }> {
    if (!key) return this.db.runTransaction((tx) => work(tx))
    const ref = this.idempotencyRef(tool, key)
    return this.db.runTransaction(async (tx) => {
      const seen = await tx.get(ref)
      if (seen.exists) return { ...(seen.get('result') as T), replayed: true }
      const result = await work(tx)
      tx.create(ref, { result, at: this.now(), expireAt: new Date(this.now() + 7 * 86_400_000) })
      return result
    })
  }

  // --- Audit ------------------------------------------------------------------------------------------------------

  async audit(tool: string, outcome: 'ok' | 'error', ids: string[], detail?: string) {
    await this.user()
      .collection('mcpAudit')
      .add({
        at: this.now(),
        clientId: this.clientId,
        clientName: this.clientName,
        tool,
        ids: ids.slice(0, 100),
        outcome,
        ...(detail ? { detail: detail.slice(0, 200) } : {}),
        expireAt: new Date(this.now() + 90 * 86_400_000),
      })
      .catch(() => undefined)
  }

  // --- Tasks ---------------------------------------------------------------------------------------------------------

  // A complete new task, as blankTask in the app makes it.
  async newTaskData(input: TaskPatch & { title: string; subtasks?: string[]; noteId?: string | null }, created = 'Created') {
    const date = input.date ?? (await this.today())
    const time = input.time ?? ''
    const now = this.now()
    const { subtasks, ...given } = input
    // Leave out what wasn't given, so the defaults stand (Firestore also refuses undefined).
    const fields = Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined))
    if (input.recurrence && !input.recurrence.start) fields.recurrence = { ...input.recurrence, start: date }
    return {
      ...taskDefaults,
      ...fields,
      date,
      time,
      subtasks: (subtasks ?? []).map((title) => ({ title, done: false })),
      activity: [await this.stamp(this.via(created))],
      ...(await this.reminderFor(date, time)),
      uid: this.uid,
      createdAt: now,
      updatedAt: now,
    } as unknown as StoredTask
  }

  async createTask(input: TaskPatch & { title: string; subtasks?: string[]; noteId?: string | null }, key?: string) {
    await this.checkLinks(null, input)
    if (input.noteId) await this.note(input.noteId)
    const target = await this.taskCollection(input.projectId ?? null)
    const data = await this.newTaskData(input)
    const result = await this.once('create_task', key, async (tx) => {
      const ref = target.doc(newId())
      tx.create(ref, data)
      return { taskId: ref.id }
    })
    this.forget()
    return { ...result, task: await this.task(result.taskId as string) }
  }

  // Changes only the named fields. With expectedRevision, refuses if the task changed since it was read.
  async updateTask(id: string, patch: TaskPatch, expectedRevision?: number, note = 'Task edited') {
    const { status, ...fields } = patch
    const changesFields = Object.keys(fields).length > 0
    if (changesFields) await this.updateFields(id, fields, expectedRevision, note)
    // Status goes through the same rules as ticking it off in the app (prerequisites, repeats).
    if (status) return this.setStatus(id, status, changesFields ? undefined : expectedRevision)
    return this.task(id)
  }

  private async updateFields(id: string, patch: TaskPatch, expectedRevision?: number, note = 'Task edited') {
    const entry = await this.task(id)
    await this.checkLinks(id, patch)
    const target = 'projectId' in patch ? await this.taskCollection(patch.projectId ?? null) : null
    const ref = this.db.doc(entry.path)
    const stamp = await this.stamp(this.via(note))
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new ToolError('not_found', 'The task was deleted.')
      const current = asTask(snap.data())
      if (expectedRevision !== undefined && current.updatedAt !== expectedRevision)
        throw new ToolError('conflict', 'The task changed since it was read. Read it again and retry.', { revision: current.updatedAt })
      const data = await this.patchData(current, patch, stamp)
      if (target && target.path !== ref.parent.path) {
        // Moving into or out of a shared project moves the document too.
        const moved = target.doc(id)
        const exists = await tx.get(moved)
        if (exists.exists) throw new ToolError('conflict', 'A task with this id already exists there.')
        tx.set(moved, { ...current, ...data })
        tx.delete(ref)
      } else tx.update(ref, data)
    })
    this.forget()
  }

  // The stored fields for a patch, with the reminder kept in step with the date and time.
  private async patchData(current: StoredTask, patch: TaskPatch, stamp: string) {
    const data: Record<string, unknown> = { ...patch }
    if (patch.recurrence && !patch.recurrence.start) data.recurrence = { ...patch.recurrence, start: patch.date ?? current.date ?? (await this.today()) }
    // A new repeat rule starts the series afresh, so no one-off edit carries over.
    if ('recurrence' in patch) data.seriesBase = null
    const keys = ['date', 'time'] as const
    if (keys.some((k) => k in patch && patch[k] !== current[k])) {
      Object.assign(data, await this.reminderFor(patch.date ?? current.date, patch.time ?? current.time))
    }
    data.activity = [...(current.activity ?? []), stamp].slice(-30)
    data.updatedAt = this.now()
    return data
  }

  // Moving to Done on a repeating task creates its next occurrence, once, as the app does.
  async setStatus(id: string, status: Status, expectedRevision?: number) {
    const entry = await this.task(id)
    const all = (await this.tasks()).map((t) => ({ id: t.id, dependsOn: t.data.dependsOn, status: t.data.status, recurringFrom: t.data.recurringFrom }))
    if (status !== 'todo' && isBlocked(entry.data, all))
      throw new ToolError('blocked', 'Finish the prerequisite task first.', { depends_on: entry.data.dependsOn })
    const label = status === 'todo' ? 'To do' : status === 'doing' ? 'Doing' : 'Done'
    const stamp = await this.stamp(this.via(`Moved to ${label}`))
    const today = await this.today()
    const ref = this.db.doc(entry.path)
    const nextRef = ref.parent.doc(newId())
    const hasNext = all.some((t) => t.recurringFrom === id)
    const repeatStamp = await this.stamp('Created from repeating task')
    let created: string | null = null
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new ToolError('not_found', 'The task was deleted.')
      const current = asTask(snap.data())
      if (expectedRevision !== undefined && current.updatedAt !== expectedRevision)
        throw new ToolError('conflict', 'The task changed since it was read. Read it again and retry.', { revision: current.updatedAt })
      const becameDone = status === 'done' && current.status !== 'done'
      const data = await this.patchData(current, { status }, stamp)
      data.status = status
      data.completedOn = status === 'done' ? (current.completedOn ?? today) : null
      tx.update(ref, data)
      if (becameDone) tx.set(this.user(), { completedTotal: FieldValue.increment(1) }, { merge: true })
      // Same rules as the app: a paused or finished series stops, and one-off edits don't carry on.
      const rule = ruleOf(current)
      const base = { ...current, ...(current.seriesBase ?? {}) }
      const date = becameDone && rule && !rule.paused && !hasNext ? nextOccurrence(base.date || today, rule) : null
      if (date) {
        const next: StoredTask = {
          ...base,
          seriesBase: null,
          date,
          status: 'todo',
          completedOn: null,
          subtasks: current.subtasks.map((s) => ({ ...s, done: false })),
          comments: [],
          activity: [repeatStamp],
          recurringFrom: id,
          ...(await this.reminderFor(date, base.time)),
          uid: this.uid,
          createdAt: this.now(),
          updatedAt: this.now(),
        }
        tx.create(nextRef, next)
        created = nextRef.id
      }
    })
    this.forget()
    return { ...(await this.task(id)), nextOccurrence: created as string | null }
  }

  async addSubtasks(id: string, titles: string[], key?: string) {
    const entry = await this.task(id)
    const ref = this.db.doc(entry.path)
    const stamp = await this.stamp(this.via('Steps added'))
    await this.once('add_subtasks', key ? `${id}:${key}` : undefined, async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new ToolError('not_found', 'The task was deleted.')
      const current = asTask(snap.data())
      if (current.subtasks.length + titles.length > 50) throw new ToolError('invalid_input', 'A task can hold at most 50 steps.')
      tx.update(ref, {
        subtasks: [...current.subtasks, ...titles.map((title) => ({ title, done: false }))],
        activity: [...(current.activity ?? []), stamp].slice(-30),
        updatedAt: this.now(),
      })
      return { taskId: id }
    })
    this.forget()
    return this.task(id)
  }

  async updateSubtask(id: string, index: number, change: { title?: string; done?: boolean }, expectedRevision?: number) {
    const entry = await this.task(id)
    const ref = this.db.doc(entry.path)
    const stamp = await this.stamp(this.via('Step updated'))
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new ToolError('not_found', 'The task was deleted.')
      const current = asTask(snap.data())
      if (expectedRevision !== undefined && current.updatedAt !== expectedRevision)
        throw new ToolError('conflict', 'The task changed since it was read. Read it again and retry.', { revision: current.updatedAt })
      if (!current.subtasks[index]) throw new ToolError('not_found', `The task has no step number ${index}.`)
      const subtasks = current.subtasks.map((s, i) => (i === index ? { ...s, ...change } : s))
      tx.update(ref, { subtasks, activity: [...(current.activity ?? []), stamp].slice(-30), updatedAt: this.now() })
    })
    this.forget()
    return this.task(id)
  }

  // A reminder at a chosen moment, leaving the task's planned date and time alone (like snoozing in the app).
  async setReminder(id: string, at: number | null) {
    const entry = await this.task(id)
    if (at !== null && at <= this.now()) throw new ToolError('invalid_input', 'That reminder time has already passed.')
    if (at !== null && entry.data.status === 'done') throw new ToolError('invalid_input', 'The task is already done.')
    const ref = this.db.doc(entry.path)
    const stamp = await this.stamp(this.via(at === null ? 'Reminder turned off' : 'Reminder set'))
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new ToolError('not_found', 'The task was deleted.')
      const current = asTask(snap.data())
      tx.update(ref, {
        reminder: at !== null,
        remindAt: at,
        reminderSent: false,
        activity: [...(current.activity ?? []), stamp].slice(-30),
        updatedAt: this.now(),
      })
    })
    this.forget()
    return this.task(id)
  }

  // --- Projects ----------------------------------------------------------------------------------------------------

  async createProject(name: string, colour: ProjectColour | undefined, key?: string) {
    const existing = await this.projects()
    if (existing.some((p) => p.mine && p.name.toLowerCase() === name.toLowerCase()))
      throw new ToolError('conflict', 'A project with that name already exists.', { project_id: existing.find((p) => p.name.toLowerCase() === name.toLowerCase())?.id })
    const palette: ProjectColour[] = ['purple', 'green', 'yellow', 'pink']
    const result = await this.once('create_project', key, async (tx) => {
      const ref = this.user().collection('projects').doc()
      tx.create(ref, { name, colour: colour ?? palette[existing.length % palette.length], uid: this.uid, createdAt: this.now() })
      return { projectId: ref.id }
    })
    this.forget()
    return { ...result, project: await this.project(result.projectId as string) }
  }

  async updateProject(id: string, change: { name?: string; colour?: ProjectColour }) {
    const project = await this.project(id)
    if (!project.mine) throw new ToolError('forbidden', 'Only the owner can rename a shared project.')
    await this.user().collection('projects').doc(id).update(change)
    this.forget()
    return this.project(id)
  }

  // --- Notes -----------------------------------------------------------------------------------------------------------

  async createNote(input: { title: string; text: string; colour?: NoteColour; projectId?: string | null; pinned?: boolean }, key?: string) {
    if (input.projectId) await this.project(input.projectId)
    const result = await this.once('create_note', key, async (tx) => {
      const ref = this.user().collection('notes').doc()
      tx.create(ref, {
        title: input.title,
        body: textToHtml(input.text),
        colour: input.colour ?? 'butter',
        projectId: input.projectId ?? null,
        pinned: input.pinned ?? false,
        archived: false,
        uid: this.uid,
        createdAt: this.now(),
        updatedAt: this.now(),
      })
      return { noteId: ref.id }
    })
    this.forget()
    return { ...result, note: await this.note(result.noteId as string) }
  }

  async updateNote(
    id: string,
    change: { title?: string; text?: string; appendText?: string; colour?: NoteColour; projectId?: string | null; pinned?: boolean; archived?: boolean },
    expectedRevision?: number,
  ) {
    await this.note(id)
    if (change.projectId) await this.project(change.projectId)
    const ref = this.user().collection('notes').doc(id)
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw new ToolError('not_found', 'The note was deleted.')
      if (expectedRevision !== undefined && snap.get('updatedAt') !== expectedRevision)
        throw new ToolError('conflict', 'The note changed since it was read. Read it again and retry.', { revision: snap.get('updatedAt') })
      const { text, appendText, ...rest } = change
      const data: Record<string, unknown> = { ...rest, updatedAt: this.now() }
      if (text !== undefined) data.body = textToHtml(text)
      if (appendText) data.body = `${snap.get('body') ?? ''}${textToHtml(appendText)}`
      tx.update(ref, data)
    })
    this.forget()
    return this.note(id)
  }

  // --- Matrix ---------------------------------------------------------------------------------------------------------

  async reorderMatrix(order: string[]) {
    const today = await this.today()
    const entries = await Promise.all(order.map((id) => this.task(id)))
    const quadrant = quadrantOf(entries[0].data, today)
    const outside = entries.find((e) => quadrantOf(e.data, today) !== quadrant || e.data.status === 'done')
    if (outside) throw new ToolError('invalid_input', 'Every task must be open and in the same quadrant. Use preview_matrix_reorganisation to move between quadrants.', { task_id: outside.id })
    const stamp = await this.stamp(this.via('Placed in the priority matrix'))
    await this.db.runTransaction(async (tx) => {
      const snaps = await tx.getAll(...entries.map((e) => this.db.doc(e.path)))
      snaps.forEach((snap, i) => {
        if (!snap.exists) throw new ToolError('not_found', 'A task was deleted.')
        tx.update(snap.ref, { matrixRank: (i + 1) * 1000, activity: [...((snap.get('activity') as string[]) ?? []), stamp].slice(-30), updatedAt: this.now() })
      })
    })
    this.forget()
    return { quadrant, order }
  }

  // --- Plans: preview, then apply after the person approves ------------------------------------------------------------

  async savePlan(kind: PlanKind, summary: string, ops: PlanOp[], undoOf?: string) {
    if (!ops.length) throw new ToolError('invalid_input', 'Nothing would change.')
    if (ops.length > MAX_PLAN_OPS) throw new ToolError('invalid_input', `A plan can change at most ${MAX_PLAN_OPS} items. Split it up.`)
    const tasks = await this.tasks()
    const baseline: Record<string, number> = {}
    for (const op of ops) {
      if (op.type === 'create') continue
      const t = tasks.find((x) => x.id === op.taskId && x.path === op.path)
      if (!t) throw new ToolError('not_found', `No task with id ${op.taskId}.`)
      baseline[op.taskId] = t.data.updatedAt
    }
    const id = `plan_${newId()}`
    const plan: Plan = {
      uid: this.uid,
      clientId: this.clientId,
      kind,
      summary,
      ops,
      baseline,
      confirmation: randomBytes(3).toString('hex').toUpperCase(),
      digest: hash(ops),
      status: 'pending',
      createdAt: this.now(),
      expiresAt: this.now() + PLAN_SECONDS * 1000,
      expireAt: new Date(this.now() + 7 * 86_400_000),
      ...(undoOf ? { undoOf } : {}),
    }
    await this.db.collection('mcpPlans').doc(id).set(plan)
    return { planId: id, plan }
  }

  private async loadPlan(id: string) {
    const snap = await this.db.collection('mcpPlans').doc(id).get()
    const plan = snap.data() as Plan | undefined
    // Another person's (or another app's) plan looks exactly like a missing one.
    if (!plan || plan.uid !== this.uid || plan.clientId !== this.clientId) throw new ToolError('not_found', 'No such plan.')
    return plan
  }

  async applyPlan(id: string, confirmation: string) {
    const ref = this.db.collection('mcpPlans').doc(id)
    const tz = await this.timeZone()
    const stamp = (text: string) => `${this.via(text)} · ${new Date(this.now()).toLocaleString('en-GB', { timeZone: tz })}`
    const reminderAt = (date: string, time: string) => {
      if (!date) return { reminder: false, remindAt: null, reminderSent: false }
      const { ms } = zonedToMillis(date, time || '09:00', tz)
      const remindAt = ms > this.now() ? ms : null
      return { reminder: remindAt !== null, remindAt, reminderSent: false }
    }
    const result = await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const plan = snap.data() as Plan | undefined
      if (!plan || plan.uid !== this.uid || plan.clientId !== this.clientId) throw new ToolError('not_found', 'No such plan.')
      if (plan.status !== 'pending') throw new ToolError('plan_used', 'This plan was already applied. Make a new preview.')
      if (plan.expiresAt < this.now()) throw new ToolError('plan_expired', 'This plan has expired. Make a new preview.')
      if (!confirmation || confirmation.toUpperCase() !== plan.confirmation)
        throw new ToolError('forbidden', 'The confirmation code does not match. Show the person the preview and use the code it gave.')
      if (hash(plan.ops) !== plan.digest) throw new ToolError('conflict', 'The plan was altered and cannot be applied.')

      const refs = plan.ops.map((op) => this.db.doc(op.path))
      const snaps = await tx.getAll(...refs)
      const stale = plan.ops.filter((op, i) =>
        op.type === 'create' ? snaps[i].exists : !snaps[i].exists || snaps[i].get('updatedAt') !== plan.baseline[op.taskId],
      )
      if (stale.length)
        throw new ToolError('conflict', 'Some tasks changed since the preview. Make a new preview.', { changed: stale.map((o) => o.taskId) })

      const after: Record<string, number> = {}
      plan.ops.forEach((op, i) => {
        if (op.type === 'delete') return tx.delete(refs[i])
        if (op.type === 'create') {
          const data = { ...op.data, ...reminderAt(op.data.date, op.data.time), createdAt: this.now(), updatedAt: this.now() }
          after[op.taskId] = this.now()
          return tx.create(refs[i], data)
        }
        const current = snaps[i].data() as StoredTask
        const data: Record<string, unknown> = { ...op.set, activity: [...(current.activity ?? []), stamp(op.note)].slice(-30), updatedAt: this.now() }
        if ('date' in op.set || 'time' in op.set) Object.assign(data, reminderAt(op.set.date ?? current.date, op.set.time ?? current.time))
        if (op.set.status) data.completedOn = op.set.status === 'done' ? (current.completedOn ?? localToday(tz, this.now())) : null
        after[op.taskId] = this.now()
        tx.update(refs[i], data)
      })
      tx.update(ref, { status: 'applied', appliedAt: this.now(), after })
      return plan
    })
    this.forget()
    return result
  }

  // A new plan that puts back what an applied plan changed.
  async previewUndo(id: string) {
    const plan = await this.loadPlan(id)
    if (plan.status !== 'applied') throw new ToolError('invalid_input', 'Only an applied plan can be undone.')
    const ops: PlanOp[] = [...plan.ops].reverse().map((op): PlanOp => {
      if (op.type === 'update') return { type: 'update', taskId: op.taskId, path: op.path, set: op.before, before: op.set, note: 'Change undone' }
      if (op.type === 'create') return { type: 'delete', taskId: op.taskId, path: op.path, before: op.data }
      return { type: 'create', taskId: op.taskId, path: op.path, data: op.before }
    })
    // Deleting what the plan created needs the current copy, so the undo plan checks nothing changed since.
    const current = await this.tasks()
    for (const op of ops) {
      if (op.type !== 'delete') continue
      const t = current.find((x) => x.path === op.path)
      if (!t) throw new ToolError('conflict', 'A task this plan created is already gone.')
      op.before = t.data
    }
    if (ops.some((op) => op.type !== 'create' && plan.after?.[op.taskId] !== current.find((t) => t.path === op.path)?.data.updatedAt))
      throw new ToolError('conflict', 'Some of these tasks were changed again after the plan was applied, so it cannot be undone automatically.')
    return this.savePlan('undo', `Undo: ${plan.summary}`, ops, id)
  }

  // --- Output ------------------------------------------------------------------------------------------------------------

  async taskOut(entry: TaskEntry, detail = false) {
    const [projects, all, today, tz] = await Promise.all([this.projects(), this.tasks(), this.today(), this.timeZone()])
    const t = entry.data
    const project = projects.find((p) => p.id === t.projectId)
    const linked = all.map((x) => ({ id: x.id, dependsOn: x.data.dependsOn, status: x.data.status }))
    return {
      id: entry.id,
      title: t.title,
      ...(detail ? { description: clip(t.description, 4000) } : t.description ? { description: clip(t.description, 280) } : {}),
      status: t.status,
      priority: t.priority,
      important: !!t.important,
      date: t.date || null,
      time: t.time || null,
      overdue: !!t.date && t.date < today && t.status !== 'done',
      estimate_minutes: t.estimate,
      energy: t.energy,
      repeat: t.repeat,
      ...(ruleOf(t) ? { repeat_rule: describeRule(ruleOf(t)!) } : {}),
      ...(t.archived ? { archived: true } : {}),
      colour: t.colour ?? null,
      tags: t.tags ?? [],
      project_id: t.projectId,
      project_name: project?.name ?? null,
      in_shared_project: entry.path.includes('/projects/'),
      depends_on: t.dependsOn,
      blocked: isBlocked(t, linked),
      note_id: t.noteId,
      subtasks: (t.subtasks ?? []).map((s, index) => ({ index, title: s.title, done: s.done })),
      reminder: t.remindAt
        ? { on: !!t.reminder, at: isoInZone(t.remindAt, tz), sent: !!t.reminderSent }
        : { on: false, at: null, sent: !!t.reminderSent },
      quadrant: t.status === 'done' ? null : quadrantOf(t, today),
      matrix_rank: t.matrixRank ?? null,
      completed_on: t.completedOn,
      revision: t.updatedAt,
      ...(detail
        ? {
            recurring_from: t.recurringFrom ?? null,
            comments: (t.comments ?? []).slice(-10).map((c) => ({ author: c.author, text: clip(c.text, 500), at: isoInZone(c.at, tz) })),
            activity: (t.activity ?? []).slice(-10),
            created_at: isoInZone(t.createdAt, tz),
            updated_at: isoInZone(t.updatedAt, tz),
          }
        : {}),
    }
  }

  projectOut(p: ProjectEntry, tasks: TaskEntry[], today: string) {
    const mine = tasks.filter((t) => t.data.projectId === p.id)
    const open = mine.filter((t) => t.data.status !== 'done')
    const dated = open.map((t) => t.data.date).filter(Boolean).sort()
    return {
      id: p.id,
      name: p.name,
      colour: p.colour,
      owned_by_you: p.mine,
      shared: p.shared,
      members: p.memberCount,
      tasks_total: mine.length,
      tasks_open: open.length,
      tasks_doing: open.filter((t) => t.data.status === 'doing').length,
      tasks_done: mine.length - open.length,
      tasks_overdue: open.filter((t) => t.data.date && t.data.date < today).length,
      progress_percent: mine.length ? Math.round(((mine.length - open.length) / mine.length) * 100) : 0,
      next_date: dated[0] ?? null,
      last_activity: mine.length ? Math.max(...mine.map((t) => t.data.updatedAt ?? 0)) : null,
      link: `/projects?project=${p.id}`,
    }
  }

  noteOut(n: Note & { id: string }, detail = false) {
    const text = htmlToText(n.body ?? '')
    return {
      id: n.id,
      title: n.title,
      ...(detail ? { text: clip(text, 8000) } : { preview: clip(text, 200) }),
      colour: n.colour,
      project_id: n.projectId,
      pinned: !!n.pinned,
      archived: !!n.archived,
      revision: n.updatedAt,
    }
  }
}

export const clip = (text: string | undefined | null, n: number) => {
  const s = text ?? ''
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// Plain text from the AI app becomes the simple HTML the note editor uses (one <div> per line).
export function textToHtml(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => (line.trim() ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>'))
    .join('')
}

// Note HTML as plain text, without a DOM: tags dropped, entities decoded.
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
