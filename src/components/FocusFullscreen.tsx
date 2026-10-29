import { useEffect, useRef, type CSSProperties } from 'react'
import { formatTimer, useFocusTimer } from '../hooks/useFocusTimer'
import type { Verse } from '../lib/verses'
import Icon from './Icon'

// Each leaf gets its own lane, size, speed and delay so they never fall in step.
const leaves = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 18 + ((i * 7) % 18),
  duration: 11 + ((i * 5) % 9),
  delay: -((i * 13) % 17),
}))

interface Props {
  task?: string
  verse: Verse | null
  progress: number
  onToggle: () => void
  onClose: () => void
}

// A calm, distraction-free view of the timer with leaves drifting down behind it.
export default function FocusFullscreen({ task, verse, progress, onToggle, onClose }: Props) {
  const timer = useFocusTimer()
  const root = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    // Real full screen where the browser allows it (not iPhone); the overlay covers the app either way.
    root.current?.requestFullscreen?.().catch(() => undefined)
    const left = () => !document.fullscreenElement && close.current()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    document.addEventListener('fullscreenchange', left)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('fullscreenchange', left)
      document.removeEventListener('keydown', esc)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  return (
    <div ref={root} className={`focus-full ${timer.mode}`} role="dialog" aria-label="Focus mode">
      <div className="leaves" aria-hidden="true">
        {leaves.map((l, i) => (
          <span
            key={i}
            style={
              {
                left: `${l.left}%`,
                width: l.size,
                height: l.size,
                animationDuration: `${l.duration}s, ${l.duration / 3}s`,
                animationDelay: `${l.delay}s, ${l.delay}s`,
              } as CSSProperties
            }
          >
            <Icon name="leaf" />
          </span>
        ))}
      </div>
      <button className="focus-full-close" onClick={onClose} aria-label="Exit full screen">
        <Icon name="close" />
      </button>
      <div className="focus-full-body">
        {task && <p className="focus-full-task">{task}</p>}
        <div className={`timer-ring ${timer.mode}`} style={{ '--progress': progress } as CSSProperties}>
          <div className="timer-face">
            <div className="timer-value" role="timer" aria-label="Time remaining">
              {formatTimer(timer.remaining)}
            </div>
          </div>
        </div>
        <button className="btn primary" onClick={onToggle}>
          <Icon name={timer.running ? 'pause' : 'play'} />
          {timer.running ? 'Pause' : 'Start'}
        </button>
        {verse && (
          <p className="focus-full-verse">
            “{verse.text}” <span>{verse.ref}</span>
          </p>
        )}
      </div>
    </div>
  )
}
