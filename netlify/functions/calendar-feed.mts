import type { Config, Context } from '@netlify/functions'
import type { Firestore } from 'firebase-admin/firestore'
import { adminDb } from '../lib/admin.mts'
import { taskSnapshots } from '../lib/workspace.mts'

interface FeedTask {
  title: string
  description?: string
  date?: string
  time?: string
  estimate?: number
  status?: string
  updatedAt?: number
}

// A private iCalendar feed of someone's dated tasks, for Google Calendar or Outlook to subscribe to.
// The link carries a random token from their profile; making a new link in Settings retires the old one.
export default async (_req: Request, context: Context) => {
  const { uid } = context.params
  const token = context.params.token.replace(/\.ics$/, '')
  const db = adminDb()
  const profile = await db.collection('users').doc(uid).get()
  if (!token || profile.get('calendarToken') !== token) return new Response('Not found', { status: 404 })

  const tasks = await tasksFor(db, uid)
  const from = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)
  const events = tasks.filter(([, t]) => t.date && t.date >= from).map(([id, t]) => event(id, t))

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KenDo//Tasks//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:KenDo',
    'X-WR-TIMEZONE:Europe/London',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...events.flat(),
    'END:VCALENDAR',
  ]
    .map(fold)
    .join('\r\n')

  return new Response(body + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=900' },
  })
}

async function tasksFor(db: Firestore, uid: string) {
  const docs = await taskSnapshots(db, uid)
  return docs.map((d) => [d.id, d.data() as FeedTask] as const)
}

function event(id: string, t: FeedTask) {
  const day = t.date!.replaceAll('-', '')
  let when: string[]
  if (t.time) {
    // Floating local time: calendars show it at the same clock time in the user's own time zone.
    const start = new Date(`${t.date}T${t.time}:00Z`)
    const end = new Date(start.getTime() + (t.estimate || 30) * 60_000)
    when = [`DTSTART:${local(start)}`, `DTEND:${local(end)}`]
  } else {
    const next = new Date(`${t.date}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    when = [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replaceAll('-', '')}`]
  }
  const stamp = new Date(t.updatedAt || Date.now()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  return [
    'BEGIN:VEVENT',
    `UID:${id}@kendo`,
    `DTSTAMP:${stamp}`,
    ...when,
    `SUMMARY:${escape((t.status === 'done' ? '✓ ' : '') + t.title)}`,
    ...(t.description ? [`DESCRIPTION:${escape(t.description)}`] : []),
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ]
}

const local = (d: Date) => d.toISOString().slice(0, 19).replace(/[-:]/g, '')
const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

// iCalendar lines are folded at 75 bytes, continuing with a leading space.
function fold(line: string) {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
    }
    current += char
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export const config: Config = { path: '/feed/:uid/:token' }
