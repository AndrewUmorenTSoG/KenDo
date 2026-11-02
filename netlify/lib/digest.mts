import type { Firestore } from 'firebase-admin/firestore'
import { eveningMessage, inQuietHours, morningMessage, notifyPrefs, slotDue, type NotifyPrefs } from '../../src/lib/notify.ts'
import type { Task } from '../../src/lib/types.ts'
import { pushTo } from './push.mts'

// Local date and minute of the day in a time zone.
export function localNow(timeZone: string, now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

export interface Person {
  prefs: NotifyPrefs
  quiet: boolean
}

// Each person's choices and whether it's quiet hours for them right now. Profiles are read once per run.
export async function people(db: Firestore, uids: string[], now: Date) {
  const out = new Map<string, Person>()
  for (const uid of new Set(uids)) {
    const profile = (await db.collection('users').doc(uid).get()).data() ?? {}
    const prefs = notifyPrefs(profile.notify)
    const { minutes } = localNow(profile.timeZone || 'Europe/London', now)
    out.set(uid, { prefs, quiet: inQuietHours(minutes, prefs) })
  }
  return out
}

// The morning plan and evening review, for people who turned them on. Recorded before sending,
// so a slow push can't repeat on the next run.
export async function sendDigests(db: Firestore, now = new Date()) {
  const users = await db.collection('users').get()
  let count = 0
  for (const user of users.docs) {
    const profile = user.data()
    const prefs = notifyPrefs(profile.notify)
    if (!prefs.morning && !prefs.overdue && !prefs.deadlines && !prefs.evening) continue
    const { day, minutes } = localNow(profile.timeZone || 'Europe/London', now)
    if (inQuietHours(minutes, prefs)) continue
    const sent: { morning?: string; evening?: string } = profile.digestSent ?? {}
    const morningDue = (prefs.morning || prefs.overdue || prefs.deadlines) && slotDue(minutes, prefs.morningTime, sent.morning, day)
    const eveningDue = prefs.evening && slotDue(minutes, prefs.eveningTime, sent.evening, day)
    if (!morningDue && !eveningDue) continue

    const tasks = (await user.ref.collection('tasks').get()).docs.map((d) => d.data() as Task)
    const name = String(profile.name ?? '').split(' ')[0]
    const message = morningDue ? morningMessage(tasks, day, prefs, name) : eveningMessage(tasks, day, prefs)
    await user.ref.set({ digestSent: { [morningDue ? 'morning' : 'evening']: day } }, { merge: true })
    if (!message) continue
    count++
    await pushTo(db, user.id, { ...message, kind: morningDue ? 'morning' : 'evening' })
  }
  return count
}
