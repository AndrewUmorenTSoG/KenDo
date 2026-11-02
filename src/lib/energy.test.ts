import { describe, expect, it } from 'vitest'
import { fitsNow } from './energy'

const t = (id: string, extra = {}) => ({ id, status: 'todo' as const, estimate: 15, energy: 'low' as const, date: '', priority: 'medium' as const, important: false, ...extra })
const today = '2026-11-02'

describe('energy-based planning', () => {
  it('finds something that fits the time and the energy there is', () => {
    const tasks = [
      t('long', { estimate: 45 }),
      t('heavy', { energy: 'high' }),
      t('medium', { energy: 'medium' }),
      t('done', { status: 'done' }),
      t('easy'),
    ]
    expect(fitsNow(tasks, 20, 'low', today).map((x) => x.id)).toEqual(['easy'])
    expect(fitsNow(tasks, 20, 'medium', today).map((x) => x.id).sort()).toEqual(['easy', 'medium'])
    expect(fitsNow(tasks, 60, 'high', today)).toHaveLength(4)
  })

  it('puts today and overdue first, then important and high priority', () => {
    const tasks = [t('someday', { priority: 'high' }), t('later', { date: '2026-11-09' }), t('today', { date: today }), t('overdue', { date: '2026-10-30', important: true })]
    expect(fitsNow(tasks, 20, 'low', today).map((x) => x.id)).toEqual(['overdue', 'today', 'later', 'someday'])
  })

  it('leaves out blocked tasks', () => {
    expect(fitsNow([t('a'), t('b')], 20, 'low', today, (x) => x.id === 'a').map((x) => x.id)).toEqual(['b'])
  })
})
