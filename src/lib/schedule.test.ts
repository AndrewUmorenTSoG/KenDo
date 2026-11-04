import { describe, expect, it } from 'vitest'
import { clampStart, nextGap, snap, toClock, toMinutes } from './schedule'

describe('timeline scheduling', () => {
  it('converts and snaps times', () => {
    expect(toMinutes('09:45')).toBe(585)
    expect(toClock(585)).toBe('09:45')
    expect(snap(592)).toBe(585)
    expect(snap(593)).toBe(600)
  })

  it('keeps a task inside the visible day', () => {
    expect(clampStart(400, 60, 420, 1260)).toBe(420)
    expect(clampStart(1250, 60, 420, 1260)).toBe(1200)
    expect(clampStart(600, 60, 420, 1260)).toBe(600)
  })

  it('finds the next free gap that fits', () => {
    const task = { id: 'me', time: '09:00', estimate: 30 }
    const others = [
      { id: 'a', time: '09:00', estimate: 60 },
      { id: 'b', time: '10:00', estimate: 20 },
      { id: 'c', time: '11:00', estimate: 60 },
      { id: 'me', time: '09:00', estimate: 30 },
      { id: 'anytime', time: '', estimate: 30 },
    ]
    // 10:20 → 10:30 is the first 15-minute step, and 30 minutes fit before 11:00.
    expect(nextGap(task, others, toMinutes('09:00'))).toBe(toMinutes('10:30'))
    expect(nextGap({ ...task, estimate: 45 }, others, toMinutes('09:00'))).toBe(toMinutes('12:00'))
    expect(nextGap(task, [], toMinutes('09:07'))).toBe(toMinutes('09:15'))
    expect(nextGap(task, others, toMinutes('23:45'))).toBeNull()
  })
})
