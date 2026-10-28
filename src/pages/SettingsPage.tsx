import { signOut } from 'firebase/auth'
import { useState } from 'react'
import { useAuth, useUid } from '../hooks/useAuth'
import { useTheme, type Theme } from '../hooks/useTheme'
import { auth } from '../lib/firebase'
import { enableNotifications } from '../lib/notifications'

const messages = {
  granted: 'Reminders are on for this device.',
  denied: 'Notifications are blocked. Allow them in your browser or system settings.',
  unsupported: 'This browser can’t receive notifications. On iPhone, add KenDo to your Home Screen first.',
}

export default function SettingsPage() {
  const uid = useUid()
  const { user } = useAuth()
  const [theme, setTheme] = useTheme()
  const [status, setStatus] = useState('')

  return (
    <section className="stack">
      <h1>Settings</h1>
      <p className="muted">Signed in as {user?.email}</p>

      <label>
        Theme
        <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          <option value="system">Match device</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <div className="stack">
        <h2>Reminders</h2>
        <button
          className="btn"
          onClick={async () => setStatus(messages[await enableNotifications(uid).catch(() => 'unsupported' as const)])}
        >
          Turn on notifications for this device
        </button>
        {status && <p className="muted">{status}</p>}
      </div>

      <button className="btn danger" onClick={() => signOut(auth)}>
        Sign out
      </button>
    </section>
  )
}
