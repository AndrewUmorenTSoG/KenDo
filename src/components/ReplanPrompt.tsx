import { useState } from 'react'
import { useStore } from '../data/store'
import { useUI } from '../hooks/useUI'
import { plural, shift, todayKey } from '../lib/dates'
import { missedHeading, missedTasks } from '../lib/replan'
import Icon from './Icon'

const LATER = 'kendo-replan-later'

const read = () => {
  try {
    return localStorage.getItem(LATER)
  } catch {
    return null
  }
}

// A quiet card on My day when tasks from past days are still open. "Not now" hides it until tomorrow.
export default function ReplanPrompt() {
  const { tasks } = useStore()
  const { open } = useUI()
  const today = todayKey()
  const [later, setLater] = useState(read)
  const missed = missedTasks(tasks, today)
  if (!missed.length || later === today) return null

  function notNow() {
    try {
      localStorage.setItem(LATER, today)
    } catch {
      // Without storage it simply shows again next time.
    }
    setLater(today)
  }

  return (
    <section className="replan-prompt" aria-label="Replan missed tasks">
      <div>
        <h2>{missedHeading(missed.map((t) => t.date), shift(today, -1))}</h2>
        <p>{plural(missed.length, 'task')} could use a new plan.</p>
      </div>
      <div className="row">
        <button className="text-btn" onClick={notNow}>
          Not now
        </button>
        <button className="btn primary" onClick={() => open({ kind: 'replan' })}>
          <Icon name="calendar" />
          Replan
        </button>
      </div>
    </section>
  )
}
