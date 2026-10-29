import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { colourProps, isBlocked, priorityLabel, priorityPill } from '../data/tasks'
import { useFocusTimer } from '../hooks/useFocusTimer'
import { useTaskActions } from '../hooks/useTaskActions'
import { useUI } from '../hooks/useUI'
import type { Task } from '../lib/types'
import { Empty, IconButton, Pill, ProjectPill } from './bits'
import Icon from './Icon'

export function TaskRow({ task }: { task: Task }) {
  const { tasks, projects } = useStore()
  const { open, toast } = useUI()
  const { complete, celebrating } = useTaskActions()
  const timer = useFocusTimer()
  const navigate = useNavigate()
  const done = task.status === 'done'
  const blocked = isBlocked(task, tasks)
  const doneSteps = task.subtasks.filter((s) => s.done).length
  const colour = colourProps(task)

  function focusOn() {
    if (timer.running) toast('Pause your current focus session before changing tasks.')
    else timer.setTaskId(task.id)
    navigate('/focus')
  }

  return (
    <div className={`task-row ${done ? 'completed' : ''} ${colour.className}`} style={colour.style}>
      <button
        className={`task-check ${done ? 'done' : task.priority} ${celebrating === task.id ? 'celebrate' : ''}`}
        onClick={() => complete(task)}
        aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`}
        aria-pressed={done}
      >
        {done && <Icon name="check" />}
      </button>
      <div className="task-body">
        <button className="task-name" onClick={() => open({ kind: 'task', id: task.id })}>
          {task.title}
        </button>
        <div className="task-meta">
          <ProjectPill project={projects.find((p) => p.id === task.projectId)} />
          <span className="row">
            <Icon name="clock" />
            {task.estimate} min
          </span>
          {task.time && <span>{task.time}</span>}
          {task.repeat !== 'never' && <Icon name="repeat" />}
          {blocked && (
            <span className="row">
              <Icon name="link" />
              Blocked
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span>
              {doneSteps}/{task.subtasks.length}
            </span>
          )}
        </div>
      </div>
      <div className="task-trailing">
        {!done && <Pill colour={priorityPill[task.priority]}>{priorityLabel[task.priority]}</Pill>}
        <IconButton label="Focus on this task" icon="play" onClick={focusOn} />
      </div>
    </div>
  )
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <Empty />
  return (
    <>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} />
      ))}
    </>
  )
}
