import { useEffect, useState } from 'react'
import { PageHeading } from '../components/bits'
import Icon from '../components/Icon'
import { createProject, nextColour } from '../data/projects'
import { updateProfile, useStore } from '../data/store'
import { useUI } from '../hooks/useUI'

export default function MindmapPage() {
  const { uid, tasks, projects, profile } = useStore()
  const { open, close, toast } = useUI()
  const defaultName = profile.name ? `${profile.name}’s Mind Map` : 'My Mind Map'
  const [title, setTitle] = useState(profile.mindmapName || defaultName)
  // Follow the saved name when it arrives or changes on another device.
  useEffect(() => setTitle(profile.mindmapName || defaultName), [profile.mindmapName, defaultName])

  return (
    <>
      <PageHeading
        eyebrow="MIND MAP"
        title="See the bigger picture."
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
        <div className="map-root">
          <input
            aria-label="Mind map name"
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => updateProfile(uid, { mindmapName: title.trim() || defaultName })}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </div>
        <div
          className="map-branches"
          style={{
            gridTemplateColumns:
              projects.length <= 6
                ? `repeat(${Math.max(1, projects.length)}, minmax(0, 1fr))`
                : 'repeat(auto-fit, minmax(140px, 1fr))',
          }}
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
