import { setDoc } from 'firebase/firestore'
import { useRef, useState, type FormEvent } from 'react'
import { PageHeading } from '../components/bits'
import Icon from '../components/Icon'
import { useStore } from '../data/store'
import { createTask, deleteTask, stored, taskRef, updateTask } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { fmt, plural, shift, todayKey } from '../lib/dates'
import { inboxTasks, waiting } from '../lib/inbox'
import { parseQuickAdd } from '../lib/quickAdd'
import { describe, repeatOf, ruleFor, type Preset } from '../lib/recurrence'
import type { Task } from '../lib/types'

const quietly = (p: Promise<unknown>) => void p.catch(() => undefined)

// Somewhere to put things down quickly and sort them later. Nothing here appears on My day
// until it's given a date.
export default function InboxPage() {
  const { uid, tasks, archivedTasks } = useStore()
  const { open, toast } = useUI()
  const [text, setText] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const inbox = inboxTasks(tasks)
  const archived = archivedTasks.filter((t) => t.status !== 'done').sort((a, b) => b.updatedAt - a.updatedAt)

  function capture(e: FormEvent) {
    e.preventDefault()
    const parsed = parseQuickAdd(text)
    if (!parsed.title) return
    // Undated unless the words say otherwise ("tomorrow", "18:00").
    createTask(uid, { date: '', ...parsed })
    setText('')
    input.current?.focus()
    if (parsed.date) toast(`Added to ${parsed.date === todayKey() ? 'today' : fmt(parsed.date, { weekday: 'long' })}.`)
  }

  // Each change says what happened, with a way back.
  function change(task: Task, changes: Partial<Task>, message: string, note = message) {
    const before = Object.fromEntries(Object.keys(changes).map((k) => [k, task[k as keyof Task] ?? null])) as Partial<Task>
    quietly(updateTask(uid, task, changes, note))
    toast(message, {
      label: 'Undo',
      run: () => {
        const now = [...tasks, ...archivedTasks].find((t) => t.id === task.id) ?? task
        quietly(updateTask(uid, now, before, 'Undone'))
      },
    })
  }

  function remove(task: Task) {
    const dependents = tasks.filter((t) => t.dependsOn === task.id)
    quietly(deleteTask(uid, task, tasks))
    toast('Deleted.', {
      label: 'Undo',
      run: () => {
        quietly(setDoc(taskRef(uid, task), stored(task)))
        for (const t of dependents) quietly(updateTask(uid, t, { dependsOn: task.id }, 'Undone'))
      },
    })
  }

  return (
    <>
      <PageHeading eyebrow="INBOX" title="Put it down. Sort it later." sub={inbox.length ? plural(inbox.length, 'thing') + ' waiting' : undefined} />

      <form className="inbox-capture" onSubmit={capture}>
        <Icon name="plus" />
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Capture a task"
          placeholder="Capture a thought…"
          maxLength={180}
          enterKeyHint="done"
          autoComplete="off"
        />
        <button type="submit" className="btn primary" disabled={!text.trim()}>
          Add
        </button>
      </form>

      <section className="panel inbox-list" aria-label="Inbox">
        {inbox.map((task) => (
          <InboxItem key={task.id} task={task} change={change} remove={remove} />
        ))}
        {!inbox.length && (
          <div className="empty">
            <Icon name="inbox" />
            <p>Your Inbox is clear.</p>
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section className="inbox-archive">
          <button className="text-btn" aria-expanded={showArchive} onClick={() => setShowArchive(!showArchive)}>
            <Icon name="archive" />
            Archived ({archived.length})
          </button>
          {showArchive &&
            archived.map((task) => (
              <div key={task.id} className="inbox-archived">
                <button className="inbox-title" onClick={() => open({ kind: 'task', id: task.id })}>
                  {task.title}
                </button>
                <button className="text-btn" onClick={() => change(task, { archived: false }, 'Back in your Inbox.', 'Restored from the archive')}>
                  Restore
                </button>
                <button className="icon-btn" aria-label={`Delete ${task.title}`} title="Delete" onClick={() => remove(task)}>
                  <Icon name="trash" />
                </button>
              </div>
            ))}
        </section>
      )}
    </>
  )
}

type Change = (task: Task, changes: Partial<Task>, message: string, note?: string) => void

