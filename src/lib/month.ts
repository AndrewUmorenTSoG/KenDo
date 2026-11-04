import { dateKey, shift } from './dates'
import type { Task } from './types'

// Whole Monday-first weeks covering the month of `key`: 35 or 42 days (28 for a neat February).
export function monthGrid(key: string) {
  const first = `${key.slice(0, 7)}-01`
  const d = new Date(`${first}T12:00:00`)
  const start = shift(first, -((d.getDay() + 6) % 7))
  d.setMonth(d.getMonth() + 1, 0)
  const last = dateKey(d)
  const days: string[] = []
  for (let day = start; day <= last || days.length % 7; day = shift(day, 1)) days.push(day)
  return days
}

export interface DayCount {
  open: number
  done: number
  // Open tasks on a day that has already passed.
  overdue: number
}

export function countByDay(tasks: Pick<Task, 'date' | 'status'>[], today: string) {
  const counts = new Map<string, DayCount>()
  for (const t of tasks) {
    if (!t.date) continue
    const c = counts.get(t.date) ?? { open: 0, done: 0, overdue: 0 }
    if (t.status === 'done') c.done++
    else {
      c.open++
      if (t.date < today) c.overdue++
    }
    counts.set(t.date, c)
  }
  return counts
}

// Open dated tasks from today onwards, soonest first; high priority and important ones lead within a day.
export function upcoming<T extends Pick<Task, 'date' | 'time' | 'status' | 'priority' | 'important'>>(
  tasks: T[],
  today: string,
  days = 14,
) {
  const until = shift(today, days)
  const weight = (t: T) => (t.priority === 'high' ? 0 : 1) + (t.important ? 0 : 1)
  return tasks
    .filter((t) => t.status !== 'done' && t.date >= today && t.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date) || weight(a) - weight(b) || (a.time || '99').localeCompare(b.time || '99'))
}
