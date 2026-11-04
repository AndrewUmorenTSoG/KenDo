import { priorityRank } from './taskRules'
import type { Energy, Task } from './types'

const level: Record<Energy, number> = { low: 0, medium: 1, high: 2 }

export const energyLabel: Record<Energy, string> = { low: 'Low energy', medium: 'Medium energy', high: 'High energy' }

// "Something useful I can do in 20 minutes with low energy": open, unblocked tasks that fit the time and
// need no more energy than there is. Today's and overdue ones come first, then important and high priority.
export function fitsNow<T extends Pick<Task, 'id' | 'status' | 'estimate' | 'energy' | 'date' | 'priority' | 'important'>>(
  tasks: T[],
  minutes: number,
  energy: Energy,
  today: string,
  blocked: (t: T) => boolean = () => false,
) {
  const soon = (t: T) => (t.date && t.date <= today ? 0 : t.date ? 1 : 2)
  return tasks
    .filter((t) => t.status !== 'done' && t.estimate <= minutes && level[t.energy ?? 'medium'] <= level[energy] && !blocked(t))
    .sort(
      (a, b) =>
        soon(a) - soon(b) ||
        Number(!!b.important) - Number(!!a.important) ||
        priorityRank[a.priority] - priorityRank[b.priority] ||
        (a.date || '9999').localeCompare(b.date || '9999') ||
        b.estimate - a.estimate,
    )
}
