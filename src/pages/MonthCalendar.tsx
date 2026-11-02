import { useState } from 'react'
import { IconButton, PageHeading } from '../components/bits'
import Icon from '../components/Icon'
import { useStore } from '../data/store'
import { colourProps, priorityRank } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { fmt, plural, shift, shiftMonths, todayKey } from '../lib/dates'
import { countByDay, monthGrid, upcoming } from '../lib/month'
import DayCalendar from './DayCalendar'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// A calm month: a count and a couple of names per day, never a spreadsheet. Choosing a day opens
// its timeline underneath.
export default function MonthCalendar() {
  const { tasks } = useStore()
  const { open } = useUI()
  const today = todayKey()
  const [selected, setSelected] = useState(today)
  const days = monthGrid(selected)
  const month = selected.slice(0, 7)
  const counts = countByDay(tasks, today)
  const soon = upcoming(tasks, today).slice(0, 6)

  const titlesOn = (date: string) =>
    tasks
      .filter((t) => t.date === date && t.status !== 'done')
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (a.time || '99').localeCompare(b.time || '99'))

  const jump = (date: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) setSelected(date)
  }

  const label = (date: string) => {
    const c = counts.get(date)
    const parts = [fmt(date, { weekday: 'long', day: 'numeric', month: 'long' })]
    if (date === today) parts.push('today')
    if (c?.open) parts.push(plural(c.open, 'open task'))
    if (c?.overdue) parts.push('overdue')
    if (c?.done) parts.push(`${c.done} done`)
    return parts.join(', ')
  }

  return (
    <div className="month-view">
      <PageHeading
        eyebrow="YOUR MONTH"
        title={fmt(selected, { month: 'long', year: 'numeric' })}
        actions={
          <>
            <label className="month-jump">
              <span className="sr-only">Jump to date</span>
              <Icon name="calendar" />
              <input type="date" aria-label="Jump to date" value={selected} onChange={(e) => jump(e.target.value)} />
            </label>
            <button className="btn" onClick={() => setSelected(today)}>
              Today
            </button>
          </>
        }
      />

      <div className="month-layout">
        <section className="panel month-panel" aria-label={`${fmt(selected, { month: 'long', year: 'numeric' })} calendar`}>
          <div className="month-nav">
            <IconButton
              label="Previous month"
              icon="chevron"
              style={{ transform: 'rotate(180deg)' }}
              onClick={() => setSelected(`${shiftMonths(`${month}-15`, -1).slice(0, 7)}-01`)}
            />
            <h2>{fmt(selected, { month: 'long' })}</h2>
            <IconButton label="Next month" icon="chevron" onClick={() => setSelected(`${shiftMonths(`${month}-15`, 1).slice(0, 7)}-01`)} />
          </div>
          <div className="month-grid" role="grid" aria-readonly="true">
            <div role="row" className="month-row">
              {WEEKDAYS.map((d) => (
                <div key={d} role="columnheader" className="month-weekday">
                  <span aria-hidden="true">{d.slice(0, 1)}</span>
                  <span className="sr-only">{d}</span>
                  <span className="wide" aria-hidden="true">{d}</span>
                </div>
              ))}
            </div>
            {Array.from({ length: days.length / 7 }, (_, w) => (
              <div key={w} role="row" className="month-row">
                {days.slice(w * 7, w * 7 + 7).map((date) => {
                  const c = counts.get(date)
                  const names = titlesOn(date).slice(0, 2)
                  const classes = [
                    'month-day',
                    date.slice(0, 7) !== month && 'outside',
                    date === today && 'today',
                    date === selected && 'selected',
                    c?.overdue && 'overdue',
                    date < today && 'past',
                  ]
                  return (
                    <button
                      key={date}
                      role="gridcell"
                      aria-selected={date === selected}
                      aria-label={label(date)}
                      className={classes.filter(Boolean).join(' ')}
                      onClick={() => setSelected(date)}
                      onKeyDown={(e) => {
                        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
                        if (!step) return
                        e.preventDefault()
                        const next = shift(date, step)
                        setSelected(next)
                        requestAnimationFrame(() =>
                          document.querySelector<HTMLButtonElement>(`.month-day[data-date="${next}"]`)?.focus(),
                        )
                      }}
                      data-date={date}
                      tabIndex={date === selected ? 0 : -1}
                    >
                      <span className="month-date">{Number(date.slice(-2))}</span>
                      {c && c.open + c.done > 0 && (
                        <span className="month-count" aria-hidden="true">
                          {c.open > 0 ? c.open : <Icon name="check" />}
                        </span>
                      )}
                      <span className="month-names" aria-hidden="true">
                        {names.map((t) => (
                          <span key={t.id} className={`month-name ${colourProps(t).className}`} style={colourProps(t).style}>
                            {t.title}
                          </span>
                        ))}
                        {c && c.open > names.length && <span className="month-more">+{c.open - names.length} more</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="month-key" aria-hidden="true">
            <span>
              <i className="key-today" /> Today
            </span>
            <span>
              <i className="key-overdue" /> Still open from a past day
            </span>
          </div>
        </section>

        <section className="panel month-upcoming" aria-labelledby="upcoming-title">
          <div className="panel-title">
            <h2 id="upcoming-title">Coming up</h2>
            <span className="tiny muted">Next two weeks</span>
          </div>
          {soon.map((t) => (
            <button key={t.id} className="upcoming-item" onClick={() => open({ kind: 'task', id: t.id })}>
              <span className="upcoming-date">
                <strong>{Number(t.date.slice(-2))}</strong>
                {fmt(t.date, { month: 'short' })}
              </span>
              <span className="upcoming-text">
                <strong>{t.title}</strong>
                <span>
                  {t.date === today ? 'Today' : t.date === shift(today, 1) ? 'Tomorrow' : fmt(t.date, { weekday: 'long' })}
                  {t.time && ` · ${t.time}`}
                  {t.priority === 'high' && ' · High priority'}
                </span>
              </span>
            </button>
          ))}
          {!soon.length && <p className="tiny muted">Nothing dated in the next two weeks.</p>}
        </section>
        <div className="month-day-timeline">
          <DayCalendar date={selected} onDate={setSelected} embedded />
        </div>
      </div>
    </div>
  )
}
