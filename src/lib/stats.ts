import { shift, todayKey } from './dates'
import type { Task } from './types'

// Consecutive days with at least one completed task, counting today only once something is done.
export function streak(tasks: Task[]) {
  const days = new Set(tasks.map((t) => t.completedOn).filter(Boolean))
  let key = todayKey()
  if (!days.has(key)) key = shift(key, -1)
  let n = 0
  while (days.has(key) && n < 3660) {
    n++
    key = shift(key, -1)
  }
  return n
}
