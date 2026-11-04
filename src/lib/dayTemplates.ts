import { nextGap, toClock, toMinutes } from './schedule'
import type { Task, TaskColour } from './types'

export interface TemplateItem {
  title: string
  time: string
  estimate: number
  colour?: TaskColour | null
}

export interface DayTemplate {
  id: string
  name: string
  items: TemplateItem[]
  uid: string
  createdAt: number
}

// keep: add the template's tasks next to the day's own. merge: skip ones the day already has and fit
// the rest around what's there. replace: the template becomes the plan and the day's open tasks
// go to the Inbox (never deleted).
export type ApplyMode = 'keep' | 'merge' | 'replace'

const item = (title: string, time: string, estimate: number): TemplateItem => ({ title, time, estimate })

export const starterTemplates: Pick<DayTemplate, 'name' | 'items'>[] = [
  {
    name: 'University day',
    items: [item('Quiet time', '07:30', 20), item('Lectures', '09:00', 180), item('Lunch break', '13:00', 45), item('Study session', '14:00', 90), item('Review today’s notes', '19:00', 30)],
  },
  {
    name: 'Work day',
    items: [item('Quiet time', '07:00', 20), item('Focused work', '09:00', 120), item('Lunch', '12:30', 45), item('Meetings and email', '14:00', 90), item('Wind down', '18:00', 30)],
  },
  { name: 'Rest day', items: [item('Slow morning', '09:00', 60), item('Walk outside', '12:00', 45), item('Something you enjoy', '16:00', 60)] },
  { name: 'Sunday', items: [item('Get ready for church', '08:00', 60), item('Church service', '09:30', 150), item('Rest', '15:00', 90), item('Plan the week', '19:00', 30)] },
  {
    name: 'Outreach day',
    items: [item('Prayer', '09:00', 30), item('Outreach', '10:00', 180), item('Follow-up calls', '14:00', 60), item('Note who you met', '18:00', 20)],
  },
  {
    name: 'Exam day',
    items: [item('Quiet time', '07:00', 15), item('Breakfast', '07:30', 30), item('Light revision', '08:30', 45), item('Exam', '10:00', 120), item('Rest', '14:00', 60)],
  },
]

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function planApply<T extends Pick<Task, 'id' | 'title' | 'time' | 'estimate' | 'status'>>(items: TemplateItem[], day: T[], mode: ApplyMode) {
  const open = day.filter((t) => t.status !== 'done')
  if (mode === 'keep') return { create: items, toInbox: [] as T[], skipped: [] as string[], moved: [] as string[] }
  if (mode === 'replace') return { create: items, toInbox: open, skipped: [] as string[], moved: [] as string[] }

  // merge
  const skipped: string[] = []
  const moved: string[] = []
  const create: TemplateItem[] = []
  const busy = day.filter((t) => t.time).map((t) => ({ id: t.id, time: t.time, estimate: t.estimate }))
  for (const [i, it] of items.entries()) {
    if (day.some((t) => sameTitle(t.title, it.title))) {
      skipped.push(it.title)
      continue
    }
    if (!it.time) {
      create.push(it)
      continue
    }
    const block = { id: `new-${i}`, time: it.time, estimate: it.estimate }
    const start = nextGap(block, busy, toMinutes(it.time))
    // Nothing free later that day: keep its time rather than drop it.
    const time = start === null ? it.time : toClock(start)
    if (time !== it.time) moved.push(it.title)
    create.push({ ...it, time })
    busy.push({ ...block, time })
  }
  return { create, toInbox: [] as T[], skipped, moved }
}

// A day's timed tasks as a template, for "Save this day as a type".
export const itemsFromDay = (tasks: Pick<Task, 'title' | 'time' | 'estimate' | 'colour'>[]): TemplateItem[] =>
  tasks
    .filter((t) => t.time)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((t) => ({ title: t.title, time: t.time, estimate: t.estimate, colour: t.colour ?? null }))
