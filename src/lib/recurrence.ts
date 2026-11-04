import { dateKey, fmt, shift, todayKey } from './dates'
import type { Recurrence, Repeat, Task } from './types'

export const repeatLabels: Record<Repeat, string> = {
  never: 'Never',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const noon = (key: string) => new Date(`${key}T12:00:00`)
// Monday = 0 … Sunday = 6.
export const weekdayOf = (key: string) => (noon(key).getDay() + 6) % 7
const monday = (key: string) => shift(key, -weekdayOf(key))
const daysBetween = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / 86_400_000)
const monthIndex = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1

// The given day of a month, or its last day when the month is shorter (31st → 30 Apr, 28/29 Feb).
function dayInMonth(index: number, day: number) {
  const year = Math.floor(index / 12)
  const month = index % 12
  const last = new Date(year, month + 1, 0, 12).getDate()
  return dateKey(new Date(year, month, Math.min(day, last), 12))
}

// The rule for a task, reading older tasks' plain `repeat` as every 1 day/week/month from its date.
export function ruleOf(task: Pick<Task, 'repeat' | 'date'> & { recurrence?: Recurrence | null }): Recurrence | null {
  if (task.repeat === 'never') return null
  if (task.recurrence) return task.recurrence
  const unit = task.repeat === 'daily' ? 'day' : task.repeat === 'weekly' ? 'week' : 'month'
  return { every: 1, unit, start: task.date || todayKey() }
}

export const repeatOf = (rule: Recurrence | null): Repeat =>
  !rule ? 'never' : rule.unit === 'day' ? 'daily' : rule.unit === 'week' ? 'weekly' : 'monthly'

// The first occurrence after `date`, or null once the series has ended.
export function nextOccurrence(date: string, rule: Recurrence): string | null {
  const from = date || todayKey()
  const every = Math.max(1, Math.floor(rule.every) || 1)
  let next: string | null = null

  if (rule.unit === 'day') next = shift(from, every)
  else if (rule.unit === 'week') {
    const days = rule.weekdays?.length ? rule.weekdays : [weekdayOf(rule.start || from)]
    const anchor = monday(rule.start || from)
    for (let i = 1; i <= 7 * every + 7 && !next; i++) {
      const d = shift(from, i)
      const weeks = Math.floor(daysBetween(anchor, monday(d)) / 7)
      if (days.includes(weekdayOf(d)) && ((weeks % every) + every) % every === 0) next = d
    }
  } else {
    const start = rule.start || from
    const day = Number(start.slice(8, 10))
    let k = Math.max(0, Math.floor((monthIndex(from) - monthIndex(start)) / every))
    do next = dayInMonth(monthIndex(start) + k++ * every, day)
    while (next <= from)
  }
  return next && rule.end && next > rule.end ? null : next
}

// Skipping an occurrence moves to the next one that hasn't already passed.
export function skipTo(date: string, rule: Recurrence, today: string) {
  let next = nextOccurrence(date, rule)
  while (next && next < today) next = nextOccurrence(next, rule)
  return next
}

// Kept for older callers: the date one step on from a plain repeat.
export function nextDate(from: string, repeat: Repeat) {
  const rule = ruleOf({ repeat, date: from })
  return (rule && nextOccurrence(from, rule)) || from || todayKey()
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

// "Every weekday", "Every 2 weeks on Thu", "Every month on the 15th · until 30 Jun 2027".
export function describe(rule: Recurrence) {
  const every = Math.max(1, rule.every)
  const days = rule.unit === 'week' ? (rule.weekdays?.length ? rule.weekdays : [weekdayOf(rule.start)]) : []
  const sorted = [...days].sort((a, b) => a - b)
  let text: string
  if (rule.unit === 'day') text = every === 1 ? 'Every day' : `Every ${every} days`
  else if (rule.unit === 'month') text = `${every === 1 ? 'Every month' : `Every ${every} months`} on the ${ordinal(Number(rule.start.slice(8, 10)))}`
  else if (every === 1 && sorted.join() === '0,1,2,3,4') text = 'Every weekday'
  else if (every === 1 && sorted.length === 7) text = 'Every day'
  else text = `${every === 1 ? 'Every' : `Every ${every} weeks on`} ${sorted.map((d) => WEEKDAY_NAMES[d]).join(', ')}`
  if (rule.end) text += ` · until ${fmt(rule.end, { day: 'numeric', month: 'short', year: 'numeric' })}`
  if (rule.paused) text += ' · paused'
  return text
}

export type Preset = 'never' | 'daily' | 'weekdays' | 'weekly' | 'fortnightly' | 'monthly' | 'custom'

export function presetOf(rule: Recurrence | null): Preset {
  if (!rule) return 'never'
  const days = [...(rule.weekdays ?? [])].sort().join()
  if (rule.unit === 'day' && rule.every === 1) return 'daily'
  if (rule.unit === 'month' && rule.every === 1) return 'monthly'
  if (rule.unit === 'week' && rule.every === 1 && days === '0,1,2,3,4') return 'weekdays'
  if (rule.unit === 'week' && rule.every === 1) return 'weekly'
  if (rule.unit === 'week' && rule.every === 2) return 'fortnightly'
  return 'custom'
}

// A fresh rule for a preset, starting on `date` and keeping what still applies from the old one.
export function ruleFor(preset: Preset, date: string, old: Recurrence | null): Recurrence | null {
  const start = date || todayKey()
  const keep = { start, end: old?.end ?? null, paused: old?.paused ?? false }
  const day = [weekdayOf(start)]
  switch (preset) {
    case 'never':
      return null
    case 'daily':
      return { ...keep, every: 1, unit: 'day' }
    case 'weekdays':
      return { ...keep, every: 1, unit: 'week', weekdays: [0, 1, 2, 3, 4] }
    case 'weekly':
      return { ...keep, every: 1, unit: 'week', weekdays: old?.unit === 'week' && old.every === 1 && old.weekdays?.length ? old.weekdays : day }
    case 'fortnightly':
      return { ...keep, every: 2, unit: 'week', weekdays: old?.unit === 'week' && old.weekdays?.length ? old.weekdays : day }
    case 'monthly':
      return { ...keep, every: 1, unit: 'month' }
    case 'custom':
      return old ? { ...old, start } : { ...keep, every: 3, unit: 'day' }
  }
}

// Every task in the same repeating series, linked by the occurrence each was created from.
export function seriesOf<T extends Pick<Task, 'id' | 'recurringFrom'>>(task: T, all: T[]) {
  const ids = new Set([task.id])
  for (let size = 0; size !== ids.size; ) {
    size = ids.size
    for (const t of all) {
      if (!ids.has(t.id) && !(t.recurringFrom && ids.has(t.recurringFrom))) continue
      ids.add(t.id)
      if (t.recurringFrom) ids.add(t.recurringFrom)
    }
  }
  return all.filter((t) => ids.has(t.id))
}
