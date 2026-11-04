import { describe, expect, it } from 'vitest'
import { itemsFromDay, planApply, starterTemplates } from './dayTemplates'

const items = [
  { title: 'Quiet time', time: '07:00', estimate: 20 },
  { title: 'Lectures', time: '09:00', estimate: 60 },
  { title: 'Read', time: '', estimate: 25 },
]
const day = [
  { id: 'a', title: 'quiet time', time: '06:30', estimate: 20, status: 'todo' as const },
  { id: 'b', title: 'Dentist', time: '09:00', estimate: 30, status: 'todo' as const },
  { id: 'c', title: 'Gym', time: '', estimate: 30, status: 'done' as const },
]

describe('day templates', () => {
  it('has the starter day types', () => {
    expect(starterTemplates.map((t) => t.name)).toEqual(['University day', 'Work day', 'Rest day', 'Sunday', 'Outreach day', 'Exam day'])
  })

  it('keeps the day and adds everything', () => {
    expect(planApply(items, day, 'keep')).toMatchObject({ create: items, toInbox: [] })
  })

  it('replaces by sending open tasks to the Inbox, never deleting', () => {
    const r = planApply(items, day, 'replace')
    expect(r.create).toEqual(items)
    expect(r.toInbox.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('merges by skipping what the day already has and fitting the rest around it', () => {
    const r = planApply(items, day, 'merge')
    expect(r.skipped).toEqual(['Quiet time'])
    expect(r.create.map((i) => `${i.title}@${i.time}`)).toEqual(['Lectures@09:30', 'Read@'])
    expect(r.moved).toEqual(['Lectures'])
  })

  it('saves a day as a template from its timed tasks', () => {
    expect(itemsFromDay([{ title: 'B', time: '10:00', estimate: 5 }, { title: 'A', time: '08:00', estimate: 5 }, { title: 'C', time: '', estimate: 5 }]).map((i) => i.title)).toEqual(['A', 'B'])
  })
})
