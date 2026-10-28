import { shift, todayKey } from './dates'
import type { NewTask, Priority } from './types'

// Lightweight parsing for the quick-add box until the AI layer exists:
//   "Call Mum tomorrow 18:00 #family !high"
//   -> title "Call Mum", due tomorrow at 18:00, tag "family", high priority
export function parseQuickAdd(input: string): NewTask {
  const tags: string[] = []
  let priority: Priority | undefined
  let date: string | undefined
  let time: string | undefined

  const title = input
    .replace(/(^|\s)#([\w-]+)/g, (_, space, tag: string) => {
      tags.push(tag.toLowerCase())
      return space
    })
    .replace(/(^|\s)!(high|medium|med|low)\b/gi, (_, space, p: string) => {
      const value = p.toLowerCase()
      priority = value === 'med' ? 'medium' : (value as Priority)
      return space
    })
    .replace(/(^|\s)(today|tomorrow|tmrw)\b/gi, (_, space, word: string) => {
      date = word.toLowerCase() === 'today' ? todayKey() : shift(todayKey(), 1)
      return space
    })
    .replace(/(^|\s)(?:at\s+)?([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?(?=\s|$)/gi, (match, space, h: string, m, ampm) => {
      // A bare number like "3" is too ambiguous unless it has minutes or am/pm.
      if (!m && !ampm) return match
      let hour = Number(h) % 24
      if (ampm?.toLowerCase() === 'pm' && hour < 12) hour += 12
      if (ampm?.toLowerCase() === 'am' && hour === 12) hour = 0
      time = `${String(hour).padStart(2, '0')}:${m ?? '00'}`
      return space
    })
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title,
    tags,
    ...(priority ? { priority } : {}),
    ...(date ? { date } : {}),
    ...(time ? { time } : {}),
  }
}
