import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeading } from '../components/bits'
import Icon from '../components/Icon'
import QuickAdd from '../components/QuickAdd'
import TaskToolbar, { useTaskFilters } from '../components/TaskToolbar'
import { TaskList } from '../components/TaskRow'
import { useStore } from '../data/store'
import { priorityRank } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { todayKey } from '../lib/dates'
import type { Task } from '../lib/types'

export default function TasksPage() {
  const { tasks, projects } = useStore()
  const { open } = useUI()
  const [params, setParams] = useSearchParams()
  const { filters, setFilters, apply } = useTaskFilters()
  const query = params.get('q') ?? ''
  const today = todayKey()

  // Deep links: ?open=<id> from a notification, ?new=1 from the home screen shortcut.
  useEffect(() => {
    const openId = params.get('open')
    if (openId && tasks.some((t) => t.id === openId)) {
      open({ kind: 'task', id: openId })
      setParams({}, { replace: true })
    } else if (params.get('new') === '1') {
      open({ kind: 'task', id: null })
      setParams({}, { replace: true })
    }
  }, [params, tasks, open, setParams])

  // Search matches title, tags and notes, plus the project's name.
  const q = query.trim().toLowerCase()
  const inProject = (t: Task) => projects.some((p) => p.id === t.projectId && p.name.toLowerCase().includes(q))
  const list = apply(tasks).filter((t) => !q || apply([t], q).length > 0 || inProject(t))
  const sorted = list.sort(
    (a, b) =>
      (a.date || '9999').localeCompare(b.date || '9999') ||
      Number(a.status === 'done') - Number(b.status === 'done') ||
      priorityRank[a.priority] - priorityRank[b.priority],
  )

  const groups: [string, (t: Task) => boolean][] = [
    ['Overdue', (t) => !!t.date && t.date < today && t.status !== 'done'],
    ['Today', (t) => t.date === today],
    ['Coming up', (t) => t.date > today],
    ['Someday', (t) => !t.date],
    ['Earlier wins', (t) => !!t.date && t.date < today && t.status === 'done'],
  ]

  return (
    <>
      <PageHeading
        eyebrow="ALL TASKS"
        title={query ? 'Search results' : 'A place for everything.'}
        sub={query ? `Tasks matching “${query}”` : 'Get it out of your head. Give it a place to land.'}
        actions={
          <button className="btn primary" onClick={() => open({ kind: 'task', id: null })}>
            <Icon name="plus" />
            New task
          </button>
        }
      />
      <section className="panel">
        <TaskToolbar filters={filters} setFilters={setFilters} />
        {groups.map(([label, predicate]) => {
          const group = sorted.filter(predicate)
          return (
            group.length > 0 && (
              <div key={label}>
                <div className="task-group-title">
                  {label} · {group.length}
                </div>
                <TaskList tasks={group} />
              </div>
            )
          )
        })}
        {!sorted.length && <TaskList tasks={[]} />}
        <QuickAdd />
      </section>
    </>
  )
}
