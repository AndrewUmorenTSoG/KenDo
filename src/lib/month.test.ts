import { describe, expect, it } from 'vitest'
import { countByDay, monthGrid, upcoming } from './month'

describe('month view', () => {
  it('lays out whole Monday-first weeks around the month', () => {
    const nov = monthGrid('2026-11-17')
    expect(nov[0]).toBe('2026-10-26')
    expect(nov.at(-1)).toBe('2026-12-06')
    expect(nov).toHaveLength(42)
    expect(monthGrid('2027-02-10')).toHaveLength(28)
    expect(monthGrid('2026-12-01').length % 7).toBe(0)
  })

  it('counts open, finished and overdue tasks per day', () => {
    const counts = countByDay(
      [
        { date: '2026-11-01', status: 'todo' },
        { date: '2026-11-01', status: 'done' },
        { date: '2026-11-02', status: 'doing' },
        { date: '', status: 'todo' },
      ],
      '2026-11-02',
    )
    expect(counts.get('2026-11-01')).toEqual({ open: 1, done: 1, overdue: 1 })
    expect(counts.get('2026-11-02')).toEqual({ open: 1, done: 0, overdue: 0 })
    expect(counts.size).toBe(2)
  })

  it('lists what is coming up, soonest first', () => {
    const t = (date: string, extra = {}) => ({ date, time: '', status: 'todo' as const, priority: 'medium' as const, important: false, ...extra })
    const list = upcoming(
      [t('2026-11-05'), t('2026-11-03'), t('2026-11-03', { priority: 'high' }), t('2026-11-01'), t('2026-12-30'), t('2026-11-04', { status: 'done' })],
      '2026-11-02',
    )
    expect(list.map((x) => x.date)).toEqual(['2026-11-03', '2026-11-03', '2026-11-05'])
    expect(list[0].priority).toBe('high')
  })
})
