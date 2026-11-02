import { setDoc } from 'firebase/firestore'
import { useState } from 'react'
import { countCompletion, useStore } from '../data/store'
import { deleteTask, isBlocked, setStatus, stored, taskRef, updateTask } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { fmt, shift, todayKey } from '../lib/dates'
import { missedHeading, missedOrder, missedTasks, skipDate } from '../lib/replan'
import type { Task } from '../lib/types'
import Dialog from './Dialog'
import Icon from './Icon'

interface Outcome {
  text: string
  undo: () => void
}

// Writes go to Firestore's offline queue; the screen moves on without waiting for the server.
const quietly = (p: Promise<unknown>) => void p.catch(() => undefined)

// A gentle pass over open tasks from days that have passed. Nothing moves until a choice is made,
// every choice can be undone, and closing it part way through is fine.
export default function ReplanDialog() {
  const { uid, tasks } = useStore()
  const { close } = useUI()
  const today = todayKey()
  const tomorrow = shift(today, 1)
  const [withRepeating, setWithRepeating] = useState(false)
  // A snapshot, so rows stay put (with their Undo) after they're sorted.
  const [rows, setRows] = useState(() => missedTasks(tasks, today, false))
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({})
  const [picking, setPicking] = useState<string | null>(null)
  const [warning, setWarning] = useState<Record<string, string>>({})
  const repeatingCount = missedTasks(tasks, today, true).length - missedTasks(tasks, today, false).length

  const live = (id: string) => tasks.find((t) => t.id === id)
  const left = rows.filter((t) => !outcomes[t.id]).length

  function done(task: Task, outcome: Outcome) {
    setOutcomes((o) => ({ ...o, [task.id]: outcome }))
    setPicking(null)
  }

  function undone(task: Task) {
    outcomes[task.id]?.undo()
    setOutcomes(({ [task.id]: _gone, ...rest }) => rest)
  }

  function moveTo(task: Task, date: string, text: string) {
    const before = { date: task.date, time: task.time }
    quietly(updateTask(uid, task, date ? { date } : { date: '', time: '' }, text))
    done(task, {
      text,
      undo: () => {
        const now = live(task.id)
        if (now) quietly(updateTask(uid, now, before, 'Replan undone'))
      },
    })
  }

  function complete(task: Task) {
    if (isBlocked(task, tasks)) {
      setWarning((w) => ({ ...w, [task.id]: 'Finish the task this one depends on first.' }))
      return
    }
    quietly(setStatus(uid, task, 'done', tasks))
    quietly(countCompletion(uid))
    done(task, {
      text: 'Marked as done',
      undo: () => {
        const now = live(task.id) ?? task
        quietly(updateTask(uid, now, { status: task.status, completedOn: null }, 'Replan undone'))
        // Completing a repeating task makes its next occurrence; take that back too.
        const next = tasks.find((t) => t.recurringFrom === task.id && t.status !== 'done')
        if (next) quietly(deleteTask(uid, next, tasks))
      },
    })
  }

  function remove(task: Task) {
    const dependents = tasks.filter((t) => t.dependsOn === task.id)
    quietly(deleteTask(uid, task, tasks))
    done(task, {
      text: 'Deleted',
      undo: () => {
        quietly(setDoc(taskRef(uid, task), stored(task)))
        for (const t of dependents) quietly(updateTask(uid, t, { dependsOn: task.id }, 'Replan undone'))
      },
    })
  }

  function toggleRepeating() {
    const next = !withRepeating
    setWithRepeating(next)
    const extra = missedTasks(tasks, today, true).filter((t) => t.repeat !== 'never')
    setRows((current) =>
      next
        ? [...current, ...extra.filter((t) => !current.some((c) => c.id === t.id))].sort(missedOrder)
        : current.filter((t) => t.repeat === 'never' || outcomes[t.id]),
    )
  }

  const heading = missedHeading(
    rows.map((t) => t.date),
    shift(today, -1),
  )

  return (
    <Dialog title={heading} onClose={close} className="replan-dialog">
      <p className="small muted">What should we do with these tasks?</p>

      {repeatingCount > 0 && (
        <label className="replan-include">
          <input type="checkbox" checked={withRepeating} onChange={toggleRepeating} />
          Include repeating tasks ({repeatingCount})
        </label>
      )}

      <div className="replan-list">
        {rows.map((task) => {
          const outcome = outcomes[task.id]
          return (
            <div key={task.id} className={`replan-row ${outcome ? 'settled' : ''}`}>
              <div className="replan-title">
                <strong>{task.title}</strong>
                <span>
                  {fmt(task.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                  {task.time && ` · ${task.time}`}
                  {task.repeat !== 'never' && ' · repeats'}
                </span>
              </div>
              {outcome ? (
                <div className="replan-outcome" role="status">
                  <Icon name="check" />
                  <span>{outcome.text}</span>
                  <button className="text-btn" onClick={() => undone(task)}>
                    Undo
                  </button>
                </div>
              ) : (
                <>
                  <div className="replan-actions" role="group" aria-label={`Replan ${task.title}`}>
                    <button className="btn" onClick={() => complete(task)}>
                      <Icon name="check" />
                      Done
                    </button>
                    <button className="btn" onClick={() => moveTo(task, today, 'Moved to today')}>
                      Today
                    </button>
                    <button className="btn" onClick={() => moveTo(task, tomorrow, 'Moved to tomorrow')}>
                      Tomorrow
                    </button>
                    <button className="btn" aria-expanded={picking === task.id} onClick={() => setPicking(picking === task.id ? null : task.id)}>
                      <Icon name="calendar" />
                      Date
                    </button>
                    <button className="btn" onClick={() => moveTo(task, '', 'Sent to Inbox')}>
                      <Icon name="inbox" />
                      Inbox
                    </button>
                    {task.repeat !== 'never' && (
                      <button
                        className="btn"
                        onClick={() => {
                          const next = skipDate(task, today)
                          if (next) moveTo(task, next, `Skipped · next on ${fmt(next, { weekday: 'short', day: 'numeric', month: 'short' })}`)
                          else setWarning((w) => ({ ...w, [task.id]: 'This series has no more dates. Mark it done or delete it instead.' }))
                        }}
                      >
                        <Icon name="repeat" />
                        Skip this one
                      </button>
                    )}
                    <button className="icon-btn" aria-label={`Delete ${task.title}`} title="Delete" onClick={() => remove(task)}>
                      <Icon name="trash" />
                    </button>
                  </div>
                  {picking === task.id && (
                    <div className="replan-date">
                      <label htmlFor={`rp-${task.id}`} className="tiny muted">
                        Move to
                      </label>
                      <input
                        id={`rp-${task.id}`}
                        type="date"
                        min={today}
                        autoFocus
                        onChange={(e) => {
                          const date = e.target.value
                          if (date && date >= today)
                            moveTo(task, date, `Moved to ${fmt(date, { weekday: 'short', day: 'numeric', month: 'short' })}`)
                        }}
                      />
                    </div>
                  )}
                  {warning[task.id] && <p className="tiny replan-warning">{warning[task.id]}</p>}
                </>
              )}
            </div>
          )
        })}
        {!rows.length && (
          <div className="empty">
            <Icon name="check" />
            <p>Nothing left behind.</p>
          </div>
        )}
      </div>

      <div className="dialog-footer">
        <span className="tiny muted">{rows.length > 0 && (left ? `${left} still waiting` : 'All sorted')}</span>
        <button className={`btn ${left ? '' : 'primary'}`} onClick={close}>
          {left ? 'Leave the rest for now' : 'Done'}
        </button>
      </div>
    </Dialog>
  )
}
