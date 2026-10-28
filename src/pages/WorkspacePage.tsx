import { initials } from '../components/Layout'
import { PageHeading, Pill } from '../components/bits'
import Icon from '../components/Icon'
import { useStore } from '../data/store'
import { useAuth } from '../hooks/useAuth'
import { useUI } from '../hooks/useUI'

export default function WorkspacePage() {
  const { tasks, profile } = useStore()
  const { user } = useAuth()
  const { open } = useUI()
  const recent = [...tasks]
    .filter((t) => t.activity.length)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8)

  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE"
        title="Good things, together."
        sub="Shared lists are on the way. For now, this is your personal space."
        actions={
          <button className="btn primary" onClick={() => open({ kind: 'shared' })}>
            <Icon name="team" />
            Shared list preview
          </button>
        }
      />
      <div className="notice">
        Coming soon · Sharing lists, assigning tasks to someone else and live updates between people are planned next.
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-title">
            <h2>Your people</h2>
            <Pill colour="pink">Personal workspace</Pill>
          </div>
          <div className="member">
            <span className="avatar">{initials(profile.name, user?.email)}</span>
            <div>
              <h3>{profile.name || 'You'} · You</h3>
              <p className="tiny muted">{user?.email}</p>
            </div>
            <Pill colour="sage">Owner</Pill>
          </div>
          <div className="empty">
            <Icon name="team" />
            <p>A space to build together.</p>
            <p className="tiny">Inviting people is coming soon.</p>
          </div>
        </section>
        <section className="panel">
          <h2>Recent activity</h2>
          {recent.map((t) => (
            <div key={t.id} className="history-entry">
              <strong>{t.title}</strong>
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
