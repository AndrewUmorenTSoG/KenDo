import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, PageHeading, Stat } from '../components/bits'
import Icon from '../components/Icon'
import QuickAdd from '../components/QuickAdd'
import TaskToolbar, { useTaskFilters } from '../components/TaskToolbar'
import { TaskList } from '../components/TaskRow'
import { useStore } from '../data/store'
import { priorityRank } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { fmt, todayKey, week } from '../lib/dates'
import { streak } from '../lib/stats'
import { verseOfTheDay } from '../lib/verses'

const greetings = ['A fresh start', 'Good to see you', 'One step at a time']

export default function TodayPage() {
  const { tasks, sessions, profile, projects } = useStore()
  const { open } = useUI()
  const navigate = useNavigate()
  const { filters, setFilters, apply } = useTaskFilters()
  const today = todayKey()
  const [agendaDate, setAgendaDate] = useState(today)

  const todays = tasks.filter((t) => t.date === today)
  const list = apply(todays).sort(
    (a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (a.time || '99').localeCompare(b.time || '99'),
  )
  const open_ = list.filter((t) => t.status !== 'done')
  const done = list.filter((t) => t.status === 'done')
  const doneCount = todays.filter((t) => t.status === 'done').length
  const focusMinutes = sessions.filter((s) => s.date === today).reduce((n, s) => n + s.minutes, 0)
  const agenda = tasks
    .filter((t) => t.date === agendaDate && t.time && t.status !== 'done')
    .sort((a, b) => a.time.localeCompare(b.time))
  const greeting = greetings[new Date().getDate() % greetings.length]
  const verse = verseOfTheDay(today)

  return (
    <>
      <PageHeading
        eyebrow={fmt(today, { weekday: 'long', day: 'numeric', month: 'long' })}
        title={
          <>
            {greeting}
            {profile.name ? `, ${profile.name}` : ''} <span style={{ color: 'var(--rose)', fontWeight: 400 }}>✧</span>
          </>
        }
        sub="A little plan. A clearer mind. Let’s make today count."
        actions={
          <>
            <button className="btn" onClick={() => open({ kind: 'plan' })}>
              <Icon name="calendar" />
              Plan my day
            </button>
            <button className="btn primary" onClick={() => open({ kind: 'task', id: null })}>
              <Icon name="plus" />
              New task
            </button>
          </>
        }
      />

      <section className="hero">
        <div className="hero-copy">
          <h2>
            You don’t have to do it all.
            <br />
            Just what matters.
          </h2>
          {profile.verses ? (
            <p className="hero-verse">
              “{verse.text}” <span>{verse.ref}</span>
            </p>
          ) : (
            <p>Make space for your priorities, and a little space for you.</p>
          )}
          <span className="pill">
            <Icon name="leaf" /> Small steps are still steps.
          </span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit" />
          <div className="orbit two" />
          <div className="flower">
            <Icon name="check" />
          </div>
          <span className="spark one">✧</span>
          <span className="spark two">✦</span>
          <div className="floating-label">a little more intentional.</div>
        </div>
      </section>

      <div className="stats">
        <Stat
          label="Today’s progress"
          icon="check"
          value={
            <>
              {doneCount} <small>/ {todays.length} tasks</small>
            </>
          }
          foot={
            <>
              <b>{Math.round((doneCount / (todays.length || 1)) * 100)}% complete</b> · one step at a time
            </>
          }
        />
        <Stat
          label="Focus time"
          icon="clock"
          value={
            <>
              {focusMinutes} <small>min</small>
            </>
          }
          foot="Room for your best work"
        />
        <Stat
          label="Current streak"
          icon="fire"
          value={
            <>
              {streak(tasks)} <small>days</small>
            </>
          }
          foot={<b>Small steps. Real momentum.</b>}
        />
        <Stat
          label="Still on your plate"
          icon="leaf"
          value={
            <>
              {todays.length - doneCount} <small>tasks</small>
            </>
          }
          foot={`${todays.filter((t) => t.status !== 'done').reduce((n, t) => n + t.estimate, 0)} min estimated`}
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title">
            <h2>
              Today’s intentions <span className="muted tiny">{todays.length}</span>
            </h2>
            <IconButton label="Add task" icon="plus" onClick={() => open({ kind: 'task', id: null })} />
          </div>
          <TaskToolbar filters={filters} setFilters={setFilters} />
          {open_.length > 0 && (
            <>
              <div className="task-group-title">
                <span className="dot" /> Make it happen <span className="muted">{open_.length}</span>
              </div>
              <TaskList tasks={open_} />
            </>
          )}
          {done.length > 0 && (
            <>
              <div className="task-group-title">
                <Icon name="check" /> A little progress
              </div>
              <TaskList tasks={done} />
            </>
          )}
          {!list.length && <TaskList tasks={[]} />}
          <QuickAdd />
        </section>

        <aside className="stack dashboard-aside">
          <section className="panel">
            <div className="panel-title">
              <h2>A little structure</h2>
              <button className="text-btn" onClick={() => navigate('/calendar')}>
                Calendar ↗
              </button>
            </div>
            <div className="week-strip">
              {week().map((d) => (
                <button key={d} className={`week-day ${d === agendaDate ? 'active' : ''}`} onClick={() => setAgendaDate(d)}>
                  <span>{fmt(d, { weekday: 'short' }).slice(0, 1)}</span>
                  <strong>{Number(d.slice(-2))}</strong>
                </button>
              ))}
            </div>
            {agenda.slice(0, 3).map((t, i) => (
              <div key={t.id} className="agenda-item">
                <span className="agenda-time">{t.time}</span>
                <button
                  className={`agenda-block ${['', 'sage', 'lavender'][i % 3]}`}
                  onClick={() => open({ kind: 'task', id: t.id })}
                >
                  <strong>{t.title}</strong>
                  <span>
                    {t.estimate} min · {projects.find((p) => p.id === t.projectId)?.name ?? 'No project'}
                  </span>
                </button>
              </div>
            ))}
            {!agenda.length && <p className="muted tiny">An open day. Add a little intention.</p>}
          </section>
          <section className="focus-mini">
            <Icon name="focus" />
            <div className="eyebrow">ONE THING AT A TIME</div>
            <h2>Find your focus.</h2>
            <p>25 minutes. One task. A little momentum.</p>
            <button className="btn" onClick={() => navigate('/focus')}>
              <Icon name="play" />
              Let’s focus
            </button>
          </section>
          <section className="note-preview">
            <h3>A note to yourself</h3>
            <p>
              Progress doesn’t have to be loud.
              <br />
              Sometimes it’s just showing up.
            </p>
            <div style={{ marginTop: 10 }}>
              <button className="text-btn" onClick={() => navigate('/notes')}>
                Open your notes ↗
              </button>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
