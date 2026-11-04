import { updateDoc } from 'firebase/firestore'
import { useEffect, useState, type ReactNode } from 'react'
import { updateProfile, useStore } from '../data/store'
import { remindTime, taskRef } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { enableNotifications, notificationsSupported } from '../lib/notifications'
import { notifyPrefs, type NotifyPrefs } from '../lib/notify'
import Icon from './Icon'

type Permission = NotificationPermission | 'unsupported'

const leads: [number, string][] = [
  [0, 'When it starts'],
  [5, '5 minutes before'],
  [10, '10 minutes before'],
  [15, '15 minutes before'],
  [30, '30 minutes before'],
  [60, '1 hour before'],
]

// Everything about notifications in one place: this device's permission, what to hear about, and when.
export default function NotificationSettings() {
  const { uid, profile, tasks } = useStore()
  const { toast } = useUI()
  const prefs = notifyPrefs(profile.notify)
  const [permission, setPermission] = useState<Permission>(() => ('Notification' in window ? Notification.permission : 'unsupported'))

  useEffect(() => {
    notificationsSupported().then((ok) => !ok && setPermission('unsupported'))
  }, [])

  const set = (changes: Partial<NotifyPrefs>) => updateProfile(uid, { notify: { ...profile.notify, ...changes } })

  // A new default timing moves the reminders of open tasks that follow the default.
  function setLead(lead: number) {
    set({ lead })
    for (const t of tasks) {
      if (t.remindBefore !== undefined || t.status === 'done' || t.reminderSent || !t.date || !t.time) continue
      const remindAt = remindTime(t.date, t.time, lead)
      if (remindAt !== t.remindAt) updateDoc(taskRef(uid, t), { remindAt, reminder: remindAt !== null }).catch(() => undefined)
    }
  }

  async function turnOn() {
    const result = await enableNotifications(uid).catch(() => 'unsupported' as const)
    setPermission(result === 'unsupported' ? 'unsupported' : Notification.permission)
    if (result === 'granted') toast('Notifications are on for this device.')
  }

  const toggle = (label: string, key: 'taskStart' | 'importantOnly' | 'morning' | 'overdue' | 'deadlines' | 'evening' | 'quiet') => (
    <button role="switch" aria-checked={prefs[key]} aria-label={label} className={`toggle ${prefs[key] ? 'on' : ''}`} onClick={() => set({ [key]: !prefs[key] })} />
  )

  const row = (title: string, control: ReactNode, sub?: string, extra?: ReactNode) => (
    <div className="setting-row">
      <div>
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
        {extra}
      </div>
      {control}
    </div>
  )

  const timeInput = (label: string, key: 'morningTime' | 'eveningTime' | 'quietFrom' | 'quietTo') => (
    <input type="time" className="notify-time" aria-label={label} value={prefs[key]} onChange={(e) => e.target.value && set({ [key]: e.target.value })} />
  )

  return (
    <section className="panel" aria-labelledby="notify-title">
      <h2 id="notify-title">Notifications</h2>

      {row(
        'This device',
        permission === 'default' ? (
          <button className="btn" onClick={turnOn}>
            <Icon name="bell" />
            Turn on
          </button>
        ) : (
          <span className={`pill ${permission === 'granted' ? 'sage' : ''}`}>{permission === 'granted' ? 'On' : 'Off'}</span>
        ),
        permission === 'granted'
          ? 'Reminders arrive here.'
          : permission === 'denied'
            ? 'Blocked in this browser. Allow notifications for KenDo in your browser or phone settings to turn them back on.'
            : permission === 'unsupported'
              ? 'This browser can’t receive notifications. On iPhone, add KenDo to your Home Screen first.'
              : 'Turn on to get reminders on this device.',
      )}

      {row(
        'Task reminders',
        toggle('Task reminders', 'taskStart'),
        undefined,
        prefs.taskStart && (
          <select className="notify-select" aria-label="Remind me" value={prefs.lead} onChange={(e) => setLead(Number(e.target.value))}>
            {leads.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ),
      )}
      {prefs.taskStart && row('Only high priority and important tasks', toggle('Only high priority and important tasks', 'importantOnly'))}

      {row('Morning plan', toggle('Morning plan', 'morning'), 'What’s planned for today.', prefs.morning || prefs.overdue || prefs.deadlines ? timeInput('Morning plan time', 'morningTime') : null)}
      {row('Coming up tomorrow', toggle('Coming up tomorrow', 'deadlines'), 'High priority and important tasks, in the morning plan.')}
      {row('Still open from earlier days', toggle('Still open from earlier days', 'overdue'), 'A gentle count in the morning plan.')}
      {row('Evening review', toggle('Evening review', 'evening'), 'A look back at today.', prefs.evening ? timeInput('Evening review time', 'eveningTime') : null)}
      {row(
        'Quiet hours',
        toggle('Quiet hours', 'quiet'),
        prefs.quiet ? 'Reminders wait until quiet hours end.' : undefined,
        prefs.quiet && (
          <span className="notify-range">
            {timeInput('Quiet from', 'quietFrom')} to {timeInput('Quiet until', 'quietTo')}
          </span>
        ),
      )}
      {row(
        'Encouraging nudges',
        <button
          role="switch"
          aria-checked={profile.nudges}
          aria-label="Encouraging nudges"
          className={`toggle ${profile.nudges ? 'on' : ''}`}
          onClick={() => updateProfile(uid, { nudges: !profile.nudges })}
        />,
      )}
    </section>
  )
}
