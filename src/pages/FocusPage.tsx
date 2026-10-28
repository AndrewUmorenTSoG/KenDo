import { useEffect, useState } from 'react'
import { toggleTask, useTasks } from '../data/tasks'
import { useUid } from '../hooks/useAuth'

const WORK = 25 * 60
const BREAK = 5 * 60
const priorityRank = { high: 0, medium: 1, low: 2 }

// Focus mode: one task on screen with a Pomodoro timer.
export default function FocusPage() {
  const uid = useUid()
  const { items: tasks } = useTasks(uid)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'work' | 'break'>('work')
  const [secondsLeft, setSecondsLeft] = useState(WORK)
  const [running, setRunning] = useState(false)

  const open = tasks
    .filter((t) => !t.done)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
  const current = open.find((t) => t.id === taskId) ?? open[0]

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (secondsLeft > 0) return
    const next = phase === 'work' ? 'break' : 'work'
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(next === 'break' ? 'Time for a break' : 'Back to it', { icon: '/pwa-192.png' })
    }
    setPhase(next)
    setSecondsLeft(next === 'work' ? WORK : BREAK)
  }, [secondsLeft, phase])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <section className="stack focus">
      <p className="eyebrow">{phase === 'work' ? 'Focus' : 'Break'}</p>
      {current ? (
        <>
          <h1>{current.title}</h1>
          {current.estimateMinutes && <p className="muted">Estimated {current.estimateMinutes} minutes</p>}
        </>
      ) : (
        <h1>Nothing left to do. Nice.</h1>
      )}
      <div className="timer" aria-live="polite">
        {mm}:{ss}
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => setRunning(!running)}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          className="btn"
          onClick={() => {
            setRunning(false)
            setPhase('work')
            setSecondsLeft(WORK)
          }}
        >
          Reset
        </button>
        {current && (
          <button className="btn soft" onClick={() => toggleTask(uid, current)}>
            Done
          </button>
        )}
      </div>
      {open.length > 1 && (
        <label>
          Switch task
          <select value={current?.id} onChange={(e) => setTaskId(e.target.value)}>
            {open.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  )
}
