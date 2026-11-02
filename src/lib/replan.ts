import { nextDate } from './recurrence'
import type { Repeat, Task } from './types'

// Open tasks planned for a day that has passed. Repeating tasks stay out unless asked for,
// because their next occurrence usually takes care of itself.
export function missedTasks<T extends Pick<Task, 'date' | 'status' | 'repeat' | 'time'>>(
  tasks: T[],
  today: string,
  includeRepeating = false,
) {
  return tasks
    .filter((t) => !!t.date && t.date < today && t.status !== 'done' && (includeRepeating || t.repeat === 'never'))
    .sort(missedOrder)
}

// Most recent day first, then by time.
export const missedOrder = (a: Pick<Task, 'date' | 'time'>, b: Pick<Task, 'date' | 'time'>) =>
  b.date.localeCompare(a.date) || (a.time || '99').localeCompare(b.time || '99')

// Skipping an occurrence moves a repeating task to its next date that hasn't passed yet.
export function skipDate(date: string, repeat: Repeat, today: string) {
  if (repeat === 'never') return date
  let next = nextDate(date, repeat)
  while (next < today) next = nextDate(next, repeat)
  return next
}

// "Yesterday" when everything missed was planned for yesterday, otherwise "The last few days".
export function missedHeading(dates: string[], yesterday: string) {
  return dates.every((d) => d === yesterday)
    ? 'Yesterday did not go exactly as planned.'
    : 'The last few days did not go exactly as planned.'
}
