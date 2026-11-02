import { describe, expect, it } from 'vitest'
import { missedHeading, missedTasks, skipDate } from './replan'
import type { Repeat, Status } from './types'

const t = (id: string, date: string, status: Status = 'todo', repeat: Repeat = 'never', time = '') => ({ id, date, status, repeat, time })
const today = '2026-11-02'

describe('replan missed tasks', () => {
  const tasks = [
    t('yesterday', '2026-11-01', 'todo', 'never', '09:00'),
    t('older', '2026-10-28'),
    t('doing', '2026-11-01', 'doing'),
    t('done', '2026-11-01', 'done'),
    t('today', today),
    t('someday', ''),
    t('weekly', '2026-10-30', 'todo', 'weekly'),
  ]

  it('lists open tasks from past days, newest first, without finished, today or undated ones', () => {
    expect(missedTasks(tasks, today).map((x) => x.id)).toEqual(['yesterday', 'doing', 'older'])
  })

  it('leaves repeating tasks out unless they are asked for', () => {
    expect(missedTasks(tasks, today, true).map((x) => x.id)).toContain('weekly')
  })

  it('skips a repeating task to its next date that has not passed', () => {
    expect(skipDate({ date: '2026-10-30', repeat: 'weekly' }, today)).toBe('2026-11-06')
    expect(skipDate({ date: '2026-10-20', repeat: 'daily' }, today)).toBe(today)
    expect(skipDate({ date: '2026-10-01', repeat: 'monthly' }, today)).toBe('2026-12-01')
    const ended = { every: 1, unit: 'week' as const, start: '2026-10-01', end: '2026-11-01' }
    expect(skipDate({ date: '2026-10-29', repeat: 'weekly', recurrence: ended }, today)).toBeNull()
  })

  it('speaks about yesterday only when that is all it was', () => {
    expect(missedHeading(['2026-11-01'], '2026-11-01')).toMatch(/^Yesterday/)
    expect(missedHeading(['2026-11-01', '2026-10-28'], '2026-11-01')).toMatch(/^The last few days/)
  })
})
