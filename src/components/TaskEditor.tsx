import { useState, type FormEvent } from 'react'
import { useStore } from '../data/store'
import { createTask, deleteTask, dependsOnChain, setStatus, updateTask } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { todayKey } from '../lib/dates'
import type { Comment, Energy, NewTask, Priority, Repeat, Status, Subtask } from '../lib/types'
import Dialog from './Dialog'
import Icon from './Icon'

interface Props {
  id: string | null
  defaults?: Partial<NewTask>
}

export default function TaskEditor({ id, defaults }: Props) {
  const { uid, tasks, notes, projects, profile } = useStore()
  const { close, open, toast } = useUI()
  const original = id ? tasks.find((t) => t.id === id) : undefined
  const personal = projects.find((p) => p.name === 'Personal') ?? projects[0]

  const [title, setTitle] = useState(original?.title ?? defaults?.title ?? '')
  const [description, setDescription] = useState(original?.description ?? '')
  const [projectId, setProjectId] = useState(original?.projectId ?? defaults?.projectId ?? personal?.id ?? '')
  const [priority, setPriority] = useState<Priority>(original?.priority ?? 'medium')
  const [date, setDate] = useState(original?.date ?? defaults?.date ?? todayKey())
  const [time, setTime] = useState(original?.time ?? defaults?.time ?? '')
  const [estimate, setEstimate] = useState(String(original?.estimate ?? 25))
  const [repeat, setRepeat] = useState<Repeat>(original?.repeat ?? 'never')
  const [status, setStatusValue] = useState<Status>(original?.status ?? defaults?.status ?? 'todo')
  const [energy, setEnergy] = useState<Energy>(original?.energy ?? 'low')
  const [dependsOn, setDependsOn] = useState(original?.dependsOn ?? '')
  const [noteId, setNoteId] = useState(original?.noteId ?? '')
  const [tags, setTags] = useState(original?.tags.join(', ') ?? '')
  const [important, setImportant] = useState(original?.important ?? false)
  const [reminder, setReminder] = useState(original?.reminder ?? false)
  const [subtasks, setSubtasks] = useState<Subtask[]>(original?.subtasks ?? [])
  const [comments, setComments] = useState<Comment[]>(original?.comments ?? [])
  const [newSubtask, setNewSubtask] = useState('')
  const [newComment, setNewComment] = useState('')

  if (id && !original) return null

  // A task can't depend on itself or on anything that already depends on it.
  const dependencyOptions = tasks.filter(
    (t) => t.id !== id && t.status !== 'done' && !(id && dependsOnChain(t, id, tasks)),
  )

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (reminder && (!date || !time)) return toast('Give the reminder a date and time.')
    if (repeat !== 'never' && !date) return toast('Choose a date for this repeating task.')

    const fields = {
      title: title.trim(),
      description,
      projectId: projectId || null,
      priority,
      date,
      time,
      estimate: Math.max(1, Number(estimate) || 25),
      repeat,
      energy,
      dependsOn: dependsOn || null,
      noteId: noteId || null,
      tags: tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      important,
      reminder,
      subtasks,
      comments,
    }

    if (original) {
      if (status !== original.status) {
        // Check the prerequisite against the dependency being saved, not the old one.
        const next = { ...original, ...fields }
        if ((await setStatus(uid, next, status, tasks)) === 'blocked') return toast('Finish the prerequisite task first.')
      }
      updateTask(uid, original, fields)
    } else {
      const blocked = fields.dependsOn && tasks.some((t) => t.id === fields.dependsOn && t.status !== 'done')
      if (status !== 'todo' && blocked) return toast('Finish the prerequisite task first.')
      createTask(uid, { ...fields, status, completedOn: status === 'done' ? todayKey() : null })
    }
    close()
    toast('A little intention, saved.')
  }

  function addSubtask() {
    if (!newSubtask.trim()) return
    setSubtasks([...subtasks, { title: newSubtask.trim(), done: false }])
    setNewSubtask('')
  }

  function addComment() {
    if (!newComment.trim()) return
    setComments([...comments, { author: profile.name || 'You', text: newComment.trim(), at: Date.now() }])
    setNewComment('')
  }

  const enterAdds = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      fn()
    }
  }

  return (
    <Dialog title={original ? 'A little more detail.' : 'Make a little intention.'} onClose={close}>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="f-title">Task title</label>
          <input
            id="f-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={180}
            placeholder="What’s on your mind?"
          />
        </div>
        <div className="field">
          <label htmlFor="f-description">Notes</label>
          <textarea
            id="f-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            placeholder="A little context…"
          />
        </div>
        <div className="form-grid">
          <Select label="Project / life area" id="project" value={projectId} onChange={setProjectId}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select label="Priority" id="priority" value={priority} onChange={(v) => setPriority(v as Priority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <div className="field">
            <label htmlFor="f-date">Due date</label>
            <input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-time">Time</label>
            <input id="f-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-estimate">Time estimate (minutes)</label>
            <input
              id="f-estimate"
              type="number"
              min={1}
              max={1440}
              required
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </div>
          <Select label="Repeat" id="repeat" value={repeat} onChange={(v) => setRepeat(v as Repeat)}>
            <option value="never">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
          <Select label="Status" id="status" value={status} onChange={(v) => setStatusValue(v as Status)}>
            <option value="todo">To do</option>
            <option value="doing">Doing</option>
            <option value="done">Done</option>
          </Select>
          <Select label="Energy" id="energy" value={energy} onChange={(v) => setEnergy(v as Energy)}>
            <option value="low">Low</option>
            <option value="high">High</option>
          </Select>
          <Select label="Depends on" id="dependency" value={dependsOn} onChange={setDependsOn}>
            <option value="">No dependency</option>
            {dependencyOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
          <Select label="Attached note" id="note" value={noteId} onChange={setNoteId}>
            <option value="">No note</option>
            {notes
              .filter((n) => !n.archived || n.id === noteId)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title || 'Untitled note'}
                </option>
              ))}
          </Select>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="f-tags">Tags, separated by commas</label>
            <input id="f-tags" value={tags} onChange={(e) => setTags(e.target.value)} maxLength={200} />
          </div>
        </div>
        <label className="subtask">
          <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} /> Important to me
          (priority matrix)
        </label>
        <label className="subtask">
          <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /> Send me a reminder at
          the scheduled time
        </label>
        {noteId && (
          <button type="button" className="text-btn" onClick={() => open({ kind: 'note', id: noteId })}>
            Open attached note ↗
          </button>
        )}

        <div className="divider" />
        <h3>Little steps</h3>
        <div>
          {subtasks.map((s, i) => (
            <label key={i} className="subtask">
              <input
                type="checkbox"
                checked={s.done}
                onChange={(e) => setSubtasks(subtasks.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))}
              />
              {s.title}
            </label>
          ))}
        </div>
        <div className="quick-add">
          <input
            aria-label="New subtask"
            placeholder="Add a smaller step"
            maxLength={180}
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={enterAdds(addSubtask)}
          />
          <button type="button" className="text-btn" onClick={addSubtask}>
            Add
          </button>
        </div>

        <div className="divider" />
        <h3>Comments</h3>
        <div>
          {comments.map((c, i) => (
            <div key={i} className="comment">
              <strong>{c.author}</strong>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
        <div className="quick-add">
          <input
            aria-label="New comment"
            placeholder="Leave a note for future you"
            maxLength={1000}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={enterAdds(addComment)}
          />
          <button type="button" className="text-btn" onClick={addComment}>
            Add
          </button>
        </div>

        {original && original.activity.length > 0 && (
          <details style={{ marginTop: 20 }}>
            <summary className="tiny muted">Activity history</summary>
            {original.activity.map((a, i) => (
              <div key={i} className="history-entry">
                {a}
              </div>
            ))}
          </details>
        )}

        <div className="dialog-footer">
          {original ? (
            <button
              type="button"
              className="btn danger"
              onClick={() =>
                open({
                  kind: 'confirm',
                  title: 'Let this task go?',
                  text: 'The task and its comments will be removed from all your devices.',
                  onConfirm: () => {
                    deleteTask(uid, original, tasks)
                    toast('Task deleted.')
                  },
                })
              }
            >
              <Icon name="trash" />
              Delete task
            </button>
          ) : (
            <span />
          )}
          <div className="row">
            <button type="button" className="btn" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Save task
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}

function Select({
  label,
  id,
  value,
  onChange,
  children,
}: {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <label htmlFor={`f-${id}`}>{label}</label>
      <select id={`f-${id}`} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  )
}

