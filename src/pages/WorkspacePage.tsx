import { useNavigate } from 'react-router-dom'
import { initials } from '../components/Layout'
import { PageHeading, Pill } from '../components/bits'
import Icon from '../components/Icon'
import { plural } from '../lib/dates'
import { useStore } from '../data/store'
import { useAuth } from '../hooks/useAuth'
import { useUI } from '../hooks/useUI'

export default function WorkspacePage() {
  const { uid, tasks, projects, profile } = useStore()
  const { user } = useAuth()
  const { open } = useUI()
  const navigate = useNavigate()
  const shared = projects.filter((p) => p.shared)
  // Everyone you share at least one project with.
  const people = new Map<string, string>()
  for (const p of shared) for (const m of p.members ?? []) if (m !== uid) people.set(m, p.memberNames?.[m] ?? 'Someone')
  const sharedIds = new Set(shared.map((p) => p.id))
  const recent = [...tasks]
    .filter((t) => t.activity.length)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8)

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE"
        title="Good things, together."
        actions={
          <button className="btn primary" onClick={() => open({ kind: 'shared' })}>
            <Icon name="team" />
            Share a project
          </button>
        }
      />
      <div className="settings-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel-title">
              <h2>Your people</h2>
              <Pill colour="pink">{people.size ? `${people.size + 1} people` : 'Personal workspace'}</Pill>
            </div>
            <div className="member">
              <span className="avatar">{initials(profile.name, user?.email)}</span>
              <div>
                <h3>{profile.name || 'You'} · You</h3>
                <p className="tiny muted">{user?.email}</p>
              </div>
            </div>
            {[...people].map(([id, name]) => (
              <div key={id} className="member">
                <span className="avatar">{initials(name)}</span>
                <div>
                  <h3>{name}</h3>
                  <p className="tiny muted">
                    {shared
                      .filter((p) => p.members?.includes(id))
                      .map((p) => p.name)
                      .join(' · ')}
                  </p>
                </div>
              </div>
            ))}
            {!people.size && (
              <div className="empty">
                <Icon name="team" />
                <p>A space to build together.</p>
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Shared projects</h2>
            {shared.map((p) => (
              <div key={p.id} className="member">
                <span className={`dot ${p.colour}`} />
                <div>
                  <h3>{p.name}</h3>
                  <p className="tiny muted">
                    {p.uid === uid ? 'You own this' : `Shared by ${p.memberNames?.[p.uid] ?? 'someone'}`} ·{' '}
                    {plural(tasks.filter((t) => t.projectId === p.id && t.status !== 'done').length, 'open task')}
                  </p>
                </div>
                <button className="text-btn" onClick={() => navigate(`/projects?project=${p.id}`)}>
                  Open
                </button>
                <button className="text-btn" onClick={() => open({ kind: 'shared', projectId: p.id })}>
                  Manage
                </button>
              </div>
            ))}
            {!shared.length && <p className="tiny muted">Nothing shared yet.</p>}
          </section>
        </div>
        <section className="panel">
          <h2>Recent activity</h2>
          {recent.map((t) => (
            <div key={t.id} className="history-entry">
              <strong>{t.title}</strong>
              {sharedIds.has(t.projectId ?? '') && <Pill colour="lavender">Shared</Pill>}
              <br />
              {t.activity.at(-1)}
            </div>
          ))}
          {!recent.length && <p className="tiny muted">Your activity will show up here.</p>}
        </section>
      </div>
    </>
  )
}
