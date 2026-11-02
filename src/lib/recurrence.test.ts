import { describe, expect, it } from 'vitest'
import { describe as describeRule, nextOccurrence, presetOf, ruleFor, ruleOf, seriesOf, skipTo } from './recurrence'
import type { Recurrence } from './types'

const rule = (r: Partial<Recurrence>): Recurrence => ({ every: 1, unit: 'day', start: '2026-11-02', ...r })
// 2026-11-02 is a Monday.

describe('repeating tasks', () => {
  it('repeats daily or every few days', () => {
    expect(nextOccurrence('2026-11-02', rule({}))).toBe('2026-11-03')
    expect(nextOccurrence('2026-11-02', rule({ every: 3 }))).toBe('2026-11-05')
  })

  it('repeats on weekdays only', () => {
    const weekdays = rule({ unit: 'week', weekdays: [0, 1, 2, 3, 4] })
    expect(nextOccurrence('2026-11-06', weekdays)).toBe('2026-11-09') // Fri → Mon
    expect(nextOccurrence('2026-11-03', weekdays)).toBe('2026-11-04')
  })

  it('repeats on chosen weekdays', () => {
    const tueThu = rule({ unit: 'week', weekdays: [1, 3] })
    expect(nextOccurrence('2026-11-03', tueThu)).toBe('2026-11-05')
    expect(nextOccurrence('2026-11-05', tueThu)).toBe('2026-11-10')
  })

  it('repeats every two weeks, counted from the first week', () => {
    const fortnight = rule({ unit: 'week', every: 2, weekdays: [3], start: '2026-11-05' })
    expect(nextOccurrence('2026-11-05', fortnight)).toBe('2026-11-19')
    expect(nextOccurrence('2026-11-19', fortnight)).toBe('2026-12-03')
    // Without chosen days it keeps the first date's weekday.
    expect(nextOccurrence('2026-11-05', rule({ unit: 'week', every: 2, start: '2026-11-05' }))).toBe('2026-11-19')
  })

  it('repeats monthly on the same day, using the last day of shorter months', () => {
    const monthly = rule({ unit: 'month', start: '2026-01-31' })
    expect(nextOccurrence('2026-01-31', monthly)).toBe('2026-02-28')
    expect(nextOccurrence('2026-02-28', monthly)).toBe('2026-03-31')
    expect(nextOccurrence('2026-03-31', monthly)).toBe('2026-04-30')
    expect(nextOccurrence('2026-11-15', rule({ unit: 'month', every: 3, start: '2026-11-15' }))).toBe('2027-02-15')
  })

  it('stops at the end date and keeps going without one', () => {
    const ending = rule({ end: '2026-11-04' })
    expect(nextOccurrence('2026-11-03', ending)).toBe('2026-11-04')
    expect(nextOccurrence('2026-11-04', ending)).toBeNull()
    expect(nextOccurrence('2030-01-01', rule({}))).toBe('2030-01-02')
  })

  it('skips to the next date that has not passed', () => {
    expect(skipTo('2026-10-26', rule({ unit: 'week' , start: '2026-10-26'}), '2026-11-03')).toBe('2026-11-09')
  })

  it('reads older tasks that only say daily, weekly or monthly', () => {
    expect(ruleOf({ repeat: 'weekly', date: '2026-11-05' })).toEqual({ every: 1, unit: 'week', start: '2026-11-05' })
    expect(ruleOf({ repeat: 'never', date: '2026-11-05' })).toBeNull()
  })

  it('describes the rule in plain words', () => {
    expect(describeRule(rule({ unit: 'week', weekdays: [0, 1, 2, 3, 4] }))).toBe('Every weekday')
    expect(describeRule(rule({ unit: 'week', every: 2, weekdays: [3] }))).toBe('Every 2 weeks on Thu')
    expect(describeRule(rule({ unit: 'week', weekdays: [3, 0] }))).toBe('Every Mon, Thu')
    expect(describeRule(rule({ unit: 'month', start: '2026-11-22' }))).toBe('Every month on the 22nd')
    expect(describeRule(rule({ end: '2027-06-30', paused: true }))).toBe('Every day · until 30 Jun 2027 · paused')
  })

  it('round-trips presets', () => {
    for (const p of ['daily', 'weekdays', 'weekly', 'fortnightly', 'monthly'] as const) expect(presetOf(ruleFor(p, '2026-11-05', null))).toBe(p)
    expect(ruleFor('weekly', '2026-11-05', null)?.weekdays).toEqual([3])
    expect(presetOf(rule({ every: 3 }))).toBe('custom')
  })

  it('finds every occurrence in a series', () => {
    const all = [
      { id: 'a', recurringFrom: null },
      { id: 'b', recurringFrom: 'a' },
      { id: 'c', recurringFrom: 'b' },
      { id: 'x', recurringFrom: null },
    ]
    expect(seriesOf(all[1], all).map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(seriesOf(all[3], all).map((t) => t.id)).toEqual(['x'])
  })
})
