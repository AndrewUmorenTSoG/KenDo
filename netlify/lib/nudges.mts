import type { Firestore } from 'firebase-admin/firestore'
import { verses } from '../../src/lib/verses.ts'
import { pushTo } from './push.mts'

interface Nudge {
  id: string
  // Local hours [from, to) the nudge can arrive in, and the least number of days between two of them.
  hours: [number, number]
  every: number
  message: (name: string) => { title: string; body: string }
}

const say = (body: string) => () => ({ title: 'KenDo', body })
const verse = (ref: string) => () => {
  const v = verses.find((v) => v.ref === ref)!
  return { title: v.ref, body: v.text }
}
const greeting = (name: string) => (name ? `, ${name}` : '')

const nudges: Nudge[] = [
  { id: 'up', hours: [5, 7], every: 1, message: (n) => ({ title: 'KenDo', body: `Are you up${greeting(n)}? So much potential for today!` }) },
  { id: 'quiet-time', hours: [8, 10], every: 2, message: say('Hope your quiet time was blessed 🙏') },
  { id: 'lets-go', hours: [12, 14], every: 1, message: say('Let’s get it! 💪') },
  { id: 'plan', hours: [10, 19], every: 2, message: (n) => ({ title: 'KenDo', body: `${n || 'Hey'}, I hope you’re good. Come plan a task.` }) },
  { id: 'bible', hours: [7, 21], every: 3, message: say('Read your Bible, pray every day if you want to grow.') },
  { id: 'verse', hours: [9, 19], every: 3, message: () => {
    const v = verses[Math.floor(Math.random() * verses.length)]
    return { title: v.ref, body: v.text }
  } },
  { id: 'fear', hours: [9, 19], every: 7, message: verse('1 John 4:18') },
  { id: 'really', hours: [9, 12], every: 7, message: say('Really and truly, there’s so much you can do today.') },
  { id: 'mum', hours: [15, 20], every: 14, message: say('When was the last time you called your mum? 👀') },
  { id: 'water', hours: [11, 17], every: 6, message: (n) => ({ title: 'KenDo', body: `Drink some water${greeting(n)}. Future you says thank you 💧` }) },
  { id: 'small-steps', hours: [14, 18], every: 8, message: say('Small steps still move you forward. Pick one.') },
  { id: 'breathe', hours: [13, 19], every: 8, message: say('Take a breath. You’re doing better than you think.') },
  { id: 'grateful', hours: [19, 21], every: 7, message: say('What’s one thing you’re grateful for today?') },
  { id: 'tomorrow', hours: [20, 22], every: 6, message: say('Tomorrow-you will love it if you plan now. Two minutes?') },
  { id: 'strength', hours: [7, 10], every: 10, message: verse('Philippians 4:13') },
]

const RUN_MINUTES = 5
// Keep nudges apart so they never arrive in a cluster. Besides the daily ones, at most two others a day.
const GAP = 90 * 60_000
const EXTRAS_PER_DAY = 2

function localTime(timeZone: string, now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

// Which nudge (if any) to send now. Inside its window a due nudge is picked with chance 1 / (runs left in
// the window), so it lands at a random moment but always before the window closes.
export function chooseNudge(sent: Record<string, string>, day: string, minutes: number, random = Math.random) {
  const extrasToday = nudges.filter((n) => n.every > 1 && sent[n.id] === day).length
  const due = nudges.filter((n) => {
    const last = sent[n.id]
    if (n.every > 1 && extrasToday >= EXTRAS_PER_DAY) return false
    return (!last || daysBetween(last, day) >= n.every) && minutes >= n.hours[0] * 60 && minutes < n.hours[1] * 60
  })
  for (const n of due.sort(() => random() - 0.5)) {
    const runsLeft = Math.max(1, Math.ceil((n.hours[1] * 60 - minutes) / RUN_MINUTES))
    if (random() < 1 / runsLeft) return n
  }
  return null
}

export async function sendNudges(db: Firestore, now = new Date()) {
  const users = await db.collection('users').get()
  let count = 0
  for (const user of users.docs) {
    const profile = user.data()
    if (profile.nudges === false) continue
    if (profile.lastNudgeAt && now.getTime() - profile.lastNudgeAt < GAP) continue

    const { day, minutes } = localTime(profile.timeZone || 'Europe/London', now)
    const sent: Record<string, string> = profile.nudgesSent ?? {}
    const nudge = chooseNudge(sent, day, minutes)
    if (!nudge) continue

    const name = String(profile.name ?? '').split(' ')[0]
    // Record first so a slow send can't repeat it on the next run.
    await user.ref.set({ nudgesSent: { [nudge.id]: day }, lastNudgeAt: now.getTime() }, { merge: true })
    if (await pushTo(db, user.id, { ...nudge.message(name), kind: 'nudge' })) count++
  }
  return count
}
