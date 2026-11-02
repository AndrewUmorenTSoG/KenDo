// Times on the day timeline, in minutes from midnight.

export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export const toClock = (minute: number) =>
  `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`

export const snap = (minute: number, step = 15) => Math.round(minute / step) * step

// A start time that keeps the whole task between `from` and `to`.
export const clampStart = (minute: number, length: number, from: number, to: number) =>
  Math.max(from, Math.min(minute, Math.max(from, to - length)))

interface Block {
  id: string
  time: string
  estimate: number
}

// The earliest start, on a 15-minute step after `after`, where the task fits without overlapping
// another timed task that day. Null when nothing fits before `dayEnd`.
export function nextGap(task: Block, others: Block[], after: number, dayEnd = 24 * 60) {
  const busy = others
    .filter((o) => o.id !== task.id && o.time)
    .map((o) => [toMinutes(o.time), toMinutes(o.time) + Math.max(1, o.estimate)] as const)
    .sort((a, b) => a[0] - b[0])
  const length = Math.max(1, task.estimate)
  let start = Math.ceil(after / 15) * 15
  for (const [s, e] of busy) {
    if (start + length <= s) break
    if (e > start) start = Math.ceil(e / 15) * 15
  }
  return start + length <= dayEnd ? start : null
}
