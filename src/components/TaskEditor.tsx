import { format } from 'date-fns'
import { useState, type FormEvent } from 'react'
import { createTask, updateTask } from '../data/tasks'
import { useUid } from '../hooks/useAuth'
import type { Priority, RecurrenceFreq, Subtask, Task } from '../lib/types'

interface Props {
  task?: Task
  onClose: () => void
}

const toInput = (ms?: number | null) => (ms ? format(ms, "yyyy-MM-dd'T'HH:mm") : '')
const fromInput = (value: string) => (value ? new Date(value).getTime() : null)

export default function TaskEditor({ task, onClose }: Props) {
  const uid = useUid()
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [dueAt, setDueAt] = useState(toInput(task?.dueAt))
  const [remindAt, setRemindAt] = useState(toInput(task?.remindAt))
  const [repeat, setRepeat] = useState<RecurrenceFreq | ''>(task?.recurrence?.freq ?? '')
  const [estimate, setEstimate] = useState(task?.estimateMinutes?.toString() ?? '')
  const [tags, setTags] = useState(task?.tags.join(', ') ?? '')
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? [])
  const [newSubtask, setNewSubtask] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const changes = {
      title: title.trim(),
      notes,
      priority,
      dueAt: fromInput(dueAt),
      remindAt: fromInput(remindAt),
      recurrence: repeat ? { freq: repeat, interval: 1 } : null,
      estimateMinutes: estimate ? Number(estimate) : null,
      tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      subtasks,
    }
    // Firestore queues the write offline, so don't block closing on the server round trip.
    if (task) updateTask(uid, task.id, changes)
    else createTask(uid, changes)
    onClose()
  }

  function addSubtask() {
    if (!newSubtask.trim()) return
    setSubtasks([...subtasks, { id: crypto.randomUUID(), title: newSubtask.trim(), done: false }])
    setNewSubtask('')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal stack" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <h2>{task ? 'Edit task' : 'New task'}</h2>
        <input autoFocus placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        <div className="grid-2">
          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            Repeat
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as RecurrenceFreq | '')}>
              <option value="">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label>
            Due
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </label>
          <label>
            Remind me
            <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
          </label>
          <label>
            Estimate (minutes)
            <input type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          </label>
          <label>
            Tags
            <input placeholder="home, uni" value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
        </div>

        <fieldset className="stack">
          <legend>Subtasks</legend>
          {subtasks.map((s) => (
            <label key={s.id} className="row">
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => setSubtasks(subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
              />
              {s.title}
            </label>
          ))}
          <div className="row">
            <input
              placeholder="Add a subtask"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSubtask()
                }
              }}
            />
            <button type="button" className="btn" onClick={addSubtask}>
              Add
            </button>
          </div>
        </fieldset>

        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
