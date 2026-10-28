// Dates are stored as local "YYYY-MM-DD" keys, matching how people think about "today".

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayKey = () => dateKey(new Date())

// Midday avoids daylight saving edges when shifting by whole days.
const atNoon = (key: string) => new Date(`${key}T12:00:00`)

export function shift(key: string, days: number) {
  const d = atNoon(key)
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

export function shiftMonths(key: string, months: number) {
  const d = atNoon(key)
  d.setMonth(d.getMonth() + months)
  return dateKey(d)
}

export const fmt = (key: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  atNoon(key).toLocaleDateString('en-GB', options)

// Monday-first week containing today, offset by whole weeks.
export function week(offset = 0) {
  const d = atNoon(todayKey())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7)
  const start = dateKey(d)
  return Array.from({ length: 7 }, (_, i) => shift(start, i))
}

export const lastDays = (n: number) => Array.from({ length: n }, (_, i) => shift(todayKey(), i - (n - 1)))

export function toMillis(date: string, time: string) {
  return date && time ? new Date(`${date}T${time}`).getTime() : null
}
