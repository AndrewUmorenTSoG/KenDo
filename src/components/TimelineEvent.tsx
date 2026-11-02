import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { taskColours } from '../data/tasks'
import { fmt } from '../lib/dates'
import { clampStart, snap, toClock } from '../lib/schedule'
import type { Task } from '../lib/types'
import Icon from './Icon'

interface Props {
  task: Task
  projectName: string
  start: number
  // Card size and lane, from the timeline layout.
  top: number
  height: number
  left: string
  width: string
  scale: number
  // The visible part of the day, in minutes.
  bounds: [number, number]
  onOpen: () => void
  onMove: (minute: number) => void
  onResize: (minutes: number) => void
  onMoveToDate: (date: string) => void
  onNextGap: () => void
  onHoverDate: (date: string | null) => void
}

type Gesture =
  | { kind: 'press'; x: number; y: number; touch: boolean; timer?: number; id: number }
  | { kind: 'move'; y: number; id: number; date: string | null }
  | { kind: 'resize'; y: number; id: number }

const THRESHOLD = 6
const HOLD = 350

// A task on the day timeline. Tap opens it; drag moves it in 15-minute steps (hold first on touch,
// so scrolling still works); the bottom edge changes its length; dropping on a day in the strip
// above moves it there. The ⋯ menu and Alt+arrow keys do the same without dragging.
export default function TimelineEvent(props: Props) {
  const { task, start, scale, bounds } = props
  const ref = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const justDragged = useRef(false)
  const [preview, setPreview] = useState<{ start?: number; estimate?: number; date?: string | null } | null>(null)
  // The menu is placed on the screen itself, so the timeline's scrolling edges can't cut it off.
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null)
  const done = task.status === 'done'

  // While dragging on touch, stop the page from scrolling under the finger.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const block = (e: TouchEvent) => {
      if (gesture.current && gesture.current.kind !== 'press') e.preventDefault()
    }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])

  // A tap anywhere else closes the menu.
  useEffect(() => {
    if (!menu) return
    const away = (e: Event) => !ref.current?.contains(e.target as Node) && setMenu(null)
    const shut = () => setMenu(null)
    document.addEventListener('pointerdown', away)
    window.addEventListener('scroll', shut, true)
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('scroll', shut, true)
    }
  }, [menu])

  const minuteFor = (dy: number) => clampStart(start + snap(dy / scale), task.estimate, bounds[0], bounds[1])

  function begin(e: PointerEvent, kind: 'move' | 'resize') {
    ref.current?.setPointerCapture(e.pointerId)
    gesture.current = kind === 'move' ? { kind, y: (gesture.current as { y: number }).y, id: e.pointerId, date: null } : { kind, y: e.clientY, id: e.pointerId }
    setMenu(null)
    navigator.vibrate?.(8)
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.day-event-menu, .day-event-more')) return
    const touch = e.pointerType === 'touch'
    const press: Gesture = { kind: 'press', x: e.clientX, y: e.clientY, touch, id: e.pointerId }
    if (touch) press.timer = window.setTimeout(() => {
      if (gesture.current === press) {
        begin(e, 'move')
        setPreview({ start })
      }
    }, HOLD)
    gesture.current = press
  }

  function onPointerMove(e: PointerEvent) {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    if (g.kind === 'press') {
      const moved = Math.hypot(e.clientX - g.x, e.clientY - g.y) > THRESHOLD
      if (!moved) return
      // On touch, moving before the hold means scrolling, not dragging.
      if (g.touch) return cancel()
      begin(e, 'move')
    }
    const now = gesture.current!
    const dy = e.clientY - now.y
    if (now.kind === 'resize') {
      const estimate = Math.max(15, Math.min(24 * 60 - start, snap(task.estimate + dy / scale)))
      setPreview({ estimate })
      return
    }
    if (now.kind === 'move') {
      const target = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((el) => el.closest<HTMLElement>('[data-drop-date]'))
        .find(Boolean)
      now.date = target?.dataset.dropDate ?? null
      props.onHoverDate(now.date)
      setPreview({ start: minuteFor(dy), date: now.date })
    }
  }

  function cancel() {
    const g = gesture.current
    if (g?.kind === 'press') clearTimeout(g.timer)
    gesture.current = null
    setPreview(null)
    props.onHoverDate(null)
  }

  function onPointerUp(e: PointerEvent) {
    const g = gesture.current
    if (!g || e.pointerId !== g.id) return
    if (g.kind === 'press') return cancel()
    const dy = e.clientY - g.y
    justDragged.current = true
    setTimeout(() => (justDragged.current = false), 0)
    if (g.kind === 'resize') {
      const estimate = Math.max(15, Math.min(24 * 60 - start, snap(task.estimate + dy / scale)))
      if (estimate !== task.estimate) props.onResize(estimate)
    } else if (g.date && g.date !== task.date) props.onMoveToDate(g.date)
    else {
      const minute = minuteFor(dy)
      if (minute !== start) props.onMove(minute)
    }
    cancel()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      props.onOpen()
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      props.onMove(clampStart(start + (e.key === 'ArrowUp' ? -15 : 15), task.estimate, bounds[0], bounds[1]))
    }
  }

  const shown = preview?.start ?? start
  const estimate = preview?.estimate ?? task.estimate
  const dragging = !!preview
  const accent = task.colour ? taskColours[task.colour] : 'var(--pink)'
  const style = {
    '--event-accent': accent,
    top: props.top + (shown - start) * scale,
    height: Math.max(props.height, preview?.estimate ? estimate * scale - 10 : 0),
    left: props.left,
    width: props.width,
  } as CSSProperties

  const item = (label: string, run: () => void) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setMenu(null)
        run()
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`${task.title}, ${task.time} for ${task.estimate} minutes. Alt and arrow keys move it by 15 minutes.`}
      className={`day-event ${done ? 'completed' : ''} ${dragging ? 'dragging' : ''} ${menu ? 'menu-open' : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancel}
      onContextMenu={(e) => gesture.current && e.preventDefault()}
      onClick={(e) => {
        if (justDragged.current || (e.target as HTMLElement).closest('.day-event-menu, .day-event-more')) return
        props.onOpen()
      }}
      onKeyDown={onKeyDown}
    >
      <span className="day-event-project">
        {props.projectName}
        {done && <Icon name="check" />}
      </span>
      <strong>{task.title}</strong>
      <span className="day-event-time">
        <Icon name="clock" />
        {dragging && preview?.date ? `Move to ${fmt(preview.date, { weekday: 'short', day: 'numeric', month: 'short' })}` : `${toClock(shown)} – ${toClock(shown + estimate)}`}
        {shown + estimate >= 1440 ? ' (+1 day)' : ''}
      </span>
      {!done && (
        <>
          <button
            type="button"
            className="day-event-more"
            aria-label={`Move ${task.title}`}
            aria-haspopup="menu"
            aria-expanded={!!menu}
            onClick={(e) => {
              if (menu) return setMenu(null)
              const r = e.currentTarget.getBoundingClientRect()
              setMenu({ top: Math.min(r.bottom + 4, window.innerHeight - 190), left: Math.max(8, Math.min(r.right - 170, window.innerWidth - 178)) })
            }}
          >
            ⋯
          </button>
          {menu && (
            <div className="day-event-menu" role="menu" style={menu} onKeyDown={(e) => e.key === 'Escape' && setMenu(null)}>
              {item('15 min earlier', () => props.onMove(clampStart(start - 15, task.estimate, bounds[0], bounds[1])))}
              {item('15 min later', () => props.onMove(clampStart(start + 15, task.estimate, bounds[0], bounds[1])))}
              {item('Next free gap', props.onNextGap)}
              {item('Edit details', props.onOpen)}
            </div>
          )}
          <span
            className="day-event-resize"
            aria-hidden="true"
            onPointerDown={(e) => {
              e.stopPropagation()
              if (e.button !== 0) return
              gesture.current = { kind: 'resize', y: e.clientY, id: e.pointerId }
              ref.current?.setPointerCapture(e.pointerId)
              setPreview({ estimate: task.estimate })
            }}
          />
        </>
      )}
    </div>
  )
}
