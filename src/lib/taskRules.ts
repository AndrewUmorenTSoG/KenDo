// Task rules shared by the app and the server (the MCP connector), so both behave the same.
// Nothing here may touch the browser or Firebase.
import { shift } from './dates'
import type { Task } from './types'

type Linked = Pick<Task, 'id' | 'dependsOn' | 'status'>

export const isBlocked = (task: Pick<Task, 'dependsOn'>, all: Linked[]) =>
  !!task.dependsOn && all.some((t) => t.id === task.dependsOn && t.status !== 'done')

// True when `task` already depends (directly or further up the chain) on `id`, to avoid cycles.
export function dependsOnChain(task: Linked, id: string, all: Linked[], seen = new Set<string>()): boolean {
  if (!task.dependsOn || seen.has(task.id)) return false
  if (task.dependsOn === id) return true
  seen.add(task.id)
  const parent = all.find((t) => t.id === task.dependsOn)
  return parent ? dependsOnChain(parent, id, all, seen) : false
}

export const priorityRank = { high: 0, medium: 1, low: 2 } as const

// What a new task starts with before the caller's own values.
export const taskDefaults = {
  description: '',
  projectId: null,
  priority: 'medium',
  status: 'todo',
  energy: 'medium',
  important: false,
  time: '',
  estimate: 25,
  repeat: 'never',
  recurringFrom: null,
  tags: [],
  subtasks: [],
  comments: [],
  dependsOn: null,
  noteId: null,
  reminder: false,
  remindAt: null,
  reminderSent: false,
  completedOn: null,
} satisfies Partial<Task>

// The priority matrix. Urgent means due today or tomorrow, including anything overdue; important is the
// task's own "Important to me" flag. Only open tasks appear.
export type QuadrantId = 'do_first' | 'make_time' | 'share_the_load' | 'let_it_wait'

export const quadrants: { id: QuadrantId; title: string; sub: string; colour: string; urgent: boolean; important: boolean }[] = [
  { id: 'do_first', title: 'Do first', sub: 'Urgent & important', colour: 'pink', urgent: true, important: true },
  { id: 'make_time', title: 'Make time', sub: 'Important, not urgent', colour: 'sage', urgent: false, important: true },
  { id: 'share_the_load', title: 'Share the load', sub: 'Urgent, less important', colour: 'amber', urgent: true, important: false },
  { id: 'let_it_wait', title: 'Let it wait', sub: 'Neither urgent nor important', colour: 'lavender', urgent: false, important: false },
]

export const isUrgent = (task: Pick<Task, 'date'>, today: string) => !!task.date && task.date <= shift(today, 1)

export function quadrantOf(task: Pick<Task, 'date' | 'important'>, today: string): QuadrantId {
  const urgent = isUrgent(task, today)
  return quadrants.find((q) => q.urgent === urgent && q.important === !!task.important)!.id
}

// Order inside a quadrant: tasks given a place (matrixRank) come first, in that order; the rest keep theirs.
export function byMatrixRank<T>(tasks: T[], rank: (t: T) => number | null | undefined = (t) => (t as Pick<Task, 'matrixRank'>).matrixRank) {
  return tasks
    .map((task, i) => ({ task, i, r: rank(task) ?? Infinity }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : a.r - b.r))
    .map((x) => x.task)
}
