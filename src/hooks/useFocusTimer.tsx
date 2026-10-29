import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { logFocusSession } from '../data/habits'
import { updateProfile, useStore } from '../data/store'
import { todayKey } from '../lib/dates'
import { pickVerse } from '../lib/verses'
import { useUI } from './useUI'

export type TimerMode = 'focus' | 'short' | 'long'
export const modeLimits: Record<TimerMode, [min: number, max: number]> = { focus: [5, 90], short: [1, 30], long: [5, 60] }
const profileKey = { focus: 'focusMinutes', short: 'breakMinutes', long: 'restMinutes' } as const

interface Timer {
  mode: TimerMode
  remaining: number
  // Full length of the current mode, in seconds.
  total: number
  minutes: Record<TimerMode, number>
  setMinutes: (mode: TimerMode, minutes: number) => void
  running: boolean
  taskId: string
  setTaskId: (id: string) => void
  setMode: (mode: TimerMode) => boolean
  toggle: () => void
  reset: () => void
}

const TimerContext = createContext<Timer | null>(null)

// Lives above the routes so a session keeps running while Kenny moves around the app.
export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const { uid, tasks, profile } = useStore()
  const { toast } = useUI()
  const minutes: Record<TimerMode, number> = {
    focus: profile.focusMinutes,
    short: profile.breakMinutes,
    long: profile.restMinutes,
  }
  const seconds = (m: TimerMode) => minutes[m] * 60
  const [mode, setModeState] = useState<TimerMode>('focus')
  const [remaining, setRemaining] = useState(seconds('focus'))
  const [running, setRunning] = useState(false)
  const [taskId, setTaskId] = useState('')
  const end = useRef(0)
  // When a length changes (or the profile arrives after launch), an idle timer follows it.
  const total = seconds(mode)
  const lastTotal = useRef(total)
  useEffect(() => {
    if (!running && remaining === lastTotal.current) setRemaining(total)
    lastTotal.current = total
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])
  const latest = useRef({ mode, taskId, tasks, verses: profile.verses, length: minutes.focus })
  latest.current = { mode, taskId, tasks, verses: profile.verses, length: minutes[mode] }

  useEffect(() => {
    if (!running) return
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((end.current - Date.now()) / 1000))
      setRemaining(left)
      if (left > 0) return
      setRunning(false)
      const { mode, taskId, tasks, verses, length } = latest.current
      if (mode === 'focus') {
        const task = tasks.find((t) => t.id === taskId)
        logFocusSession(uid, { date: todayKey(), minutes: length, taskId: taskId || null, projectId: task?.projectId ?? null })
      }
      const message =
        mode === 'focus' ? 'A little progress made. Time for a real break.' : 'Break complete. Ready for the next small step?'
      toast(message)
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        // Finishing focus leads into a break, so offer a restful verse; finishing a break, an encouraging one.
        const verse = verses ? pickVerse(mode === 'focus') : null
        const body = verse ? `${message}\n“${verse.text}” ${verse.ref}` : message
        new Notification('KenDo', { body, icon: '/pwa-192.png' })
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [running, uid, toast])

  const value: Timer = {
    mode,
    remaining,
    total,
    minutes,
    setMinutes: (m, value) => updateProfile(uid, { [profileKey[m]]: value }),
    running,
    taskId,
    setTaskId,
    setMode: (next) => {
      if (running) return false
      setModeState(next)
      setRemaining(seconds(next))
      return true
    },
    toggle: () => {
      if (running) {
        setRemaining(Math.max(0, Math.ceil((end.current - Date.now()) / 1000)))
        setRunning(false)
      } else {
        const left = remaining === 0 ? seconds(mode) : remaining
        setRemaining(left)
        end.current = Date.now() + left * 1000
        setRunning(true)
      }
    },
    reset: () => {
      setRunning(false)
      setRemaining(seconds(mode))
    },
  }
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useFocusTimer() {
  const timer = useContext(TimerContext)
  if (!timer) throw new Error('useFocusTimer must be used inside FocusTimerProvider')
  return timer
}

export const formatTimer = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
