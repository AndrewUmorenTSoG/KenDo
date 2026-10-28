import { Fragment, useState } from 'react'
import { IconButton, PageHeading } from '../components/bits'
import Icon from '../components/Icon'
import { useStore } from '../data/store'
import { updateTask } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { fmt, todayKey, week } from '../lib/dates'

const hours = Array.from({ length: 14 }, (_, i) => i + 7)
const hh = (hour: number) => `${String(hour).padStart(2, '0')}:00`

export default function CalendarPage() {
  const { uid, tasks } = useStore()
  const { open, toast } = useUI()
  const [offset, setOffset] = useState(0)
  const [dragOver, setDragOver] = useState('')
  const dates = week(offset)
  const today = todayKey()

  // Anything before 7am or after 8pm still shows, in the first or last row.
  const rowFor = (time: string) => Math.min(20, Math.max(7, Number(time.split(':')[0])))

  async function drop(e: React.DragEvent, date: string, hour: number) {
    e.preventDefault()
    setDragOver('')
    const task = tasks.find((t) => t.id === e.dataTransfer.getData('text/plain'))
    if (!task) return
    const time = hh(hour)
    await updateTask(uid, task, { date, time }, `Rescheduled to ${date} ${time}`)
    toast('Plan updated.')
  }

  return (
    <>
      <PageHeading
        eyebrow="YOUR WEEK"
        title="Make time for what matters."
        sub={`${fmt(dates[0])} – ${fmt(dates[6], { day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <>
            <button className="btn" onClick={() => setOffset(0)}>
              Today
            </button>
            <button className="btn primary" onClick={() => open({ kind: 'task', id: null })}>
              <Icon name="plus" />
              Time block
            </button>
          </>
        }
      />
      <div className="toolbar">
        <div className="row">
          <IconButton
            label="Previous week"
            icon="chevron"
            style={{ transform: 'rotate(180deg)' }}
            onClick={() => setOffset(offset - 1)}
          />
          <IconButton label="Next week" icon="chevron" onClick={() => setOffset(offset + 1)} />
          <span className="tiny muted">Week view</span>
        </div>
        <span className="tiny muted">Click a space to plan · Drag a task to reschedule</span>
      </div>
      <section className="panel calendar-wrap">
        <div className="calendar-grid">
          <div className="calendar-head" />
          {dates.map((d) => (
            <div key={d} className={`calendar-head ${d === today ? 'current' : ''}`}>
              {fmt(d, { weekday: 'short' })}
              <strong>{Number(d.slice(-2))}</strong>
            </div>
          ))}
          {hours.map((hour) => (
            <Fragment key={hour}>
              <div className="calendar-time">{hh(hour)}</div>
              {dates.map((d) => {
                const cell = `${d}-${hour}`
                return (
                  <div
                    key={cell}
                    className={`calendar-cell ${dragOver === cell ? 'drag-over' : ''}`}
                    tabIndex={0}
                    role="group"
                    aria-label={`${fmt(d)} at ${hh(hour)}`}
                    onClick={(e) =>
                      e.target === e.currentTarget && open({ kind: 'task', id: null, defaults: { date: d, time: hh(hour) } })
                    }
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        open({ kind: 'task', id: null, defaults: { date: d, time: hh(hour) } })
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(cell)
                    }}
                    onDragLeave={() => setDragOver('')}
                    onDrop={(e) => drop(e, d, hour)}
                  >
                    {tasks
                      .filter((t) => t.date === d && t.time && rowFor(t.time) === hour)
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((t) => (
                        <button
                          key={t.id}
                          className="calendar-event"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', t.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onClick={() => open({ kind: 'task', id: t.id })}
                        >
                          {t.title}
                          <span>
                            {t.time} · {t.estimate} min{t.status === 'done' ? ' · Done' : ''}
                          </span>
                        </button>
                      ))}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </section>
      <p className="tiny muted" style={{ marginTop: 15 }}>
        Blocks are grouped by start hour. Duration is shown on each block.
      </p>
    </>
  )
}

