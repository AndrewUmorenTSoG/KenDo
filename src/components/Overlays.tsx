import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { applyTemplate, templates, templateSummaries } from '../data/projects'
import { useStore } from '../data/store'
import { priorityRank, snoozeTask } from '../data/tasks'
import { useUI, type Overlay } from '../hooks/useUI'
import { fmt, todayKey } from '../lib/dates'
import { Pill } from './bits'
import Dialog from './Dialog'
import Icon from './Icon'
import NoteEditor from './NoteEditor'
import TaskEditor from './TaskEditor'
import { TaskList } from './TaskRow'

// Renders whichever dialog is open. Keyed so each opening starts with fresh form state.
export default function Overlays() {
  const { overlay } = useUI()
  if (!overlay) return null
  const key = JSON.stringify({ k: overlay.kind, id: 'id' in overlay ? overlay.id : null })
  return <OverlayContent key={key} overlay={overlay} />
}

function OverlayContent({ overlay }: { overlay: Overlay }) {
  switch (overlay.kind) {
    case 'task':
      return <TaskEditor id={overlay.id} defaults={overlay.defaults} />
    case 'note':
      return <NoteEditor id={overlay.id} />
    case 'confirm':
      return <Confirm {...overlay} />
    case 'prompt':
      return <Prompt {...overlay} />
    case 'plan':
      return <PlanDay />
    case 'reminders':
      return <Reminders />
    case 'templates':
      return <Templates />
    case 'integration':
      return <Integration name={overlay.name} />
    case 'shared':
      return <SharedPreview />
  }
}

function Confirm({ title, text, onConfirm }: { title: string; text: string; onConfirm: () => void }) {
  const { close } = useUI()
  return (
    <Dialog title={title} onClose={close}>
      <p className="small muted">{text}</p>
      <div className="dialog-footer">
        <button className="btn" onClick={close}>
          Keep it
        </button>
        <button
          className="btn danger"
          onClick={() => {
            close()
            onConfirm()
          }}
        >
          Yes, continue
        </button>
      </div>
    </Dialog>
  )
}

function Prompt({ title, label, onSubmit }: { title: string; label: string; onSubmit: (value: string) => void }) {
  const { close } = useUI()
  const [value, setValue] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (value.trim()) onSubmit(value.trim())
  }
  return (
    <Dialog title={title} onClose={close}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="f-name">{label}</label>
          <input id="f-name" value={value} onChange={(e) => setValue(e.target.value)} required maxLength={80} autoFocus />
        </div>
        <div className="dialog-footer">
          <span />
          <button className="btn primary" type="submit">
            Create
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function PlanDay() {
  const { tasks } = useStore()
  const { close } = useUI()
  const navigate = useNavigate()
  const today = tasks
    .filter((t) => t.date === todayKey() && t.status !== 'done')
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (a.time || '99').localeCompare(b.time || '99'))
  return (
    <Dialog title="A little plan for today." onClose={close}>
      <p className="small muted">Start with your highest priorities. Leave room to breathe between tasks.</p>
      <div className="divider" />
      <TaskList tasks={today} />
      <div className="notice" style={{ marginTop: 18 }}>
        {today.reduce((n, t) => n + t.estimate, 0)} minutes of planned work. This list is ordered by the priorities you set.
      </div>
      <button
        className="btn primary"
        onClick={() => {
          close()
          navigate('/calendar')
        }}
      >
        <Icon name="calendar" />
        Open calendar
      </button>
    </Dialog>
  )
}

function Reminders() {
  const { uid, tasks } = useStore()
  const { close, toast } = useUI()
  const navigate = useNavigate()
  const list = tasks.filter((t) => t.status !== 'done' && t.reminder).sort((a, b) => (a.remindAt ?? 0) - (b.remindAt ?? 0))
  const timeOf = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return (
    <Dialog title="A little nudge." onClose={close}>
      <p className="tiny muted" style={{ marginBottom: 18 }}>
        Reminders arrive as notifications on every device where you’ve turned them on.{' '}
        <button
          className="text-btn"
          onClick={() => {
            close()
            navigate('/settings')
          }}
        >
          Notification settings
        </button>
      </p>
      {list.length ? (
        list.map((t) => (
          <div key={t.id} className="setting-row">
            <div>
              <h3>{t.title}</h3>
              <p>
                {fmt(t.date)} · {t.time}
                {t.remindAt && t.remindAt !== new Date(`${t.date}T${t.time}`).getTime() && ` · snoozed until ${timeOf(t.remindAt)}`}
              </p>
            </div>
            <button
              className="btn"
              onClick={() => {
                snoozeTask(uid, t, 10)
                toast('Snoozed for ten minutes.')
              }}
            >
              Snooze 10m
            </button>
          </div>
        ))
      ) : (
        <div className="empty">
          No reminders yet.
          <br />
          <span className="tiny">Add a date, time, and reminder to any task.</span>
        </div>
      )}
    </Dialog>
  )
}

function Templates() {
  const { uid, projects } = useStore()
  const { close, toast } = useUI()
  const navigate = useNavigate()
  return (
    <Dialog title="Start with a little structure." onClose={close}>
      <p className="small muted">Choose a reusable project starter. A new project and its tasks will be created.</p>
      <div className="stack" style={{ marginTop: 20 }}>
        {(Object.keys(templates) as (keyof typeof templates)[]).map((name) => (
          <button
            key={name}
            className="panel card-open"
            onClick={async () => {
              close()
              const id = await applyTemplate(uid, name, projects)
              navigate(`/projects?project=${id}`)
              toast('Your project has a little structure.')
            }}
          >
            <h3>{name}</h3>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              {templateSummaries[name]}
            </p>
          </button>
        ))}
      </div>
    </Dialog>
  )
}

function Integration({ name }: { name: string }) {
  const { close } = useUI()
  return (
    <Dialog title={`${name} preview.`} onClose={close}>
      <div className="notice">Coming soon · No account connection is made yet.</div>
      <div className="setting-row">
        <div>
          <h3>Bring your calendar into view</h3>
          <p>Choose which calendars to display alongside your tasks.</p>
        </div>
        <Icon name="calendar" />
      </div>
      <div className="setting-row">
        <div>
          <h3>Keep your plans in sync</h3>
          <p>This will use an authorised calendar connection.</p>
        </div>
        <Icon name="repeat" />
      </div>
      <div className="dialog-footer">
        <span />
        <button className="btn primary" onClick={close}>
          Got it
        </button>
      </div>
    </Dialog>
  )
}

function SharedPreview() {
  const { profile } = useStore()
  const { close } = useUI()
  return (
    <Dialog title="A shared list, thoughtfully simple." onClose={close}>
      <div className="notice">Coming soon · No invitation or message will be sent.</div>
      <h3>Shared list</h3>
      <p className="small muted" style={{ margin: '12px 0' }}>
        A shared place for the plan, the details, and everyone’s next step.
      </p>
      <div className="member">
        <span className="avatar">{(profile.name || 'K')[0]}</span>
        <div>
          {profile.name || 'You'}
          <p className="tiny muted">Owner · Can edit</p>
        </div>
      </div>
      <div className="setting-row">
        <span className="small">Invite people</span>
        <Pill colour="pink">Coming soon</Pill>
      </div>
      <div className="setting-row">
        <span className="small">Real-time updates</span>
        <Pill colour="lavender">Coming soon</Pill>
      </div>
    </Dialog>
  )
}
