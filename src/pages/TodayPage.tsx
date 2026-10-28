import { endOfDay, format, isToday } from 'date-fns'
import { useState } from 'react'
import QuickAdd from '../components/QuickAdd'
import TaskEditor from '../components/TaskEditor'
import TaskItem from '../components/TaskItem'
import { useTasks } from '../data/tasks'
import { useUid } from '../hooks/useAuth'
import type { Task } from '../lib/types'

const priorityRank = { high: 0, medium: 1, low: 2 }

// "What should I do today?": anything overdue or due today, plus high priority tasks with no date.
export default function TodayPage() {
  const uid = useUid()
  const { items: tasks, loading } = useTasks(uid)
  const [editing, setEditing] = useState<Task | null>(null)
  const end = endOfDay(new Date()).getTime()

  const today = tasks
    .filter((t) => !t.done && ((t.dueAt && t.dueAt <= end) || (!t.dueAt && t.priority === 'high')))
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (a.dueAt ?? end) - (b.dueAt ?? end))
  const doneToday = tasks.filter((t) => t.done && t.completedAt && isToday(t.completedAt))
  const total = today.length + doneToday.length
  const plannedMinutes = today.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0)

  return (
    <section className="stack">
      <header>
        <p className="eyebrow">{format(new Date(), 'EEEE d MMMM')}</p>
        <h1>Today</h1>
        <p className="muted">
          {total === 0 ? 'Nothing planned yet.' : `${doneToday.length} of ${total} done`}
          {plannedMinutes > 0 && ` · about ${Math.round(plannedMinutes / 6) / 10}h left`}
        </p>
        {total > 0 && (
          <div className="progress" role="progressbar" aria-valuenow={doneToday.length} aria-valuemax={total}>
            <span style={{ width: `${(doneToday.length / total) * 100}%` }} />
          </div>
        )}
      </header>

      <QuickAdd defaults={{ dueAt: end - 60_000 }} />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <ul className="task-list">
          {today.map((t) => (
            <TaskItem key={t.id} task={t} all={tasks} onEdit={setEditing} />
          ))}
        </ul>
      )}

      {doneToday.length > 0 && (
        <details>
          <summary>Completed today ({doneToday.length})</summary>
          <ul className="task-list">
            {doneToday.map((t) => (
              <TaskItem key={t.id} task={t} all={tasks} onEdit={setEditing} />
            ))}
          </ul>
        </details>
      )}

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}
