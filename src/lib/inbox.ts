import { shift } from './dates'
import type { Task } from './types'

const DAY = 86_400_000

// The Inbox: open tasks with no date yet, oldest first so nothing sinks out of sight.
export const inboxTasks = <T extends Pick<Task, 'date' | 'status' | 'archived' | 'createdAt'>>(tasks: T[]) =>
  tasks.filter((t) => !t.date && t.status !== 'done' && !t.archived).sort((a, b) => a.createdAt - b.createdAt)

// "Waiting 2 weeks" only once something has sat for a week; fresher items need no label.
export function waiting(createdAt: number, now = Date.now()) {
  const days = Math.floor((now - createdAt) / DAY)
  if (days < 7) return null
  if (days < 14) return 'Waiting a week'
  if (days < 30) return `Waiting ${Math.floor(days / 7)} weeks`
  const months = Math.floor(days / 30)
  return months === 1 ? 'Waiting a month' : `Waiting ${months} months`
}

// A nudge to sort the Inbox when it has grown or something has waited a while.
export const needsReview = (inbox: Pick<Task, 'createdAt'>[], now = Date.now()) =>
  inbox.length >= 5 || inbox.some((t) => now - t.createdAt >= 7 * DAY)

// The week a "Later" applies to, keyed by its Monday.
export function weekKey(today: string) {
  const d = new Date(`${today}T12:00:00`)
  return shift(today, -((d.getDay() + 6) % 7))
}
