import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { plural, todayKey } from '../lib/dates'
import { inboxTasks, needsReview, weekKey } from '../lib/inbox'
import { missedTasks } from '../lib/replan'
import Icon from './Icon'

const LATER = 'kendo-inbox-later'

const read = () => {
  try {
    return localStorage.getItem(LATER)
  } catch {
    return null
  }
}

// A gentle suggestion on My day when the Inbox has grown. "Later" quiets it for the week.
// It waits its turn behind the Replan card, so My day never shows two at once.
export default function InboxPrompt() {
  const { tasks } = useStore()
  const navigate = useNavigate()
  const today = todayKey()
  const week = weekKey(today)
  const [later, setLater] = useState(read)
  const inbox = inboxTasks(tasks)
  if (later === week || !needsReview(inbox) || missedTasks(tasks, today).length) return null

  function notNow() {
    try {
      localStorage.setItem(LATER, week)
    } catch {
      // Without storage it simply shows again next time.
    }
    setLater(week)
  }

  return (
    <section className="replan-prompt inbox-prompt" aria-label="Review your Inbox">
      <div>
        <h2>{plural(inbox.length, 'thing')} waiting in your Inbox.</h2>
        <p>A few minutes now could clear some headspace.</p>
      </div>
      <div className="row">
        <button className="text-btn" onClick={notNow}>
          Later
        </button>
        <button className="btn primary" onClick={() => navigate('/inbox')}>
          <Icon name="inbox" />
          Review
        </button>
      </div>
    </section>
  )
}
