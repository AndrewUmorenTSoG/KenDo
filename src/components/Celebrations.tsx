import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { updateProfile, useStore } from '../data/store'
import { CELEBRATE, type Celebration } from '../lib/celebrate'
import { shift, todayKey } from '../lib/dates'


const colours = ['#e93d82', '#f7b733', '#2fb36b', '#3b82f6', '#8e4ec6', '#f17b2c', '#12a594', '#ffd700']
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

function Confetti({ count, seconds }: { count: number; seconds: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * seconds * 0.25,
      duration: seconds * (0.6 + Math.random() * 0.35),
      colour: pick(colours),
      spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 720),
      drift: (Math.random() - 0.5) * 30,
      round: Math.random() < 0.3,
    })),
  )
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={p.round ? 'round' : ''}
          style={
            {
              left: `${p.left}%`,
              background: p.colour,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--spin': `${p.spin}deg`,
              '--drift': `${p.drift}vw`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

function Fireworks() {
  const [bursts] = useState(() =>
    Array.from({ length: 9 }, (_, i) => ({
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 45,
      delay: i * 0.55,
      colour: pick(colours),
    })),
  )
  return (
    <div className="fireworks" aria-hidden="true">
      {bursts.map((b, i) => (
        <div key={i} className="burst" style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${b.delay}s` }}>
          {Array.from({ length: 14 }, (_, j) => (
            <span
              key={j}
              style={
                { background: b.colour, animationDelay: `${b.delay}s`, '--angle': `${(360 / 14) * j}deg` } as React.CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// Morning score, the 100th task and the 1000th: mounted once in the layout.
export default function Celebrations() {
  const { uid, tasks, profile, loading } = useStore()
  const [shown, setShown] = useState<Celebration | null>(null)
  const [params, setParams] = useSearchParams()
  const recapped = useRef('')
  // Wait for the opening splash (LoginEntrance) to finish before showing anything.
  const [afterSplash, setAfterSplash] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setAfterSplash(true), 2400)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const listener = (e: Event) => setShown((e as CustomEvent<Celebration>).detail)
    window.addEventListener(CELEBRATE, listener)
    return () => window.removeEventListener(CELEBRATE, listener)
  }, [])

  // ?celebrate=recap, 100 or 1000 previews a celebration.
  useEffect(() => {
    const preview = params.get('celebrate')
    if (!preview) return
    setShown(preview === '1000' ? { kind: 'thousand' } : preview === '100' ? { kind: 'hundred' } : { kind: 'recap', percent: 90 })
    params.delete('celebrate')
    setParams(params, { replace: true })
  }, [params, setParams])

  // Once a day, yesterday's score. Celebrated when 80% or more of yesterday's own tasks got done.
  useEffect(() => {
    if (loading || !profile.seeded) return
    const today = todayKey()
    if (profile.lastRecap === today || recapped.current === today) return
    recapped.current = today
    updateProfile(uid, { lastRecap: today })
    const planned = tasks.filter((t) => t.uid === uid && t.date === shift(today, -1))
    const percent = planned.length ? Math.round((planned.filter((t) => t.status === 'done').length / planned.length) * 100) : 0
    if (percent >= 80 && profile.celebrations) setShown({ kind: 'recap', percent })
  }, [loading, profile.seeded, profile.lastRecap, profile.celebrations, tasks, uid])

  // Starts the lifetime count from tasks already done, once.
  useEffect(() => {
    if (loading || !profile.seeded || profile.completedTotal !== undefined) return
    updateProfile(uid, { completedTotal: tasks.filter((t) => t.uid === uid && t.status === 'done').length })
  }, [loading, profile.seeded, profile.completedTotal, tasks, uid])

  useEffect(() => {
    if (!shown || !afterSplash || shown.kind === 'thousand') return
    const timer = setTimeout(() => setShown(null), shown.kind === 'recap' ? 2300 : 3500)
    return () => clearTimeout(timer)
  }, [shown, afterSplash])

  useEffect(() => {
    if (shown?.kind === 'thousand') navigator.vibrate?.([120, 80, 120, 80, 400])
  }, [shown])

  if (!shown || !afterSplash) return null
  const name = profile.name.split(' ')[0]

  if (shown.kind === 'thousand')
    return (
      <div className="surprise" role="dialog" aria-modal="true" aria-label="1000 tasks completed">
        <Fireworks />
        <Confetti count={220} seconds={6} />
        <div className="surprise-card">
          <p className="surprise-eyebrow">{name ? `${name}, you did it` : 'You did it'}</p>
          <h2 className="surprise-number">1,000</h2>
          <p className="surprise-title">tasks completed</p>
          <blockquote>
            “Well done, thou good and faithful servant: thou hast been faithful over a few things, I will make thee ruler
            over many things: enter thou into the joy of thy lord.”
            <cite>Matthew 25:21</cite>
          </blockquote>
          <button className="btn primary" onClick={() => setShown(null)}>
            Thank you, Lord 🙌
          </button>
        </div>
      </div>
    )

  return (
    <div className="celebration" role="status">
      <Confetti count={shown.kind === 'recap' ? 110 : 160} seconds={shown.kind === 'recap' ? 2.3 : 3.5} />
      <div className="celebration-card">
        {shown.kind === 'recap' ? (
          <>
            <span className="celebration-emoji">🎉</span>
            <p>Yesterday, you completed {shown.percent}% of your tasks.</p>
          </>
        ) : (
          <>
            <span className="celebration-big">100</span>
            <p>{name ? `${name}, that’s` : 'That’s'} 100 tasks done!</p>
          </>
        )}
      </div>
    </div>
  )
}
