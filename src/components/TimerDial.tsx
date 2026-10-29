import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

interface Props {
  mode: string
  // 0 to 1: how much of the session has passed while running.
  progress: number
  running: boolean
  value: number
  min: number
  max: number
  onChange: (minutes: number) => void
  onCommit: () => void
  children: ReactNode
}

// The timer ring doubles as a dial: while the timer is stopped, drag the knob around to set the length.
export default function TimerDial({ mode, progress, running, value, min, max, onChange, onCommit, children }: Props) {
  const ring = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const fraction = value / max

  function fromPointer(e: PointerEvent) {
    const box = ring.current!.getBoundingClientRect()
    const x = e.clientX - (box.left + box.width / 2)
    const y = e.clientY - (box.top + box.height / 2)
    const turn = ((Math.atan2(x, -y) / (2 * Math.PI)) + 1) % 1
    // Don't jump from full to empty (or back) when dragging past 12 o'clock.
    if (fraction > 0.75 && turn < 0.25) return onChange(max)
    if (fraction < 0.25 && turn > 0.75) return onChange(min)
    onChange(Math.min(max, Math.max(min, Math.round(turn * max))))
  }

  function key(e: KeyboardEvent) {
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    onChange(Math.min(max, Math.max(min, value + step)))
  }

  return (
    <div
      ref={ring}
      className={`timer-ring timer-dial ${mode} ${running ? '' : 'idle'}`}
      style={{ '--progress': running ? progress : fraction } as CSSProperties}
      role={running ? undefined : 'slider'}
      tabIndex={running ? undefined : 0}
      aria-label="Timer length in minutes"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} minutes`}
      onPointerDown={(e) => {
        if (running) return
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        fromPointer(e)
      }}
      onPointerMove={(e) => dragging.current && fromPointer(e)}
      onPointerUp={() => {
        if (!dragging.current) return
        dragging.current = false
        onCommit()
      }}
      onKeyDown={key}
      onKeyUp={onCommit}
      onBlur={onCommit}
    >
      {children}
      {!running && <span className="dial-knob" style={{ transform: `rotate(${fraction}turn)` }} />}
    </div>
  )
}
