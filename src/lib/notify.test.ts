import { describe, expect, it } from 'vitest'
import { eveningMessage, inQuietHours, morningMessage, notifyPrefs, slotDue, wantsTaskReminder } from './notify'

const today = '2026-11-02'
const t = (title: string, date: string, extra = {}) => ({ title, date, status: 'todo' as const, priority: 'medium' as const, important: false, time: '', ...extra })

describe('notifications', () => {
  it('starts with only task reminders on', () => {
    const p = notifyPrefs(undefined)
    expect(p.taskStart).toBe(true)
    expect([p.morning, p.evening, p.overdue, p.deadlines, p.quiet]).toEqual([false, false, false, false, false])
  })

  it('knows quiet hours, including across midnight', () => {
    const night = { quiet: true, quietFrom: '22:00', quietTo: '07:00' }
    expect(inQuietHours(23 * 60, night)).toBe(true)
    expect(inQuietHours(6 * 60 + 59, night)).toBe(true)
    expect(inQuietHours(7 * 60, night)).toBe(false)
    expect(inQuietHours(13 * 60, { quiet: true, quietFrom: '13:00', quietTo: '14:00' })).toBe(true)
    expect(inQuietHours(23 * 60, { ...night, quiet: false })).toBe(false)
  })

  it('filters task reminders by priority when asked', () => {
    const only = notifyPrefs({ importantOnly: true })
    expect(wantsTaskReminder({ priority: 'medium', important: false }, only)).toBe(false)
    expect(wantsTaskReminder({ priority: 'high', important: false }, only)).toBe(true)
    expect(wantsTaskReminder({ priority: 'low', important: true }, only)).toBe(true)
    expect(wantsTaskReminder({ priority: 'high', important: true }, notifyPrefs({ taskStart: false }))).toBe(false)
  })

  it('sends a daily message once, within two hours of its time', () => {
    expect(slotDue(8 * 60, '08:00', undefined, today)).toBe(true)
    expect(slotDue(8 * 60, '08:00', today, today)).toBe(false)
    expect(slotDue(10 * 60 + 5, '08:00', undefined, today)).toBe(false)
    expect(slotDue(7 * 60 + 55, '08:00', undefined, today)).toBe(false)
  })

  it('writes a calm morning plan with only what was asked for', () => {
    const tasks = [
      t('Call Pooks', today, { time: '18:00' }),
      t('Have quiet time', today, { time: '06:30' }),
      t('Read', today),
      t('Old one', '2026-10-30'),
      t('Exam', '2026-11-03', { priority: 'high' }),
      t('Done', today, { status: 'done' }),
    ]
    const all = notifyPrefs({ morning: true, overdue: true, deadlines: true })
    expect(morningMessage(tasks, today, all, 'Ama')).toEqual({
      title: 'Good morning, Ama',
      body: '3 things planned today: Have quiet time, Call Pooks and 1 more. One task from earlier days could use a new plan. Coming up tomorrow: Exam.',
    })
    expect(morningMessage(tasks, today, notifyPrefs({ deadlines: true }), 'Ama')?.body).toBe('Coming up tomorrow: Exam.')
    expect(morningMessage([], today, notifyPrefs({ deadlines: true }), '')).toBeNull()
  })

  it('looks back gently in the evening', () => {
    const on = notifyPrefs({ evening: true })
    expect(eveningMessage([t('A', today, { status: 'done' }), t('B', today)], today, on)?.body).toBe(
      'You finished 1 today. One is still open; you can move it to tomorrow.',
    )
    expect(eveningMessage([], today, on)?.body).toMatch(/^How did today go/)
    expect(eveningMessage([], today, notifyPrefs({}))).toBeNull()
  })
})
