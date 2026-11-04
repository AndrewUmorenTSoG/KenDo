import { shift } from './dates'
import type { FocusSession, Project, Task } from './types'

const DAY = 86_400_000

export interface WeekReview<T> {
  completed: T[]
  overdue: T[]
  postponed: T[]
  stale: { project: Project; open: number }[]
  plannedMinutes: number
  doneMinutes: number
  focusMinutes: number
  carry: T[]
  letGo: T[]
}

type ReviewTask = Pick<Task, 'id' | 'title' | 'date' | 'status' | 'completedOn' | 'estimate' | 'projectId' | 'createdAt' | 'updatedAt' | 'priority' | 'important'> & {
  moves?: number
}

// The weekly review's questions, answered from the last seven days (today included).
export function weekReview<T extends ReviewTask>(tasks: T[], projects: Project[], sessions: Pick<FocusSession, 'date' | 'minutes'>[], today: string, now = Date.now()): WeekReview<T> {
  const from = shift(today, -6)
  const inWeek = (d: string | null) => !!d && d >= from && d <= today
  const open = tasks.filter((t) => t.status !== 'done')
  const planned = tasks.filter((t) => inWeek(t.date))
  const completed = tasks.filter((t) => t.status === 'done' && inWeek(t.completedOn)).sort((a, b) => (b.completedOn ?? '').localeCompare(a.completedOn ?? ''))
  const overdue = open.filter((t) => t.date && t.date < today).sort((a, b) => a.date.localeCompare(b.date))
  const postponed = open.filter((t) => (t.moves ?? 0) >= 3).sort((a, b) => (b.moves ?? 0) - (a.moves ?? 0))

  // A project is going stale when it has open tasks but nothing in it was finished or touched for two weeks.
  const stale = projects
    .map((project) => {
      const mine = tasks.filter((t) => t.projectId === project.id)
      const openHere = mine.filter((t) => t.status !== 'done').length
      const lastActivity = Math.max(0, ...mine.map((t) => t.updatedAt))
      return { project, open: openHere, quiet: now - lastActivity >= 14 * DAY }
    })
    .filter((p) => p.open > 0 && p.quiet)
    .map(({ project, open }) => ({ project, open }))

  // Carry forward: open tasks from this week that matter (important or high priority, or planned this week
  // and not yet moved many times). Let go: things that keep slipping or have waited a month undated.
  const carry = open.filter((t) => inWeek(t.date) && t.date < today && (t.moves ?? 0) < 3)
  const letGo = open.filter((t) => !postponed.includes(t) && !t.date && now - t.createdAt >= 30 * DAY && t.priority !== 'high' && !t.important)

  return {
    completed,
    overdue,
    postponed,
    stale,
    plannedMinutes: planned.reduce((n, t) => n + t.estimate, 0),
    doneMinutes: planned.filter((t) => t.status === 'done').reduce((n, t) => n + t.estimate, 0),
    focusMinutes: sessions.filter((s) => inWeek(s.date)).reduce((n, s) => n + s.minutes, 0),
    carry,
    letGo,
  }
}

// "You moved this task four times." Small numbers read better as words.
const words = ['zero', 'once', 'twice', 'three times', 'four times', 'five times', 'six times', 'seven times', 'eight times', 'nine times']
export const timesMoved = (n: number) => (n < words.length ? words[n] : `${n} times`)
