import { describe, expect, it } from 'vitest'
import { nextDate } from '../../../src/lib/recurrence'
import { isoInZone, parseWhen, toLocal, validDate, zonedToMillis } from './zoned.mts'

const LONDON = 'Europe/London'

describe('London wall-clock times', () => {
  it('reads 18:00 in winter as 18:00 UTC and in summer as 17:00 UTC', () => {
    expect(new Date(zonedToMillis('2026-12-01', '18:00', LONDON).ms).toISOString()).toBe('2026-12-01T18:00:00.000Z')
    expect(new Date(zonedToMillis('2026-07-01', '18:00', LONDON).ms).toISOString()).toBe('2026-07-01T17:00:00.000Z')
  })

  it('keeps a weekly 19:00 task at 19:00 local across both British Summer Time changes', () => {
    // Thursdays either side of 29 March 2026 (clocks go forward) and 25 October 2026 (back).
    let date = '2026-03-19'
    const seen: string[] = []
    for (let i = 0; i < 3; i++) {
      seen.push(toLocal(zonedToMillis(date, '19:00', LONDON).ms, LONDON).time)
      date = nextDate(date, 'weekly')
    }
    date = '2026-10-15'
    for (let i = 0; i < 3; i++) {
      seen.push(toLocal(zonedToMillis(date, '19:00', LONDON).ms, LONDON).time)
      date = nextDate(date, 'weekly')
    }
    expect(seen).toEqual(Array(6).fill('19:00'))
    expect(nextDate('2026-03-26', 'weekly')).toBe('2026-04-02')
    expect(nextDate('2026-10-22', 'weekly')).toBe('2026-10-29')
  })

  it('moves a time skipped by the spring change to just after it, and says so', () => {
    const r = zonedToMillis('2026-03-29', '01:30', LONDON)
    expect(r.exact).toBe(false)
    expect(toLocal(r.ms, LONDON).time).toBe('02:30')
  })

  it('formats offsets and parses local and offset times', () => {
    expect(isoInZone(Date.parse('2026-07-01T17:00:00Z'), LONDON)).toBe('2026-07-01T18:00:00+01:00')
    expect(parseWhen('2026-07-01T18:00', LONDON)?.ms).toBe(Date.parse('2026-07-01T17:00:00Z'))
    expect(parseWhen('2026-07-01T18:00:00Z', LONDON)?.time).toBe('19:00')
    expect(parseWhen('tomorrow 6pm', LONDON)).toBeNull()
    expect(validDate('2026-02-30')).toBe(false)
  })
})
