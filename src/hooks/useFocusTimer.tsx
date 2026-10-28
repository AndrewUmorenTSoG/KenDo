import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { logFocusSession } from '../data/habits'
import { useStore } from '../data/store'
import { todayKey } from '../lib/dates'
import { useUI } from './useUI'

export type TimerMode = 'focus' | 'short' | 'long'
export const modeSeconds: Record<TimerMode, number> = { focus: 1500, short: 300, long: 900 }

interface Timer {
  mode: TimerMode
  remaining: number
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
  const { uid, tasks } = useStore()
  const { toast } = useUI()
  const [mode, setModeState] = useState<TimerMode>('focus')
  const [remaining, setRemaining] = useState(modeSeconds.focus)
  const [running, setRunning] = useState(false)
  const [taskId, setTaskId] = useState('')
  const end = useRef(0)
  const latest = useRef({ mode, taskId, tasks })
  latest.current = { mode, taskId, tasks }

  useEffect(() => {
    if (!running) return
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((end.current - Date.now()) / 1000))
      setRemaining(left)
      if (left > 0) return
      setRunning(false)
      const { mode, taskId, tasks } = latest.current
      if (mode === 'focus') {
        const task = tasks.find((t) => t.id === taskId)
        logFocusSession(uid, { date: todayKey(), minutes: 25, taskId: taskId || null, projectId: task?.projectId ?? null })
      }
      const message =
        mode === 'focus' ? 'A little progress made. Time for a real break.' : 'Break complete. Ready for the next small step?'
      toast(message)
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('KenDo', { body: message, icon: '/pwa-192.png' })
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [running, uid, toast])

  const value: Timer = {
    mode,
    remaining,
    running,
    taskId,
    setTaskId,
    setMode: (next) => {
      if (running) return false
      setModeState(next)
      setRemaining(modeSeconds[next])
      return true
    },
    toggle: () => {
      if (running) {
        setRemaining(Math.max(0, Math.ceil((end.current - Date.now()) / 1000)))
        setRunning(false)
      } else {
        const seconds = remaining === 0 ? modeSeconds[mode] : remaining
        setRemaining(seconds)
        end.current = Date.now() + seconds * 1000
        setRunning(true)
      }
    },
    reset: () => {
      setRunning(false)
      setRemaining(modeSeconds[mode])
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
