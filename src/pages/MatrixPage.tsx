import { PageHeading } from '../components/bits'
import Icon from '../components/Icon'
import { TaskList } from '../components/TaskRow'
import { useStore } from '../data/store'
import { useUI } from '../hooks/useUI'
import { shift, todayKey } from '../lib/dates'
import type { Task } from '../lib/types'

export default function MatrixPage() {
  const { tasks } = useStore()
  const { open } = useUI()
  const tomorrow = shift(todayKey(), 1)
  const openTasks = tasks.filter((t) => t.status !== 'done')
  // Urgent means due today or tomorrow, including anything overdue.
  const urgent = (t: Task) => !!t.date && t.date <= tomorrow

  const quadrants: [string, string, string, (t: Task) => boolean][] = [
    ['Do first', 'Urgent & important', 'pink', (t) => urgent(t) && t.important],
    ['Make time', 'Important, not urgent', 'sage', (t) => !urgent(t) && t.important],
    ['Share the load', 'Urgent, less important', 'amber', (t) => urgent(t) && !t.important],
    ['Let it wait', 'Neither urgent nor important', 'lavender', (t) => !urgent(t) && !t.important],
  ]

  return (
    <>
      <PageHeading
        eyebrow="PRIORITY MATRIX"
        title="Clarity before busyness."
        sub="Urgent means due today or tomorrow. Mark importance in the task editor."
        actions={
          <button className="btn primary" onClick={() => open({ kind: 'task', id: null })}>
            <Icon name="plus" />
            New task
          </button>
        }
      />
      <div className="matrix">
        {quadrants.map(([title, sub, colour, predicate]) => (
          <section key={title} className="panel quadrant">
            <div className="quadrant-header">
              <span className={`pill ${colour}`}>{title}</span>
              <p>{sub}</p>
            </div>
            <TaskList tasks={openTasks.filter(predicate)} />
          </section>
        ))}
      </div>
    </>
  )
}
