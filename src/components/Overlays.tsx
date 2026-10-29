import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  applyTemplate,
  inviteLink,
  leaveProject,
  newInviteLink,
  removeMember,
  startSharing,
  stopSharing,
  templates,
  templateSummaries,
} from '../data/projects'
import { useStore } from '../data/store'
import { priorityRank, snoozeTask } from '../data/tasks'
import { useUI, type Overlay } from '../hooks/useUI'
import { fmt, todayKey } from '../lib/dates'
import { Pill } from './bits'
import { initials } from './Layout'
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
      return <ShareProject projectId={overlay.projectId} />
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
      <TaskList tasks={today} />
      <div className="notice" style={{ marginTop: 18 }}>
        {today.reduce((n, t) => n + t.estimate, 0)} minutes planned
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

function ShareProject({ projectId }: { projectId?: string }) {
  const { uid, projects, tasks, profile } = useStore()
  const { open, close, toast } = useUI()
  const navigate = useNavigate()
  const [chosen, setChosen] = useState(projectId ?? projects.find((p) => p.shared)?.id ?? projects[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const project = projects.find((p) => p.id === chosen)
  const isOwner = project?.uid === uid
  const link = project?.shared && project.inviteCode ? inviteLink(project) : ''
  const members = project?.members ?? []

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await action()
      toast(done)
    } catch {
      toast('That didn’t go through. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    await navigator.clipboard?.writeText(link)
    toast('Invite link copied.')
  }

  return (
    <Dialog title="A shared list, thoughtfully simple." onClose={close}>
      <div className="field">
        <label htmlFor="share-project">Project</label>
        <select id="share-project" value={chosen} onChange={(e) => setChosen(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.shared ? ' · shared' : ''}
            </option>
          ))}
        </select>
      </div>

      {project && !project.shared && (
        <>
          <div className="notice">Nobody else can see “{project.name}” yet.</div>
          <div className="dialog-footer">
            <span />
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => run(() => startSharing(uid, profile.name, project, tasks), 'Sharing is on. Send the link below.')}
            >
              <Icon name="team" />
              Share this project
            </button>
          </div>
        </>
      )}

      {project?.shared && (
        <>
          {isOwner && (
            <div className="share-link">
              <h3>Invite people</h3>
              <p className="tiny muted">Anyone with this link can join.</p>
              <div className="row">
                <input aria-label="Invite link" value={link} readOnly onFocus={(e) => e.target.select()} />
                <button className="btn" onClick={copy}>
                  <Icon name="link" />
                  Copy
                </button>
                {'share' in navigator && (
                  <button
                    className="btn primary"
                    onClick={() =>
                      navigator.share({ title: `Join “${project.name}” on KenDo`, url: link }).catch(() => undefined)
                    }
                  >
                    Share
                  </button>
                )}
              </div>
              <button
                className="text-btn"
                disabled={busy}
                onClick={() => run(() => newInviteLink(uid, project), 'New link ready. The old one no longer works.')}
              >
                Make a new link
              </button>
            </div>
          )}

          <h3 style={{ marginTop: 18 }}>People</h3>
          {members.map((m) => {
            const name = project.memberNames?.[m] ?? 'Someone'
            return (
              <div key={m} className="member">
                <span className="avatar">{initials(name)}</span>
                <div>
                  {name}
                  {m === uid ? ' · You' : ''}
                  <p className="tiny muted">{m === project.uid ? 'Owner' : 'Member'} · Can edit</p>
                </div>
                {isOwner && m !== uid && (
                  <button
                    className="text-btn"
                    disabled={busy}
                    onClick={() => run(() => removeMember(project, m), `${name} has been removed.`)}
                  >
                    Remove
                  </button>
                )}
                {!isOwner && m === uid && (
                  <button
                    className="text-btn"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await leaveProject(uid, project)
                        close()
                        navigate('/projects')
                      }, `You’ve left “${project.name}”.`)
                    }
                  >
                    Leave
                  </button>
                )}
              </div>
            )
          })}
          {members.length < 2 && isOwner && <p className="tiny muted">Nobody has joined yet.</p>}
          <div className="setting-row">
            <span className="small">Live updates</span>
            <Pill colour="sage">On</Pill>
          </div>
          {isOwner && (
            <button
              className="text-btn"
              style={{ color: 'var(--rose)' }}
              onClick={() =>
                open({
                  kind: 'confirm',
                  title: `Stop sharing “${project.name}”?`,
                  text: 'Everyone else loses access straight away. All the tasks, including ones others added, stay with you.',
                  onConfirm: () =>
                    stopSharing(uid, project, tasks)
                      .then(() => toast('Only you can see this project now.'))
                      .catch(() => toast('That didn’t go through. Try again.')),
                })
              }
            >
              Stop sharing
            </button>
          )}
        </>
      )}
    </Dialog>
  )
}
