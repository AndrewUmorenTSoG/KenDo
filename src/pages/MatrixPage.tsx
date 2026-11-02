import { PageHeading } from '../components/bits'
import Icon from '../components/Icon'
import { TaskList } from '../components/TaskRow'
import { useStore } from '../data/store'
import { useUI } from '../hooks/useUI'
import { todayKey } from '../lib/dates'
import { byMatrixRank, quadrantOf, quadrants } from '../lib/taskRules'

export default function MatrixPage() {
  const { tasks } = useStore()
  const { open } = useUI()
  const today = todayKey()
  const openTasks = tasks.filter((t) => t.status !== 'done')

  return (
    <>
      <PageHeading
        eyebrow="PRIORITY MATRIX"
        title="Clarity before busyness."
        actions={
          <button className="btn primary" onClick={() => open({ kind: 'task', id: null })}>
            <Icon name="plus" />
            New task
          </button>
        }
      />
      <div className="matrix">
        {quadrants.map((q) => (
          <section key={q.id} className="panel quadrant">
            <div className="quadrant-header">
              <span className={`pill ${q.colour}`}>{q.title}</span>
              <p>{q.sub}</p>
            </div>
            <TaskList tasks={byMatrixRank(openTasks.filter((t) => quadrantOf(t, today) === q.id))} />
          </section>
        ))}
      </div>
    </>
  )
}