// One Inbox entry: quick dates up front, the rest one tap away.
function InboxItem({
  task,
  change,
  remove,
}: {
  task: Task
  change: Change
  remove: (task: Task) => void
}) {
  const { projects } = useStore()
  const { open } = useUI()
  const [panel, setPanel] = useState<null | 'schedule' | 'more'>(null)
  const [date, setDate] = useState(todayKey())
  const [time, setTime] = useState('')
  const [tag, setTag] = useState('')
  const project = projects.find((p) => p.id === task.projectId)
  const age = waiting(task.createdAt)
  const today = todayKey()
  const day = (d: string) => (d === today ? 'today' : d === shift(today, 1) ? 'tomorrow' : fmt(d, { weekday: 'long', day: 'numeric', month: 'short' }))

  function repeat(preset: Preset) {
    // A repeating task needs a first date; today unless one was chosen.
    const first = date || today
    const rule = ruleFor(preset, first, null)
    if (!rule) return
    change(task, { date: first, repeat: repeatOf(rule), recurrence: rule }, `${describe(rule)}, from ${day(first)}.`, 'Made into a repeating task')
  }

  return (
    <div className="inbox-item">
      <div className="inbox-main">
        <button className="inbox-title" onClick={() => open({ kind: 'task', id: task.id })}>
          {task.title}
        </button>
        <div className="inbox-meta">
          {project && (
            <span className="pill">
              <span className={`dot ${project.colour}`} />
              {project.name}
            </span>
          )}
          {task.tags.map((t) => (
            <span key={t} className="pill">
              #{t}
            </span>
          ))}
          {age && <span className="inbox-age">{age}</span>}
        </div>
      </div>
      <div className="inbox-actions" role="group" aria-label={`Sort ${task.title}`}>
        <button className="btn" onClick={() => change(task, { date: today }, 'Added to today.', 'Scheduled from the Inbox')}>
          Today
        </button>
        <button className="btn" onClick={() => change(task, { date: shift(today, 1) }, 'Added to tomorrow.', 'Scheduled from the Inbox')}>
          Tomorrow
        </button>
        <button className="btn" aria-expanded={panel === 'schedule'} onClick={() => setPanel(panel === 'schedule' ? null : 'schedule')}>
          <Icon name="calendar" />
          Schedule
        </button>
        <button className="btn" aria-expanded={panel === 'more'} aria-label={`More for ${task.title}`} onClick={() => setPanel(panel === 'more' ? null : 'more')}>
          More
        </button>
      </div>

      {panel === 'schedule' && (
        <form
          className="inbox-panel"
          onSubmit={(e) => {
            e.preventDefault()
            if (!date) return
            change(task, { date, time }, `Planned for ${day(date)}${time ? ` at ${time}` : ''}.`, 'Scheduled from the Inbox')
          }}
        >
          <label>
            <span>Day</span>
            <input type="date" value={date} min={today} required onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>Time</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label>
            <span>Repeat</span>
            <select value="never" onChange={(e) => e.target.value !== 'never' && repeat(e.target.value as Preset)}>
              <option value="never">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Every week</option>
              <option value="fortnightly">Every two weeks</option>
              <option value="monthly">Every month</option>
            </select>
          </label>
          <button type="submit" className="btn primary">
            Plan it
          </button>
        </form>
      )}

      {panel === 'more' && (
        <div className="inbox-panel">
          <label>
            <span>Project</span>
            <select
              value={task.projectId ?? ''}
              onChange={(e) => {
                const name = projects.find((p) => p.id === e.target.value)?.name ?? 'no project'
                change(task, { projectId: e.target.value || null }, `Moved to ${name}.`, 'Moved from the Inbox')
              }}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <form
            className="inbox-tag"
            onSubmit={(e) => {
              e.preventDefault()
              const clean = tag.trim().replace(/^#/, '').toLowerCase()
              if (!clean || task.tags.includes(clean)) return setTag('')
              change(task, { tags: [...task.tags, clean] }, `Tagged #${clean}.`, 'Tagged')
              setTag('')
            }}
          >
            <label>
              <span>Tag</span>
              <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="#idea" maxLength={30} />
            </label>
            <button type="submit" className="btn">
              Add tag
            </button>
          </form>
          <div className="inbox-put-away">
            <button className="btn" onClick={() => change(task, { archived: true }, 'Archived.', 'Archived from the Inbox')}>
              <Icon name="archive" />
              Archive
            </button>
            <button className="btn danger" onClick={() => remove(task)}>
              <Icon name="trash" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
