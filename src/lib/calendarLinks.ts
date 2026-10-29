import type { Task } from './types'

// The private feed that Google Calendar or Outlook can subscribe to (see netlify/functions/calendar-feed.mts).
export const feedUrl = (uid: string, token: string) => `${location.origin}/feed/${uid}/${token}.ics`

export const newFeedToken = () => crypto.randomUUID().replace(/-/g, '')

export const googleSubscribe = (url: string) =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url.replace(/^https:/, 'webcal:'))}`

export const outlookSubscribe = (url: string) =>
  `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=KenDo`

type Dated = Pick<Task, 'title' | 'description' | 'date' | 'time' | 'estimate'>

// "2026-10-30" + "09:15" -> wall-clock start and end, as YYYYMMDDTHHMMSS strings.
function span(task: Dated) {
  const start = new Date(`${task.date}T${task.time}:00Z`)
  const end = new Date(start.getTime() + (task.estimate || 30) * 60_000)
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace(/[-:]/g, '')
  return [fmt(start), fmt(end)]
}

const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function googleEvent(task: Dated) {
  const dates = task.time ? span(task).join('/') : `${task.date.replaceAll('-', '')}/${nextDay(task.date).replaceAll('-', '')}`
  const params = new URLSearchParams({ action: 'TEMPLATE', text: task.title, dates, details: task.description })
  if (task.time) params.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone)
  return `https://calendar.google.com/calendar/render?${params}`
}

export function outlookEvent(task: Dated) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: task.title,
    body: task.description,
  })
  if (task.time) {
    const iso = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:00`
    const [start, end] = span(task)
    params.set('startdt', iso(start))
    params.set('enddt', iso(end))
  } else {
    params.set('startdt', task.date)
    params.set('enddt', nextDay(task.date))
    params.set('allday', 'true')
  }
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`
}
