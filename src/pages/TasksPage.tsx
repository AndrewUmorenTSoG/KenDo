import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import QuickAdd from '../components/QuickAdd'
import TaskEditor from '../components/TaskEditor'
import TaskItem from '../components/TaskItem'
import { useTasks } from '../data/tasks'
import { useUid } from '../hooks/useAuth'
import type { Priority, Task } from '../lib/types'

type Status = 'open' | 'done' | 'all'

export default function TasksPage() {
  const uid = useUid()
  const { items: tasks, loading } = useTasks(uid)
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('open')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [tag, setTag] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)

  // Deep links from notifications (?open=id) and the home screen shortcut (?new=1).
  const openId = params.get('open')
  const creating = params.get('new') === '1'
  const linked = openId ? tasks.find((t) => t.id === openId) : undefined
  const closeLinked = () => setParams({}, { replace: true })

  const allTags = useMemo(() => [...new Set(tasks.flatMap((t) => t.tags))].sort(), [tasks])

  const visible = tasks
    .filter((t) => (status === 'all' ? true : status === 'done' ? t.done : !t.done))
    .filter((t) => !priority || t.priority === priority)
    .filter((t) => !tag || t.tags.includes(tag))
    .filter((t) => {
      const q = search.trim().toLowerCase()
      return !q || t.title.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q)
    })
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || b.createdAt - a.createdAt)

  return (
    <section className="stack">
      <h1>Tasks</h1>
      <QuickAdd autoFocus={creating} />

      <div className="filters">
        <input type="search" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Status">
          <option value="open">Open</option>
          <option value="done">Completed</option>
          <option value="all">All</option>
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')} aria-label="Priority">
          <option value="">Any priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
          <option value="">Any tag</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="muted">No tasks match.</p>
      ) : (
        <ul className="task-list">
          {visible.map((t) => (
            <TaskItem key={t.id} task={t} all={tasks} onEdit={setEditing} />
          ))}
        </ul>
      )}

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
      {linked && !editing && <TaskEditor task={linked} onClose={closeLinked} />}
    </section>
  )
}
