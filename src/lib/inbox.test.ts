import { describe, expect, it } from 'vitest'
import { inboxTasks, needsReview, waiting, weekKey } from './inbox'

const DAY = 86_400_000
const now = Date.parse('2026-11-02T12:00:00Z')

describe('inbox', () => {
  it('holds open undated tasks, oldest first, without archived or finished ones', () => {
    const list = inboxTasks([
      { date: '', status: 'todo', createdAt: 3 },
      { date: '', status: 'todo', createdAt: 1 },
      { date: '2026-11-02', status: 'todo', createdAt: 0 },
      { date: '', status: 'done', createdAt: 0 },
      { date: '', status: 'todo', archived: true, createdAt: 0 },
    ])
    expect(list.map((t) => t.createdAt)).toEqual([1, 3])
  })

  it('only mentions waiting time once it helps', () => {
    expect(waiting(now - 2 * DAY, now)).toBeNull()
    expect(waiting(now - 8 * DAY, now)).toBe('Waiting a week')
    expect(waiting(now - 20 * DAY, now)).toBe('Waiting 2 weeks')
    expect(waiting(now - 65 * DAY, now)).toBe('Waiting 2 months')
  })

  it('suggests a review when the Inbox grows or something waits a week', () => {
    expect(needsReview([{ createdAt: now }], now)).toBe(false)
    expect(needsReview(Array.from({ length: 5 }, () => ({ createdAt: now })), now)).toBe(true)
    expect(needsReview([{ createdAt: now - 8 * DAY }], now)).toBe(true)
  })

  it('keys a week by its Monday', () => {
    expect(weekKey('2026-11-05')).toBe('2026-11-02')
    expect(weekKey('2026-11-08')).toBe('2026-11-02')
  })
})
