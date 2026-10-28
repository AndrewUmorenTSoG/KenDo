import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore'
import { nextOccurrence } from '../lib/recurrence'
import type { NewTask, Task } from '../lib/types'
import { useCollection, userCollection, userDoc } from './collection'

export function useTasks(uid: string) {
  return useCollection<Task>(uid, 'tasks')
}

export function createTask(uid: string, input: NewTask) {
  const now = Date.now()
  const task: Omit<Task, 'id'> = {
    priority: 'medium',
    done: false,
    tags: [],
    subtasks: [],
    blockedBy: [],
    noteIds: [],
    reminderSent: false,
    ...input,
    uid,
    createdAt: now,
    updatedAt: now,
  }
  return addDoc(userCollection(uid, 'tasks'), task)
}

export function updateTask(uid: string, id: string, changes: Partial<Task>) {
  // A new reminder time should fire again even if an older one was already sent.
  const reset = 'remindAt' in changes ? { reminderSent: false } : {}
  return updateDoc(userDoc(uid, 'tasks', id), { ...changes, ...reset, updatedAt: Date.now() })
}

export function deleteTask(uid: string, id: string) {
  return deleteDoc(userDoc(uid, 'tasks', id))
}

// Completing a recurring task rolls it forward to its next date instead of closing it.
export async function toggleTask(uid: string, task: Task) {
  if (task.done) return updateTask(uid, task.id, { done: false, completedAt: null })

  if (task.recurrence && task.dueAt) {
    const nextDue = nextOccurrence(task.dueAt, task.recurrence)
    const shift = nextDue - task.dueAt
    await createTask(uid, { ...stripMeta(task), done: true, completedAt: Date.now(), recurrence: null, remindAt: null })
    return updateTask(uid, task.id, {
      dueAt: nextDue,
      remindAt: task.remindAt ? task.remindAt + shift : null,
      subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
    })
  }

  return updateTask(uid, task.id, { done: true, completedAt: Date.now() })
}

export function isBlocked(task: Task, all: Task[]) {
  return task.blockedBy.some((id) => all.find((t) => t.id === id && !t.done))
}

function stripMeta(task: Task): NewTask {
  const { id: _id, uid: _uid, createdAt: _c, updatedAt: _u, ...rest } = task
  return rest
}
