import { useState } from 'react'
import { PageHeading, Pill, Stat } from '../components/bits'
import Icon, { type IconName } from '../components/Icon'
import { updateProfile, useStore } from '../data/store'
import { useUI } from '../hooks/useUI'
import { exportData } from '../lib/exportData'
import { fmt, lastDays } from '../lib/dates'
import { streak } from '../lib/stats'

export default function ReviewPage() {
  const { uid, tasks, sessions, projects, profile, notes, habits } = useStore()
  const { toast } = useUI()
  const [reflection, setReflection] = useState(profile.reflection)
  const dates = lastDays(7)
  const counts = dates.map((d) => tasks.filter((t) => t.completedOn === d).length)
  const total = counts.reduce((a, b) => a + b, 0)
  const weekTasks = tasks.filter((t) => dates.includes(t.date))
  const rate = Math.round((weekTasks.filter((t) => t.status === 'done').length / (weekTasks.length || 1)) * 100)
  const weekSessions = sessions.filter((s) => dates.includes(s.date))
  const minutes = weekSessions.reduce((n, s) => n + s.minutes, 0)
  const days = streak(tasks)
  const max = Math.max(...counts, 1)

  const milestones: [IconName, string, string, boolean][] = [
    ['check', 'First things first', 'Complete your first task', tasks.some((t) => t.status === 'done')],
    ['fire', 'Finding your rhythm', 'Complete tasks 7 days in a row', days >= 7],
    ['focus', 'In the zone', 'Finish four focus sessions', sessions.length >= 4],
  ]

  return (
    <>
      <PageHeading
        eyebrow="WEEKLY REVIEW"
        title="Look at how far you’ve come."
        sub="A little reflection. A fresh perspective for the week ahead."
        actions={
          <button
            className="btn"
            onClick={() => {
              exportData({ profile, projects, tasks, notes, habits, sessions })
              toast('Your workspace backup is ready.')
            }}
          >
            <Icon name="download" />
            Export my data
          </button>
        }
      />
      <div className="stats">
        <Stat label="Tasks completed" icon="check" value={total} foot="Over the last seven days" />
        <Stat
          label="Completion rate"
          icon="chart"
          value={
            <>
              {rate}
              <small>%</small>
            </>
          }
          foot="Of tasks scheduled this week"
        />
        <Stat
          label="Focus time"
          icon="clock"
          value={
            <>
              {minutes} <small>min</small>
            </>
          }
          foot="From completed focus sessions"
        />
        <Stat
          label="Current streak"
          icon="fire"
          value={
            <>
              {days} <small>days</small>
            </>
          }
          foot="A little progress, each day"
        />
      </div>
      <div className="review-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-title">
              <h2>Your week, in little wins</h2>
              <Pill colour="pink">Last 7 days</Pill>
            </div>
            <div className="chart" role="img" aria-label={dates.map((d, i) => `${fmt(d)}: ${counts[i]} tasks`).join(', ')}>
              {dates.map((d, i) => (
                <div key={d} className="chart-column">
                  <b>{counts[i]}</b>
                  <div className="chart-bar" style={{ height: (counts[i] / max) * 135 }} />
                  <small>{fmt(d, { weekday: 'short' })}</small>
                </div>
              ))}
            </div>
            <p className="tiny muted">Each completed task is one less thing on your mind.</p>
          </section>
          <section className="panel">
            <div className="panel-title">
              <h2>A moment to reflect</h2>
              <Icon name="note" />
            </div>
            <p className="tiny muted">What went well? What would make next week feel lighter?</p>
            <label className="field">
              <span className="tiny muted">Your reflection</span>
              <textarea
                placeholder="This week, I’m proud of…"
                maxLength={4000}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />
            </label>
            <button
              className="btn primary"
              onClick={() => {
                updateProfile(uid, { reflection })
                toast('Your reflection is saved.')
              }}
            >
              Save reflection
            </button>
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <h2>Where your energy went</h2>
            {projects.map((p) => {
              const time = weekSessions.filter((s) => s.projectId === p.id).reduce((n, s) => n + s.minutes, 0)
              return (
                <div key={p.id} className="area-row">
                  <div className="row between">
                    <span>{p.name}</span>
                    <span className="muted">{time} min</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${(time / (minutes || 1)) * 100}%` }} />
                  </div>
                </div>
              )
            })}
            <p className="tiny muted">Time comes from your completed focus sessions.</p>
          </section>
          <section className="panel">
            <h2>Little milestones</h2>
            {milestones.map(([icon, title, desc, earned]) => (
              <div key={title} className="achievement">
                <span className="habit-icon" style={{ opacity: earned ? 1 : 0.35 }}>
                  <Icon name={icon} />
                </span>
                <div>
                  <h3>
                    {title}
                    {earned ? ' ✓' : ''}
                  </h3>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  )
}
