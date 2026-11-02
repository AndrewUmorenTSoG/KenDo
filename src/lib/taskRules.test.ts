import { describe, expect, it } from 'vitest'
import { byMatrixRank, dependsOnChain, isBlocked, quadrantOf } from './taskRules'

describe('priority matrix rules', () => {
  const today = '2026-11-02'
  it('places tasks by date (today, tomorrow or overdue is urgent) and the Important switch', () => {
    expect(quadrantOf({ date: '2026-11-03', important: true }, today)).toBe('do_first')
    expect(quadrantOf({ date: '2026-10-01', important: false }, today)).toBe('share_the_load')
    expect(quadrantOf({ date: '2026-11-04', important: true }, today)).toBe('make_time')
    expect(quadrantOf({ date: '', important: false }, today)).toBe('let_it_wait')
  })
  it('puts ranked tasks first in rank order and keeps the rest as they were', () => {
    const list = [{ id: 'a' }, { id: 'b', matrixRank: 2000 }, { id: 'c' }, { id: 'd', matrixRank: 1000 }]
    expect(byMatrixRank(list).map((t) => t.id)).toEqual(['d', 'b', 'a', 'c'])
  })
  it('knows prerequisites and loops', () => {
    const all = [
      { id: 'a', dependsOn: null, status: 'todo' as const },
      { id: 'b', dependsOn: 'a', status: 'todo' as const },
    ]
    expect(isBlocked(all[1], all)).toBe(true)
    expect(dependsOnChain(all[1], 'a', all)).toBe(true)
  })
})
