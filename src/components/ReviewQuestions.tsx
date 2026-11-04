import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { updateTask } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { fmt, plural, shift, todayKey } from '../lib/dates'
import { timesMoved, weekReview } from '../lib/review'
import type { Task } from '../lib/types'
import Icon from './Icon'

const quietly = (p: Promise<unknown>) => void p.catch(() => undefined)

// The weekly review as a handful of honest, kind questions, each with something to do about it.
export default function ReviewQuestions() {
  const { uid, tasks, projects, sessions } = useStore()
  const { open, toast } = useUI()
  const navigate = useNavigate()
  const today = todayKey()
  const r = weekReview(tasks, projects, sessions, today)
  // Next Monday, for "carry it into next week".
  const nextMonday = shift(today, 7 - ((new Date(`${today}T12:00:00`).getDay() + 6) % 7))
  const hours = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10} h` : `${m} min`)

  function change(task: Task, changes: Partial<Task>, message: string) {
    const before = Object.fromEntries(Object.keys(changes).map((k) => [k, task[k as keyof Task] ?? null])) as Partial<Task>
    quietly(updateTask(uid, task, changes, message))
    toast(message, { label: 'Undo', run: () => quietly(updateTask(uid, task, before, 'Undone')) })
  }

  const letGo = (task: Task) => change(task, { archived: true }, `Let go of “${task.title}”. It’s in the archive if you need it.`)
  const name = (task: Task) => (
    <button className="review-task-name" onClick={() => open({ kind: 'task', id: task.id })}>
      {task.title}
    </button>
  )

  return (
    <section className="panel review-questions" aria-labelledby="review-q-title">
      <div className="panel-title">
        <h2 id="review-q-title">A few questions for the week</h2>
      </div>

      <Question title="What did I complete?" count={r.completed.length} empty="Nothing ticked off this week, and that’s allowed. Rest is part of it.">
        <ul className="review-list">
          {r.completed.slice(0, 12).map((t) => (
            <li key={t.id}>
              <Icon name="check" />
              {name(t)}
              <span>{fmt(t.completedOn!, { weekday: 'short' })}</span>
            </li>
          ))}
        </ul>
        {r.completed.length > 12 && <p className="tiny muted">And {r.completed.length - 12} more.</p>}
      </Question>

      <Question title="What remains overdue?" count={r.overdue.length} empty="Nothing left behind.">
        <ul className="review-list">
          {r.overdue.slice(0, 8).map((t) => (
            <li key={t.id}>
              {name(t)}
              <span>{fmt(t.date, { day: 'numeric', month: 'short' })}</span>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={() => open({ kind: 'replan' })}>
          <Icon name="calendar" />
          Replan these
        </button>
      </Question>

      <Question title="What did I postpone again and again?" count={r.postponed.length} empty="Nothing keeps slipping.">
        {r.postponed.map((t) => (
          <div key={t.id} className="review-card">
            <p>
              You moved {name(t)} {timesMoved(t.moves ?? 0)}. Is it still important, or can we let it go?
            </p>
            <div className="row">
              <button className="btn" onClick={() => change(t, { moves: 0, important: true }, `“${t.title}” is marked important.`)}>
                Still important
              </button>
              <button className="btn" onClick={() => letGo(t)}>
                Let it go
              </button>
            </div>
          </div>
        ))}
      </Question>

      <Question title="Which projects are going quiet?" count={r.stale.length} empty="Every project has seen some care lately.">
        <ul className="review-list">
          {r.stale.map(({ project, open: n }) => (
            <li key={project.id}>
              <span className={`dot ${project.colour}`} />
              <button className="review-task-name" onClick={() => navigate(`/projects?project=${project.id}`)}>
                {project.name}
              </button>
              <span>{plural(n, 'open task')} · quiet for two weeks</span>
            </li>
          ))}
        </ul>
      </Question>

      <Question title="Planned time and finished time" count={null}>
        <div className="review-time">
          <div>
            <strong>{hours(r.plannedMinutes)}</strong>
            <span>planned</span>
          </div>
          <div>
            <strong>{hours(r.doneMinutes)}</strong>
            <span>finished</span>
          </div>
          <div>
            <strong>{hours(r.focusMinutes)}</strong>
            <span>focused</span>
          </div>
        </div>
        {r.plannedMinutes > 0 && (
          <div className="progress" aria-label={`${Math.round((r.doneMinutes / r.plannedMinutes) * 100)}% of planned time finished`}>
            <span style={{ width: `${Math.min(100, (r.doneMinutes / r.plannedMinutes) * 100)}%` }} />
          </div>
        )}
        {r.plannedMinutes > 0 && r.doneMinutes < r.plannedMinutes * 0.5 && (
          <p className="tiny muted">Plans often run bigger than days. Planning a little less next week is a fine choice.</p>
        )}
      </Question>

      <Question title="What should carry forward?" count={r.carry.length} empty="Nothing to carry over.">
        {r.carry.map((t) => (
          <div key={t.id} className="review-row">
            {name(t)}
            <div className="row">
              <button className="btn" onClick={() => change(t, { date: nextMonday }, `“${t.title}” moved to ${fmt(nextMonday, { weekday: 'long', day: 'numeric', month: 'short' })}.`)}>
                Next week
              </button>
              <button className="btn" onClick={() => change(t, { date: '', time: '' }, `“${t.title}” is in your Inbox.`)}>
                Inbox
              </button>
            </div>
          </div>
        ))}
      </Question>

      <Question title="What could be removed?" count={r.letGo.length} empty="Nothing has been waiting too long.">
        <p className="tiny muted">Waiting in your Inbox for a month or more.</p>
        {r.letGo.map((t) => (
          <div key={t.id} className="review-row">
            {name(t)}
            <div className="row">
              <button className="btn" onClick={() => letGo(t)}>
                Let it go
              </button>
            </div>
          </div>
        ))}
      </Question>
    </section>
  )
}

function Question({ title, count, empty, children }: { title: string; count: number | null; empty?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const nothing = count === 0
  return (
    <details className="review-question" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span>{title}</span>
        {count !== null && <span className={`pill ${nothing ? 'sage' : ''}`}>{count}</span>}
      </summary>
      <div className="review-answer">{nothing ? <p className="tiny muted">{empty}</p> : children}</div>
    </details>
  )
}
