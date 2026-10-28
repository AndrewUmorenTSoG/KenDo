import { addDays, addMonths, addWeeks, addYears } from 'date-fns'
import type { Recurrence } from './types'

// Returns the next occurrence strictly after `from`.
export function nextOccurrence(from: number, rule: Recurrence): number {
  const interval = Math.max(1, rule.interval || 1)
  const date = new Date(from)

  switch (rule.freq) {
    case 'daily':
      return addDays(date, interval).getTime()
    case 'monthly':
      return addMonths(date, interval).getTime()
    case 'yearly':
      return addYears(date, interval).getTime()
    case 'weekly': {
      const days = rule.weekdays?.length ? [...rule.weekdays].sort() : null
      if (!days) return addWeeks(date, interval).getTime()
      // Next listed weekday in the same week, otherwise first listed weekday `interval` weeks on.
      const today = date.getDay()
      const later = days.find((d) => d > today)
      if (later !== undefined) return addDays(date, later - today).getTime()
      const startOfNextCycle = addWeeks(addDays(date, -today), interval)
      return addDays(startOfNextCycle, days[0]).getTime()
    }
  }
}

export function describeRecurrence(rule: Recurrence): string {
  const n = rule.interval > 1 ? `${rule.interval} ` : ''
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[rule.freq]
  const plural = rule.interval > 1 ? 's' : ''
  const base = `Every ${n}${unit}${plural}`
  if (rule.freq === 'weekly' && rule.weekdays?.length) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `${base} on ${rule.weekdays.map((d) => names[d]).join(', ')}`
  }
  return base
}
