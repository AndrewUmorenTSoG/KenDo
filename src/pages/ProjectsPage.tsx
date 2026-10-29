import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IconButton, PageHeading, Pill, ProjectPill } from '../components/bits'
import Icon from '../components/Icon'
import { createProject, nextColour } from '../data/projects'
import { useStore } from '../data/store'
import { colourProps, priorityLabel, priorityPill, statusLabel } from '../data/tasks'
import { useTaskActions } from '../hooks/useTaskActions'
import { useUI } from '../hooks/useUI'
import { fmt, plural } from '../lib/dates'
import type { Status, Task } from '../lib/types'

const columns: Status[] = ['todo', 'doing', 'done']

export default function ProjectsPage() {
  const { uid, tasks, projects } = useStore()
  const { open, close, toast } = useUI()
  const { move } = useTaskActions()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const filter = params.get('project') ?? 'all'
  const [dragOver, setDragOver] = useState<Status | null>(null)
  const list = tasks.filter((t) => filter === 'all' || t.projectId === filter)
  const current = projects.find((p) => p.id === filter)
  const projectOf = (t: Task) => projects.find((p) => p.id === t.projectId)
  const projectDefault = filter === 'all' ? undefined : filter

  function newProject() {
    open({
      kind: 'prompt',
      title: 'Make room for a new project.',
      label: 'Project name',
      onSubmit: async (name) => {
        if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) return toast('That project already has a home.')
        close()
        const ref = await createProject(uid, name, nextColour(projects))
        navigate(`/projects?project=${ref.id}`)
        toast('Your project is ready.')
      },
    })
  }

  return (
    <>
      <PageHeading
        eyebrow="PROJECTS"
        title="Room for your big ideas."
        actions={
          <>
            <button className="btn" onClick={() => open({ kind: 'templates' })}>
              <Icon name="note" />
              Use a template
            </button>
            <button className="btn primary" onClick={newProject}>
              <Icon name="plus" />
              New project
            </button>
          </>
        }
      />
      <div className="project-strip">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => navigate('/projects')}>
          All projects
        </button>
        {projects.map((p) => (
          <button key={p.id} className={filter === p.id ? 'active' : ''} onClick={() => navigate(`/projects?project=${p.id}`)}>
            {p.name}
            {p.shared && <Icon name="team" />}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <span />
        <div className="row">
          {current && (
            <button className="btn" onClick={() => open({ kind: 'shared', projectId: current.id })}>
              <Icon name="team" />
              {current.shared ? `Shared · ${plural(current.members?.length ?? 1, 'person', 'people')}` : 'Share'}
            </button>
          )}
          <button className="btn" onClick={() => open({ kind: 'task', id: null, defaults: { projectId: projectDefault } })}>
            <Icon name="plus" />
            Add task
          </button>
        </div>
      </div>
      <div className="board">
        {columns.map((status) => {
          const column = list.filter((t) => t.status === status)
          return (
            <section
              key={status}
              className={`board-column ${status} ${dragOver === status ? 'drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(status)
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={async (e) => {
                e.preventDefault()
                setDragOver(null)
                const task = tasks.find((t) => t.id === e.dataTransfer.getData('text/plain'))
                if (task && (await move(task, status))) toast('Plan updated.')
              }}
            >
              <div className="board-heading">
                <h3>
                  <span className="dot" /> {statusLabel[status]}{' '}
                  <span className="muted tiny">{column.length}</span>
                </h3>
                <IconButton
                  label={`Add ${statusLabel[status]} task`}
                  icon="plus"
                  onClick={() => open({ kind: 'task', id: null, defaults: { status, projectId: projectDefault } })}
                />
              </div>
              {column.map((t) => (
                <article
                  key={t.id}
                  className={`board-card ${colourProps(t).className}`}
                  style={colourProps(t).style}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', t.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                >
                  <button className="card-open" onClick={() => open({ kind: 'task', id: t.id })}>
                    <Pill colour={priorityPill[t.priority]}>{priorityLabel[t.priority]}</Pill>
                    <h3>{t.title}</h3>
                    <ProjectPill project={projects.find((p) => p.id === t.projectId)} />
                    <div className="task-meta">
                      <span>
                        <Icon name="clock" /> {t.estimate} min
                      </span>
                      <span>{t.date ? fmt(t.date) : 'Someday'}</span>
                      {t.uid !== uid && projectOf(t)?.shared && <span>by {projectOf(t)?.memberNames?.[t.uid] ?? 'someone'}</span>}
                      {t.subtasks.length > 0 && (
                        <span>
                          {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length} steps
                        </span>
                      )}
                    </div>
                  </button>
                </article>
              ))}
              {!column.length && <div className="empty tiny">A little room to make progress.</div>}
            </section>
          )
        })}
      </div>
    </>
  )
}
