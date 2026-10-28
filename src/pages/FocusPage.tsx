import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, PageHeading, Segmented } from '../components/bits'
import Icon from '../components/Icon'
import { TaskList } from '../components/TaskRow'
import { useStore } from '../data/store'
import { priorityRank } from '../data/tasks'
import { formatTimer, useFocusTimer, type TimerMode } from '../hooks/useFocusTimer'
import { useTaskActions } from '../hooks/useTaskActions'
import { useUI } from '../hooks/useUI'
import { todayKey } from '../lib/dates'
import { pickVerse } from '../lib/verses'

export default function FocusPage() {
  const { tasks, sessions, profile } = useStore()
  const timer = useFocusTimer()
  const { complete } = useTaskActions()
  const { toast } = useUI()
  const navigate = useNavigate()

  const open = tasks
    .filter((t) => t.status !== 'done')
    .sort(
      (a, b) =>
        Number(b.date === todayKey()) - Number(a.date === todayKey()) || priorityRank[a.priority] - priorityRank[b.priority],
    )
  const currentId = open.some((t) => t.id === timer.taskId) ? timer.taskId : (open[0]?.id ?? '')
  const current = open.find((t) => t.id === currentId)
  const todaySessions = sessions.filter((s) => s.date === todayKey()).length

  // A fresh verse whenever a session starts or the mode changes; restful ones during breaks.
  const resting = timer.mode !== 'focus'
  const [verse, setVerse] = useState(() => pickVerse(resting))
  useEffect(() => {
    if (timer.running) setVerse((v) => pickVerse(resting, v))
  }, [timer.running, resting])
  useEffect(() => setVerse((v) => pickVerse(resting, v)), [resting])

  return (
    <>
      <PageHeading
        eyebrow="FOCUS ROOM"
        title="One thing. Your full attention."
        sub="A quiet place to make a little progress."
        actions={
          <button className="btn" onClick={() => navigate('/')}>
            Back to my day
          </button>
        }
      />
      <div className="focus-layout">
        <section className="focus-stage">
          <Segmented<TimerMode>
            options={[
              ['focus', 'Focus · 25 min'],
              ['short', 'Break · 5 min'],
              ['long', 'Rest · 15 min'],
            ]}
            value={timer.mode}
            onChange={(mode) => !timer.setMode(mode) && toast('Pause the timer before switching modes.')}
          />
          <div className="timer-ring">
            <div className="timer-value" role="timer" aria-label="Time remaining">
              {formatTimer(timer.remaining)}
            </div>
            <p>{timer.running ? 'You’re exactly where you need to be.' : 'Take a breath. Find your rhythm.'}</p>
          </div>
          {profile.verses && timer.running && (
            <p className="focus-verse">
              “{verse.text}” <span>{verse.ref}</span>
            </p>
          )}
          <div className="focus-task">
            <div className="eyebrow" style={{ marginBottom: 9 }}>
              YOUR ONE THING
            </div>
            <select
              aria-label="Choose a task to focus on"
              disabled={timer.running}
              value={currentId}
              onChange={(e) => timer.setTaskId(e.target.value)}
            >
              {open.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
              {!open.length && <option value="">Open focus session</option>}
            </select>
          </div>
          <div className="focus-controls">
            <button
              className="btn primary"
              onClick={() => {
                if (!timer.running && currentId !== timer.taskId) timer.setTaskId(currentId)
                timer.toggle()
              }}
            >
              <Icon name={timer.running ? 'pause' : 'play'} />
              {timer.running ? 'Pause session' : 'Start session'}
            </button>
            <IconButton label="Reset timer" icon="reset" onClick={timer.reset} />
          </div>
          <button className="text-btn" disabled={!current} onClick={() => current && complete(current)}>
            Mark task complete
          </button>
          <div className="session-dots">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} style={{ opacity: i < todaySessions ? 1 : 0.25 }} />
            ))}
          </div>
          <p className="muted tiny">{todaySessions} focus sessions completed today</p>
        </section>
        <aside className="stack focus-aside">
          <section className="panel">
            <div className="eyebrow">{resting ? 'REST A WHILE' : 'A WORD FOR THIS SESSION'}</div>
            {/* While a session runs, the verse sits under the timer instead. */}
            {profile.verses && !timer.running ? (
              <>
                <p className="quote">“{verse.text}”</p>
                <div className="row between">
                  <p className="tiny muted">{verse.ref} · KJV</p>
                  <button className="text-btn" onClick={() => setVerse((v) => pickVerse(resting, v))}>
                    Another verse
                  </button>
                </div>
                <div className="divider" />
              </>
            ) : null}
            <p className="small muted">You don’t need to rush. Give one thing your attention, then take a real break.</p>
          </section>
          <section className="panel">
            <div className="panel-title">
              <h2>Your focus queue</h2>
              <Icon name="inbox" />
            </div>
            <TaskList tasks={open.slice(0, 3)} />
          </section>
        </aside>
      </div>
    </>
  )
}
