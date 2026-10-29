import { signOut } from 'firebase/auth'
import { useState } from 'react'
import { PageHeading, Pill } from '../components/bits'
import Icon from '../components/Icon'
import { updateProfile, useStore } from '../data/store'
import { useAuth } from '../hooks/useAuth'
import { useUI } from '../hooks/useUI'
import { exportData } from '../lib/exportData'
import { feedUrl, googleSubscribe, newFeedToken, outlookSubscribe } from '../lib/calendarLinks'
import { auth } from '../lib/firebase'
import { enableNotifications } from '../lib/notifications'
import { themes } from '../lib/themes'
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

  const toggle = (label: string, key: keyof Pick<Profile, 'dark' | 'celebrations' | 'verses' | 'nudges'>) => (
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
      <PageHeading eyebrow="SETTINGS" title="Make yourself at home." />
      <div className="settings-grid">
        <div className="stack">
          <section className="panel">
            <h2>Your space, your way</h2>
            <div className="setting-row">
              <div>
                <h3>Your name</h3>
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
              </div>
              {toggle('Dark mode', 'dark')}
            </div>
            <div className="setting-row">
              <div>
                <h3>Completion celebrations</h3>
              </div>
              {toggle('Completion celebrations', 'celebrations')}
            </div>
            <div className="setting-row">
              <div>
                <h3>Bible verses</h3>
              </div>
              {toggle('Bible verses', 'verses')}
            </div>
            <div className="setting-row">
              <div>
                <h3>Encouraging nudges</h3>
              </div>
              {toggle('Encouraging nudges', 'nudges')}
            </div>
            <div className="setting-row">
              <div>
                <h3>Reminders on this device</h3>
                {pushStatus && <p>{pushStatus}</p>}
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
            <div className="theme-setting">
              <h3>Colour theme</h3>
              <div className="theme-grid" role="radiogroup" aria-label="Colour theme">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={profile.theme === t.id}
                    className={`theme-option ${profile.theme === t.id ? 'active' : ''}`}
                    onClick={() => updateProfile(uid, { theme: t.id })}
                  >
                    <span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }} />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="panel">
            <h2>Your data belongs to you</h2>
            <div className="setting-row">
              <div>
                <h3>Synced & offline</h3>
              </div>
              <Pill colour="sage">On</Pill>
            </div>
            <div className="setting-row">
              <div>
                <h3>Take your work with you</h3>
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
            <CalendarFeed />
          </section>
          <section className="panel">
            <h2>Install KenDo</h2>
            <p className="small muted" style={{ margin: '14px 0' }}>
              On a computer, use the install icon in Chrome or Edge’s address bar. On Android, open the browser menu and
              choose Install app. On iPhone, tap Share, then Add to Home Screen.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}

function CalendarFeed() {
  const { uid, profile } = useStore()
  const { open, toast } = useUI()
  const url = profile.calendarToken ? feedUrl(uid, profile.calendarToken) : ''

  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => undefined)
    toast('Calendar link copied.')
  }

  if (!url)
    return (
      <div className="setting-row">
        <div className="row">
          <Icon name="calendar" />
          <h3 className="small">Google Calendar & Outlook</h3>
        </div>
        <button className="btn primary" onClick={() => updateProfile(uid, { calendarToken: newFeedToken() })}>
          Connect
        </button>
      </div>
    )

  return (
    <div className="share-link">
      <div className="row">
        <a className="btn" href={googleSubscribe(url)} target="_blank" rel="noreferrer">
          <Icon name="calendar" />
          Add to Google
        </a>
        <a className="btn" href={outlookSubscribe(url)} target="_blank" rel="noreferrer">
          <Icon name="calendar" />
          Add to Outlook
        </a>
      </div>
      <div className="row">
        <input aria-label="Calendar link" value={url} readOnly onFocus={(e) => e.target.select()} />
        <button className="btn" onClick={copy}>
          <Icon name="link" />
          Copy
        </button>
      </div>
      <button
        className="text-btn"
        onClick={() =>
          open({
            kind: 'confirm',
            title: 'Disconnect calendars?',
            text: 'The current link stops working. Calendars you added it to stop updating.',
            onConfirm: () => {
              updateProfile(uid, { calendarToken: '' })
              toast('Calendar link turned off.')
            },
          })
        }
      >
        Disconnect
      </button>
    </div>
  )
}
