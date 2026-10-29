import { addDoc, collection, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { todayKey, toMillis } from '../lib/dates'
import { db } from '../lib/firebase'
import { nextDate } from '../lib/recurrence'
import type { CSSProperties } from 'react'
import type { NewTask, Status, Task, TaskColour } from '../lib/types'
import { userCollection, userDoc } from './collection'

// A shared project keeps its tasks next to it (users/{owner}/projects/{id}/tasks) so every member
// can reach them. The store keeps this map of shared project id → owner up to date.
let sharedOwners = new Map<string, string>()
export const setSharedOwners = (owners: Map<string, string>) => {
  sharedOwners = owners
}

export function taskCollection(uid: string, projectId: string | null) {
  const owner = projectId ? sharedOwners.get(projectId) : undefined
  return owner ? collection(db, 'users', owner, 'projects', projectId!, 'tasks') : userCollection(uid, 'tasks')
}

export const taskRef = (uid: string, task: Pick<Task, 'id' | 'path'>) =>
  task.path ? doc(db, task.path) : userDoc(uid, 'tasks', task.id)

// Just the fields Firestore stores: no id, and not the store's path.
export const stored = ({ id: _id, path: _path, ...rest }: Task) => rest

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

// Every dated task gets a notification: at its time, or at 9am when it has none. The scheduled function
// looks for remindAt, so keep it in step with date and time. Times already gone get no notification.
export function remindTime(date: string, time: string) {
  const at = toMillis(date, time || '09:00')
  return at && at > Date.now() ? at : null
}

function withReminder<T extends Pick<Task, 'reminder' | 'date' | 'time'>>(task: T): T {
  const remindAt = remindTime(task.date, task.time)
  return { ...task, reminder: remindAt !== null, remindAt, reminderSent: false }
}

export function createTask(uid: string, input: NewTask) {
  return addDoc(taskCollection(uid, input.projectId ?? null), blankTask(uid, input))
}

export function updateTask(uid: string, task: Task, changes: Partial<Task>, note = 'Task edited') {
  const keys = ['date', 'time'] as const
  const reminderChanged = keys.some((k) => k in changes && changes[k] !== task[k])
  const reminder = reminderChanged ? withReminder({ ...task, ...changes }) : null
  const data = {
    ...changes,
    ...(reminder ? { reminder: reminder.reminder, remindAt: reminder.remindAt, reminderSent: false } : {}),
    activity: withActivity(task, note),
    updatedAt: Date.now(),
  }
  const current = taskRef(uid, task)
  const target = 'projectId' in changes ? taskCollection(uid, changes.projectId ?? null) : null
  if (target && target.path !== current.parent.path) {
    // Moving into or out of a shared project moves the document too.
    const batch = writeBatch(db)
    batch.set(doc(target, task.id), { ...stored(task), ...data })
    batch.delete(current)
    return batch.commit()
  }
  return updateDoc(current, data)
}

// Pushes the reminder back without touching the task's planned date and time.
export function snoozeTask(uid: string, task: Task, minutes: number) {
  return updateDoc(taskRef(uid, task), { remindAt: Date.now() + minutes * 60_000, reminderSent: false })
}

// Deleting a task also clears it as a prerequisite elsewhere.
export async function deleteTask(uid: string, task: Task, all: Task[]) {
  const batch = writeBatch(db)
  batch.delete(taskRef(uid, task))
  for (const t of all) {
    if (t.dependsOn === task.id) batch.update(taskRef(uid, t), { dependsOn: null })
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
    const { id: _id, path: _path, uid: _uid, createdAt: _c, updatedAt: _u, ...rest } = task
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

export const taskColours: Record<TaskColour, string> = {
  red: '#e5484d',
  orange: '#f17b2c',
  yellow: '#e8b10e',
  green: '#2fb36b',
  teal: '#12a594',
  blue: '#3b82f6',
  purple: '#8e4ec6',
  pink: '#e93d82',
}

// Inline style and class for a colour-coded task, or nothing when it has no colour.
export const colourProps = (task: Pick<Task, 'colour'>) =>
  task.colour
    ? { className: 'coloured', style: { '--task-colour': taskColours[task.colour] } as CSSProperties }
    : { className: '', style: undefined }

export const priorityRank = { high: 0, medium: 1, low: 2 } as const
export const priorityLabel = { high: 'High', medium: 'Medium', low: 'Low' } as const
export const priorityPill = { high: 'pink', medium: 'amber', low: 'sage' } as const
export const statusLabel = { todo: 'To do', doing: 'Doing', done: 'Done' } as const

