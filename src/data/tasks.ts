import { addDoc, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { todayKey, toMillis } from '../lib/dates'
import { db } from '../lib/firebase'
import { nextDate } from '../lib/recurrence'
import type { NewTask, Status, Task } from '../lib/types'
import { userCollection, userDoc } from './collection'

const stamp = (text: string) => `${text} · ${new Date().toLocaleString('en-GB')}`
const withActivity = (task: Task, text: string) => [...(task.activity ?? []), stamp(text)].slice(-30)

export function blankTask(uid: string, input: NewTask): Omit<Task, 'id'> {
  const now = Date.now()
  const task: Omit<Task, 'id'> = {
    description: '',
    projectId: null,
    priority: 'medium',
    status: 'todo',
    energy: 'low',
    important: false,
    date: todayKey(),
    time: '',
    estimate: 25,
    repeat: 'never',
    recurringFrom: null,
    tags: [],
    subtasks: [],
    comments: [],
    activity: [stamp('Created')],
    dependsOn: null,
    noteId: null,
    reminder: false,
    remindAt: null,
    reminderSent: false,
    completedOn: null,
    ...input,
    uid,
    createdAt: now,
    updatedAt: now,
  }
  return withReminder(task)
}

// The scheduled function looks for remindAt, so keep it in step with date, time and the toggle.
function withReminder<T extends Pick<Task, 'reminder' | 'date' | 'time'>>(task: T): T {
  return { ...task, remindAt: task.reminder ? toMillis(task.date, task.time) : null, reminderSent: false }
}

export function createTask(uid: string, input: NewTask) {
  return addDoc(userCollection(uid, 'tasks'), blankTask(uid, input))
}

export function updateTask(uid: string, task: Task, changes: Partial<Task>, note = 'Task edited') {
  const keys = ['reminder', 'date', 'time'] as const
  const reminderChanged = keys.some((k) => k in changes && changes[k] !== task[k])
  const reminder = reminderChanged ? withReminder({ ...task, ...changes }) : null
  return updateDoc(userDoc(uid, 'tasks', task.id), {
    ...changes,
    ...(reminder ? { remindAt: reminder.remindAt, reminderSent: false } : {}),
    activity: withActivity(task, note),
    updatedAt: Date.now(),
  })
}

// Pushes the reminder back without touching the task's planned date and time.
export function snoozeTask(uid: string, task: Task, minutes: number) {
  return updateDoc(userDoc(uid, 'tasks', task.id), { remindAt: Date.now() + minutes * 60_000, reminderSent: false })
}

// Deleting a task also clears it as a prerequisite elsewhere.
export async function deleteTask(uid: string, task: Task, all: Task[]) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'users', uid, 'tasks', task.id))
  for (const t of all) {
    if (t.dependsOn === task.id) batch.update(doc(db, 'users', uid, 'tasks', t.id), { dependsOn: null })
  }
  await batch.commit()
}

export const isBlocked = (task: Task, all: Task[]) =>
  !!task.dependsOn && all.some((t) => t.id === task.dependsOn && t.status !== 'done')

// True when `task` already depends (directly or further up the chain) on `id`, to avoid cycles.
export function dependsOnChain(task: Task, id: string, all: Task[], seen = new Set<string>()): boolean {
  if (!task.dependsOn || seen.has(task.id)) return false
  if (task.dependsOn === id) return true
  seen.add(task.id)
  const parent = all.find((t) => t.id === task.dependsOn)
  return parent ? dependsOnChain(parent, id, all, seen) : false
}

export type StatusResult = 'ok' | 'blocked'

// Moving to Done on a repeating task creates its next occurrence (once).
export async function setStatus(uid: string, task: Task, status: Status, all: Task[]): Promise<StatusResult> {
  if (status !== 'todo' && isBlocked(task, all)) return 'blocked'
  const becameDone = status === 'done' && task.status !== 'done'
  await updateTask(
    uid,
    task,
    { status, completedOn: status === 'done' ? task.completedOn ?? todayKey() : null },
    `Moved to ${status === 'todo' ? 'To do' : status === 'doing' ? 'Doing' : 'Done'}`,
  )
  if (becameDone && task.repeat !== 'never' && !all.some((t) => t.recurringFrom === task.id)) {
    const { id: _id, uid: _uid, createdAt: _c, updatedAt: _u, ...rest } = task
    await createTask(uid, {
      ...rest,
      date: nextDate(task.date, task.repeat),
      status: 'todo',
      completedOn: null,
      subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
      comments: [],
      activity: [stamp('Created from repeating task')],
      recurringFrom: task.id,
    })
  }
  return 'ok'
}

export const toggleDone = (uid: string, task: Task, all: Task[]) =>
  setStatus(uid, task, task.status === 'done' ? 'todo' : 'done', all)

export const priorityRank = { high: 0, medium: 1, low: 2 } as const
export const priorityLabel = { high: 'High', medium: 'Medium', low: 'Low' } as const
export const priorityPill = { high: 'pink', medium: 'amber', low: 'sage' } as const
export const statusLabel = { todo: 'To do', doing: 'Doing', done: 'Done' } as const

