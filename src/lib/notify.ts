import { shift } from './dates'
import type { Task } from './types'

// What someone wants to hear about. Everything beyond task reminders starts off, so nothing new
// arrives until it's asked for.
export interface NotifyPrefs {
  // A push when a dated task starts (or `lead` minutes before).
  taskStart: boolean
  lead: number
  // Task reminders only for high priority or "Important to me" tasks.
  importantOnly: boolean
  // A short plan for the day at morningTime; it can also mention tomorrow's important tasks
  // (deadlines) and tasks still open from earlier days (overdue).
  morning: boolean
  morningTime: string
  deadlines: boolean
  overdue: boolean
  // A gentle look back at eveningTime.
  evening: boolean
  eveningTime: string
  // Nothing arrives between these times; task reminders wait until they end.
  quiet: boolean
  quietFrom: string
  quietTo: string
}

export const defaultNotify: NotifyPrefs = {
  taskStart: true,
  lead: 0,
  importantOnly: false,
  morning: false,
  morningTime: '08:00',
  deadlines: false,
  overdue: false,
  evening: false,
  eveningTime: '20:30',
  quiet: false,
  quietFrom: '22:00',
  quietTo: '07:00',
}

export const notifyPrefs = (saved?: Partial<NotifyPrefs> | null): NotifyPrefs => ({ ...defaultNotify, ...(saved ?? {}) })

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

// Quiet hours may run past midnight (22:00 → 07:00).
export function inQuietHours(minute: number, prefs: Pick<NotifyPrefs, 'quiet' | 'quietFrom' | 'quietTo'>) {
  if (!prefs.quiet) return false
  const from = minutesOf(prefs.quietFrom)
  const to = minutesOf(prefs.quietTo)
  if (from === to) return false
  return from < to ? minute >= from && minute < to : minute >= from || minute < to
}

// Whether a task's own reminder should be pushed, given the person's choices.
export const wantsTaskReminder = (task: Pick<Task, 'priority' | 'important'>, prefs: NotifyPrefs) =>
  prefs.taskStart && (!prefs.importantOnly || task.priority === 'high' || !!task.important)

// A daily message is due from its time until two hours later, once a day.
export const slotDue = (minute: number, time: string, lastSent: string | undefined, today: string) =>
  lastSent !== today && minute >= minutesOf(time) && minute < minutesOf(time) + 120

const list = (titles: string[]) =>
  titles.length <= 2 ? titles.join(' and ') : `${titles.slice(0, 2).join(', ')} and ${titles.length - 2} more`

type DigestTask = Pick<Task, 'title' | 'date' | 'status' | 'priority' | 'important' | 'time'> & { archived?: boolean }

export function morningMessage(tasks: DigestTask[], today: string, prefs: NotifyPrefs, name: string) {
  const live = tasks.filter((t) => !t.archived)
  const open = live.filter((t) => t.status !== 'done')
  const todays = open.filter((t) => t.date === today).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
  const overdue = open.filter((t) => t.date && t.date < today)
  const tomorrow = open.filter((t) => t.date === shift(today, 1) && (t.priority === 'high' || t.important))
  const lines: string[] = []
  if (prefs.morning)
    lines.push(
      todays.length
        ? `${todays.length === 1 ? 'One thing' : `${todays.length} things`} planned today: ${list(todays.map((t) => t.title))}.`
        : 'Nothing planned yet. A good moment to choose one thing.',
    )
  if (prefs.overdue && overdue.length)
    lines.push(`${overdue.length === 1 ? 'One task' : `${overdue.length} tasks`} from earlier days could use a new plan.`)
  if (prefs.deadlines && tomorrow.length) lines.push(`Coming up tomorrow: ${list(tomorrow.map((t) => t.title))}.`)
  if (!lines.length) return null
  return { title: prefs.morning ? `Good morning${name ? `, ${name}` : ''}` : 'KenDo', body: lines.join(' ') }
}

export function eveningMessage(tasks: DigestTask[], today: string, prefs: NotifyPrefs) {
  if (!prefs.evening) return null
  const todays = tasks.filter((t) => t.date === today && !t.archived)
  const done = todays.filter((t) => t.status === 'done').length
  const open = todays.length - done
  const body = !todays.length
    ? 'How did today go? Two minutes now can set up tomorrow.'
    : open
      ? `You finished ${done} today. ${open === 1 ? 'One is' : `${open} are`} still open; you can move ${open === 1 ? 'it' : 'them'} to tomorrow.`
      : `All ${done} done today. Rest well.`
  return { title: 'Evening review', body }
}
