import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { isBlocked } from '../data/tasks'
import { useFocusTimer } from '../hooks/useFocusTimer'
import { useUI } from '../hooks/useUI'
import { fmt, todayKey } from '../lib/dates'
import { fitsNow } from '../lib/energy'
import type { Energy } from '../lib/types'
import { IconButton, Segmented } from './bits'

const times: [string, string][] = [
  ['10', '10m'],
  ['20', '20m'],
  ['30', '30m'],
  ['60', '1h'],
]
const energies: [Energy, string][] = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
]

// "What could I do with 20 minutes and low energy?" Three useful answers from the task list.
export default function FitsNow() {
  const { tasks } = useStore()
  const { open, toast } = useUI()
  const timer = useFocusTimer()
  const navigate = useNavigate()
  const [minutes, setMinutes] = useState('20')
  const [energy, setEnergy] = useState<Energy>('low')
  const today = todayKey()
  const ideas = fitsNow(tasks, Number(minutes), energy, today, (t) => isBlocked(t, tasks)).slice(0, 3)

  function focusOn(id: string) {
    if (timer.running) toast('Pause your current focus session before changing tasks.')
    else timer.setTaskId(id)
    navigate('/focus')
  }

  return (
    <section className="panel fits-now" aria-labelledby="fits-now-title">
      <div className="panel-title">
        <h2 id="fits-now-title">Got a few minutes?</h2>
      </div>
      <div className="fits-now-choices">
        <div role="group" aria-label="Time you have">
          <span className="fits-now-label">Time</span>
          <Segmented options={times} value={minutes} onChange={setMinutes} />
        </div>
        <div role="group" aria-label="Energy you have">
          <span className="fits-now-label">Energy</span>
          <Segmented options={energies} value={energy} onChange={setEnergy} />
        </div>
      </div>
      {ideas.map((t) => (
        <div key={t.id} className="fits-now-item">
          <button className="fits-now-name" onClick={() => open({ kind: 'task', id: t.id })}>
            <strong>{t.title}</strong>
            <span>
              {t.estimate} min · {!t.date ? 'Inbox' : t.date === today ? 'Today' : t.date < today ? 'From earlier' : fmt(t.date, { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </button>
          <IconButton label={`Focus on ${t.title}`} icon="play" onClick={() => focusOn(t.id)} />
        </div>
      ))}
      {!ideas.length && <p className="tiny muted">Nothing fits that just now. A rest counts too.</p>}
    </section>
  )
}
