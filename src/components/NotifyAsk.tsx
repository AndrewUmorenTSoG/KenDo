import { useEffect, useState } from 'react'
import { updateProfile, useStore } from '../data/store'
import { enableNotifications, notificationsSupported } from '../lib/notifications'
import Icon from './Icon'

// Offers reminders right after someone plans a task, explaining why before the browser asks.
// It never comes back after "Not now", and never shows when the browser has already decided.
export default function NotifyAsk() {
  const { uid, profile } = useStore()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile.notifyAskDismissed) return
    const planned = async () => {
      if (!('Notification' in window) || Notification.permission !== 'default') return
      if (await notificationsSupported()) setShow(true)
    }
    window.addEventListener('kendo:planned', planned)
    return () => window.removeEventListener('kendo:planned', planned)
  }, [profile.notifyAskDismissed])

  if (!show || profile.notifyAskDismissed) return null

  async function yes() {
    setBusy(true)
    await enableNotifications(uid).catch(() => undefined)
    setBusy(false)
    setShow(false)
    // Asked once; whatever the browser answered stands.
    updateProfile(uid, { notifyAskDismissed: true })
  }

  function notNow() {
    setShow(false)
    updateProfile(uid, { notifyAskDismissed: true })
  }

  return (
    <aside className="notify-ask" role="dialog" aria-modal="false" aria-labelledby="notify-ask-title">
      <span className="notify-ask-icon">
        <Icon name="bell" />
      </span>
      <div>
        <h2 id="notify-ask-title">Want a reminder when it’s time?</h2>
        <p>KenDo can let you know when a planned task starts. You can change this any time in Settings.</p>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={yes}>
            Turn on reminders
          </button>
          <button className="text-btn" onClick={notNow}>
            Not now
          </button>
        </div>
      </div>
    </aside>
  )
}
