import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, PageHeading, Segmented } from '../components/bits'
import Icon from '../components/Icon'
import { TaskList } from '../components/TaskRow'
import { useStore } from '../data/store'
import { priorityRank } from '../data/tasks'
import FocusFullscreen from '../components/FocusFullscreen'
import TimerDial from '../components/TimerDial'
import { formatTimer, modeLimits, useFocusTimer, type TimerMode } from '../hooks/useFocusTimer'
import { useTaskActions } from '../hooks/useTaskActions'
import { useUI } from '../hooks/useUI'
import { plural, todayKey } from '../lib/dates'
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
  const [fullscreen, setFullscreen] = useState(false)
  // The dial moves freely and saves when let go.
  const [draft, setDraft] = useState<number | null>(null)
  const length = draft ?? timer.minutes[timer.mode]
  const commit = () => draft !== null && timer.setMinutes(timer.mode, draft)
  // Keep showing the draft until the saved value catches up, then let go of it.
  useEffect(() => {
    if (draft === timer.minutes[timer.mode]) setDraft(null)
  }, [draft, timer.minutes, timer.mode])
  useEffect(() => setDraft(null), [timer.mode])
  const progress = 1 - timer.remaining / timer.total
  const [low, high] = modeLimits[timer.mode]

  function start() {
    if (!timer.running && currentId !== timer.taskId) timer.setTaskId(currentId)
    // Starting a focus session opens the full screen view.
    if (!timer.running && timer.mode === 'focus') setFullscreen(true)
    timer.toggle()
  }

  return (
    <>
      <PageHeading
        eyebrow="FOCUS ROOM"
        title="One thing. Your full attention."
        actions={
          <button className="btn" onClick={() => navigate('/')}>
            Back to my day
          </button>
        }
      />
      <div className="focus-layout">
        <section className={`focus-stage ${timer.mode}`}>
          <Segmented<TimerMode>
            options={[
              ['focus', `Focus · ${timer.minutes.focus} min`],
              ['short', `Break · ${timer.minutes.short} min`],
              ['long', `Rest · ${timer.minutes.long} min`],
            ]}
            value={timer.mode}
            onChange={(mode) => !timer.setMode(mode) && toast('Pause the timer before switching modes.')}
          />
          <TimerDial
            mode={timer.mode}
            progress={progress}
            running={timer.running}
            value={length}
            min={low}
            max={high}
            onChange={setDraft}
            onCommit={commit}
          >
            <div className="timer-face">
              <div className="timer-value" role="timer" aria-label="Time remaining">
                {draft !== null ? formatTimer(draft * 60) : formatTimer(timer.remaining)}
              </div>
            </div>
          </TimerDial>
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
            <button className="btn primary" onClick={start}>
              <Icon name={timer.running ? 'pause' : 'play'} />
              {timer.running ? 'Pause session' : 'Start session'}
            </button>
            <IconButton label="Reset timer" icon="reset" onClick={timer.reset} />
            <IconButton label="Full screen" icon="focus" onClick={() => setFullscreen(true)} />
          </div>
          <button className="text-btn" disabled={!current} onClick={() => current && complete(current)}>
            Mark task complete
          </button>
          <div className="session-dots">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} style={{ opacity: i < todaySessions ? 1 : 0.25 }} />
            ))}
          </div>
          <p className="muted tiny">{plural(todaySessions, 'focus session')} completed today</p>
        </section>
        <aside className="stack focus-aside">
          {profile.verses && (
            <section className="panel">
              <div className="eyebrow">{resting ? 'REST A WHILE' : 'A WORD FOR THIS SESSION'}</div>
              <p className="quote">“{verse.text}”</p>
              <div className="row between">
                <p className="tiny muted">{verse.ref} · KJV</p>
                <button className="text-btn" onClick={() => setVerse((v) => pickVerse(resting, v))}>
                  Another verse
                </button>
              </div>
            </section>
          )}
          <section className="panel">
            <div className="panel-title">
              <h2>Your focus queue</h2>
              <Icon name="inbox" />
            </div>
            <TaskList tasks={open.slice(0, 3)} />
          </section>
        </aside>
      </div>
      {fullscreen && (
        <FocusFullscreen
          task={current?.title}
          verse={profile.verses ? verse : null}
          progress={progress}
          onToggle={start}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  )
}
