// Wall-clock dates and times in a person's own time zone. KenDo stores tasks as local "2026-10-28" +
// "09:00", so the server must turn those into instants with the user's zone, never the server's (UTC).

export const DEFAULT_TIME_ZONE = 'Europe/London'

export function validTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function parts(ms: number, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  )
  return p as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>
}

// Local date and time for an instant.
export function toLocal(ms: number, timeZone: string) {
  const p = parts(ms, timeZone)
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

export const localToday = (timeZone: string, now = Date.now()) => toLocal(now, timeZone).date

// How far the zone is ahead of UTC at an instant, in ms.
function offset(ms: number, timeZone: string) {
  const p = parts(ms, timeZone)
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function validDate(date: string) {
  if (!DATE_RE.test(date)) return false
  const d = new Date(`${date}T12:00:00Z`)
  return d.toISOString().slice(0, 10) === date
}

// The instant a local wall-clock time happens. A time skipped by a spring-forward change lands just after
// the gap (01:30 on the last Sunday of March in London becomes 02:30 BST); `exact` is false then.
export function zonedToMillis(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, h, min)
  let guess = wall - offset(wall, timeZone)
  const second = wall - offset(guess, timeZone)
  if (second !== guess) guess = second
  const back = toLocal(guess, timeZone)
  return { ms: guess, exact: back.date === date && back.time === time }
}

// ISO 8601 with the zone's offset, e.g. "2026-10-28T18:00:00+00:00".
export function isoInZone(ms: number, timeZone: string) {
  const { date, time } = toLocal(ms, timeZone)
  const off = Math.round(offset(ms, timeZone) / 60_000)
  const sign = off < 0 ? '-' : '+'
  const abs = Math.abs(off)
  return `${date}T${time}:00${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

// Accepts "2026-10-28T18:00" (local to the zone) or a full ISO instant with Z/offset.
export function parseWhen(value: string, timeZone: string): { ms: number; date: string; time: string } | null {
  const local = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::00)?$/.exec(value)
  if (local) {
    if (!validDate(local[1]) || !TIME_RE.test(local[2])) return null
    const { ms } = zonedToMillis(local[1], local[2], timeZone)
    return { ms, ...toLocal(ms, timeZone) }
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)) return null
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return null
  return { ms, ...toLocal(ms, timeZone) }
}
