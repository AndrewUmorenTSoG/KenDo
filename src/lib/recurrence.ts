import { shift, shiftMonths, todayKey } from './dates'
import type { Repeat } from './types'

export const repeatLabels: Record<Repeat, string> = {
  never: 'Never',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export function nextDate(from: string, repeat: Repeat) {
  const base = from || todayKey()
  if (repeat === 'daily') return shift(base, 1)
  if (repeat === 'weekly') return shift(base, 7)
  if (repeat === 'monthly') return shiftMonths(base, 1)
  return base
}
