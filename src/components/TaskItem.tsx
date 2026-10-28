import { format, isPast } from 'date-fns'
import { deleteTask, isBlocked, toggleTask } from '../data/tasks'
import { useUid } from '../hooks/useAuth'
import { describeRecurrence } from '../lib/recurrence'
import type { Task } from '../lib/types'

interface Props {
  task: Task
  all: Task[]
  onEdit?: (task: Task) => void
}

export default function TaskItem({ task, all, onEdit }: Props) {
  const uid = useUid()
  const blocked = isBlocked(task, all)
  const doneSubtasks = task.subtasks.filter((s) => s.done).length

  return (
    <li className={`task ${task.done ? 'done' : ''}`}>
      <input
        type="checkbox"
        checked={task.done}
        disabled={blocked && !task.done}
        onChange={() => toggleTask(uid, task)}
        aria-label={`Complete ${task.title}`}
      />
      <button className="task-main" onClick={() => onEdit?.(task)}>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          <span className={`pill priority-${task.priority}`}>{task.priority}</span>
          {task.dueAt && (
            <span className={`pill ${!task.done && isPast(task.dueAt) ? 'overdue' : ''}`}>
              {format(task.dueAt, 'EEE d MMM, HH:mm')}
            </span>
          )}
          {task.recurrence && <span className="pill">{describeRecurrence(task.recurrence)}</span>}
          {task.estimateMinutes && <span className="pill">{task.estimateMinutes} min</span>}
          {task.subtasks.length > 0 && (
            <span className="pill">
              {doneSubtasks}/{task.subtasks.length}
            </span>
          )}
          {blocked && <span className="pill">Waiting on another task</span>}
          {task.tags.map((t) => (
            <span key={t} className="pill tag">
              #{t}
            </span>
          ))}
        </span>
      </button>
      <button className="icon-btn" onClick={() => deleteTask(uid, task.id)} aria-label={`Delete ${task.title}`}>
        ×
      </button>
    </li>
  )
}
