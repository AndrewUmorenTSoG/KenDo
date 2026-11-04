import { describe, expect, it } from 'vitest'
import { timesMoved, weekReview } from './review'

const DAY = 86_400_000
const now = Date.parse('2026-11-02T12:00:00Z')
const today = '2026-11-02'
let n = 0
const t = (extra = {}) => ({
  id: `t${++n}`,
  title: `T${n}`,
  date: '',
  status: 'todo' as const,
  completedOn: null as string | null,
  estimate: 30,
  projectId: null as string | null,
  createdAt: now,
  updatedAt: now,
  priority: 'medium' as const,
  important: false,
  ...extra,
})
const project = (id: string) => ({ id, name: id, colour: 'pink' as const, uid: 'me', createdAt: 0 })

describe('weekly review', () => {
  it('answers each question from the last seven days', () => {
    const done = t({ status: 'done', date: '2026-10-30', completedOn: '2026-10-30', estimate: 45 })
    const old = t({ status: 'done', date: '2026-10-01', completedOn: '2026-10-01' })
    const missed = t({ date: '2026-10-31' })
    const slipping = t({ date: '2026-10-29', moves: 4 })
    const waiting = t({ createdAt: now - 40 * DAY })
    const staleTask = t({ projectId: 'quiet', updatedAt: now - 20 * DAY })
    const r = weekReview([done, old, missed, slipping, waiting, staleTask], [project('quiet'), project('busy')], [{ date: '2026-11-01', minutes: 25 }], today, now)
    expect(r.completed).toEqual([done])
    expect(r.overdue.map((x) => x.id)).toEqual([slipping.id, missed.id])
    expect(r.postponed).toEqual([slipping])
    expect(r.stale.map((s) => s.project.id)).toEqual(['quiet'])
    expect(r.plannedMinutes).toBe(45 + 30 + 30)
    expect(r.doneMinutes).toBe(45)
    expect(r.focusMinutes).toBe(25)
    expect(r.carry).toEqual([missed])
    expect(r.letGo.map((x) => x.id)).toEqual([waiting.id])
  })

  it('counts moves in words', () => {
    expect(timesMoved(4)).toBe('four times')
    expect(timesMoved(12)).toBe('12 times')
  })
})
