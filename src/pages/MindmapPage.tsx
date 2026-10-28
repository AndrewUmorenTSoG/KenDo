import { PageHeading } from '../components/bits'
import Icon from '../components/Icon'
import { createProject, nextColour } from '../data/projects'
import { useStore } from '../data/store'
import { useUI } from '../hooks/useUI'

export default function MindmapPage() {
  const { uid, tasks, projects } = useStore()
  const { open, close, toast } = useUI()

  return (
    <>
      <PageHeading
        eyebrow="MIND MAP"
        title="See the bigger picture."
        sub="Your projects and tasks, with a little room to connect the dots."
        actions={
          <button
            className="btn primary"
            onClick={() =>
              open({
                kind: 'prompt',
                title: 'Make room for a new project.',
                label: 'Project name',
                onSubmit: (name) => {
                  createProject(uid, name, nextColour(projects))
                  close()
                  toast('Your project is ready.')
                },
              })
            }
          >
            <Icon name="plus" />
            New project
          </button>
        }
      />
      <section className="panel mindmap">
        <div className="map-root">My intentional life</div>
        <div
          className="map-branches"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(projects.length, 4))},minmax(140px,1fr))` }}
        >
          {projects.map((p) => (
            <div key={p.id} className="map-branch">
              <h3>{p.name}</h3>
              {tasks
                .filter((t) => t.projectId === p.id && t.status !== 'done')
                .map((t) => (
                  <button key={t.id} className="map-leaf" onClick={() => open({ kind: 'task', id: t.id })}>
                    {t.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
