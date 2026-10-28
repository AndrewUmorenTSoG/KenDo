import { signOut } from 'firebase/auth'
import { useState } from 'react'
import { PageHeading, Pill } from '../components/bits'
import Icon from '../components/Icon'
import { updateProfile, useStore } from '../data/store'
import { useAuth } from '../hooks/useAuth'
import { useUI } from '../hooks/useUI'
import { exportData } from '../lib/exportData'
import { auth } from '../lib/firebase'
import { enableNotifications } from '../lib/notifications'
import type { Profile } from '../lib/types'

const pushMessages = {
  granted: 'Reminders are on for this device.',
  denied: 'Notifications are blocked. Allow them for KenDo in your browser or phone settings.',
  unsupported: 'This browser can’t receive notifications. On iPhone, add KenDo to your Home Screen first.',
}

export default function SettingsPage() {
  const { uid, profile, projects, tasks, notes, habits, sessions } = useStore()
  const { user } = useAuth()
  const { toast } = useUI()
  const [name, setName] = useState(profile.name)
  const [pushStatus, setPushStatus] = useState(
    'Notification' in window && Notification.permission === 'granted' ? pushMessages.granted : '',
  )

  const toggle = (label: string, key: keyof Pick<Profile, 'dark' | 'celebrations' | 'verses'>) => (
    <button
      role="switch"
      aria-checked={profile[key]}
      aria-label={label}
      className={`toggle ${profile[key] ? 'on' : ''}`}
      onClick={() => updateProfile(uid, { [key]: !profile[key] })}
    />
  )

  return (
    <>
      <PageHeading eyebrow="SETTINGS" title="Make yourself at home." sub="A few little preferences to make KenDo feel like you." />
      <div className="settings-grid">
        <div className="stack">
          <section className="panel">
            <h2>Your space, your way</h2>
            <div className="setting-row">
              <div>
                <h3>Your name</h3>
                <p>Used in your greeting each morning.</p>
              </div>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault()
                  updateProfile(uid, { name: name.trim() })
                  toast('Nice to meet you.')
                }}
              >
                <input aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
                <button className="btn" type="submit">
                  Save
                </button>
              </form>
            </div>
            <div className="setting-row">
              <div>
                <h3>Dark mode</h3>
                <p>A softer glow for quieter hours.</p>
              </div>
              {toggle('Dark mode', 'dark')}
            </div>
            <div className="setting-row">
              <div>
                <h3>Completion celebrations</h3>
                <p>A little acknowledgement of every win.</p>
              </div>
              {toggle('Completion celebrations', 'celebrations')}
            </div>
            <div className="setting-row">
              <div>
                <h3>Bible verses</h3>
                <p>An encouraging verse each day, and a fresh one for every focus session.</p>
              </div>
              {toggle('Bible verses', 'verses')}
            </div>
            <div className="setting-row">
              <div>
                <h3>Reminders on this device</h3>
                <p>{pushStatus || 'Get a notification when a task’s reminder is due, even when KenDo is closed.'}</p>
              </div>
              <button
                className="btn"
                onClick={async () =>
                  setPushStatus(pushMessages[await enableNotifications(uid).catch(() => 'unsupported' as const)])
                }
              >
                <Icon name="bell" />
                Turn on
              </button>
            </div>
            <div className="setting-row">
              <div>
                <h3>Your palette</h3>
                <p>Blush pink · deep plum · warm ivory · sage</p>
              </div>
              <div className="row" aria-label="Pink, plum and sage palette">
                <i className="colour-swatch" style={{ background: '#efb7cd' }} />
                <i className="colour-swatch" style={{ background: '#482b42' }} />
                <i className="colour-swatch" style={{ background: '#e7f0e8' }} />
              </div>
            </div>
          </section>
          <section className="panel">
            <h2>Your data belongs to you</h2>
            <div className="setting-row">
              <div>
                <h3>Synced & offline</h3>
                <p>Saved to your account and kept on this device, so KenDo works without a connection.</p>
              </div>
              <Pill colour="sage">On</Pill>
            </div>
            <div className="setting-row">
              <div>
                <h3>Take your work with you</h3>
                <p>Download your workspace as a JSON backup.</p>
              </div>
              <button
                className="btn"
                onClick={() => {
                  exportData({ profile, projects, tasks, notes, habits, sessions })
                  toast('Your workspace backup is ready.')
                }}
              >
                <Icon name="download" />
                Export
              </button>
            </div>
            <div className="setting-row">
              <div>
                <h3>Signed in</h3>
                <p>{user?.email}</p>
              </div>
              <button className="btn danger" onClick={() => signOut(auth)}>
                Sign out
              </button>
            </div>
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <h2>Connected calendars</h2>
            <p className="muted tiny" style={{ marginTop: 10 }}>
              Calendar connections are coming soon. No accounts are connected.
            </p>
            {['Google Calendar', 'Outlook Calendar'].map((name) => (
              <IntegrationRow key={name} name={name} />
            ))}
          </section>
          <section className="panel">
            <h2>Install KenDo</h2>
            <p className="small muted" style={{ margin: '14px 0' }}>
              On a computer, use the install icon in Chrome or Edge’s address bar. On Android, open the browser menu and
              choose Install app. On iPhone, tap Share, then Add to Home Screen.
            </p>
            <p className="tiny muted">Voice input, home screen widgets and AI suggestions are on the way.</p>
          </section>
        </div>
      </div>
    </>
  )
}

function IntegrationRow({ name }: { name: string }) {
  const { open } = useUI()
  return (
    <div className="setting-row">
      <div className="row">
        <Icon name="calendar" />
        <h3 className="small">{name}</h3>
      </div>
      <button className="btn" onClick={() => open({ kind: 'integration', name })}>
        Preview
      </button>
    </div>
  )
}
