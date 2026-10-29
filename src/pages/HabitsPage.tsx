import { IconButton, PageHeading } from '../components/bits'
import Icon, { isIconName } from '../components/Icon'
import { createHabit, deleteHabit, toggleHabitDay } from '../data/habits'
import { useStore } from '../data/store'
import { useUI } from '../hooks/useUI'
import { fmt, lastDays } from '../lib/dates'

export default function HabitsPage() {
  const { uid, habits, tasks, projects } = useStore()
  const { open, close, toast } = useUI()
  const days = lastDays(7)

  return (
    <>
      <PageHeading
        eyebrow="HABITS & GOALS"
        title="Small things, done often."
        actions={
          <button
            className="btn primary"
            onClick={() =>
              open({
                kind: 'prompt',
                title: 'Build a little rhythm.',
                label: 'Daily habit',
                onSubmit: (title) => {
                  createHabit(uid, title, 'Personal')
                  close()
                  toast('A new beginning. One day at a time.')
                },
              })
            }
          >
            <Icon name="plus" />
            New habit
          </button>
        }
      />
      <div className="habit-grid">
        {habits.map((h) => {
          const count = h.days.filter((d) => days.includes(d)).length
          return (
            <section key={h.id} className="panel habit-card">
              <div className="row between">
                <div className="row">
                  <span className="habit-icon">
                    <Icon name={isIconName(h.icon) ? h.icon : 'habit'} />
                  </span>
                  <div>
                    <h3>{h.title}</h3>
                    <p className="muted tiny" style={{ marginTop: 5 }}>
                      {h.area} · Daily intention
                    </p>
                  </div>
                </div>
                <IconButton
                  label="Delete habit"
                  icon="trash"
                  onClick={() =>
                    open({
                      kind: 'confirm',
                      title: 'Remove this habit?',
                      text: 'Its check-in history will also be removed.',
                      onConfirm: () => deleteHabit(uid, h.id),
                    })
                  }
                />
              </div>
              <div className="habit-days">
                {days.map((d) => {
                  const checked = h.days.includes(d)
                  return (
                    <div key={d} className="habit-day">
                      {fmt(d, { weekday: 'short' }).slice(0, 1)}
                      <button
                        className={checked ? 'checked' : ''}
                        aria-label={`${h.title} on ${fmt(d)}`}
                        aria-pressed={checked}
                        onClick={() => toggleHabitDay(uid, h, d)}
                      >
                        {checked ? <Icon name="check" /> : Number(d.slice(-2))}
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="row between tiny muted" style={{ margin: '11px 0' }}>
                <span>{count} of 7 days</span>
                <span>{Math.round((count / 7) * 100)}% this week</span>
              </div>
              <div className="progress">
                <span style={{ width: `${(count / 7) * 100}%` }} />
              </div>
            </section>
          )
        })}
        {!habits.length && (
          <section className="panel empty" style={{ gridColumn: '1 / -1' }}>
            <Icon name="habit" />
            <p>No habits yet.</p>
          </section>
        )}
      </div>
      <section className="panel" style={{ marginTop: 23 }}>
        <div className="panel-title">
          <h2>Your project goals</h2>
        </div>
        {projects.map((p) => {
          const own = tasks.filter((t) => t.projectId === p.id)
          const done = own.filter((t) => t.status === 'done').length
          return (
            <div key={p.id} className="area-row">
              <div className="row between">
                <span>{p.name}</span>
                <span className="muted">
                  {done} / {own.length}
                </span>
              </div>
              <div className="progress green">
                <span style={{ width: `${(done / (own.length || 1)) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </section>
    </>
  )
}
