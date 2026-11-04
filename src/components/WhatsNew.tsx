import { useRef, useState } from 'react'
import Icon from './Icon'

const VERSION = '2026-11-04'

type SlideKind = 'timeline' | 'search' | 'plan' | 'rhythm' | 'connect'

const slides: { kind: SlideKind; icon: 'calendar' | 'search' | 'clock' | 'sun' | 'team'; eyebrow: string; title: string; body: string }[] = [
  { kind: 'timeline', icon: 'calendar', eyebrow: 'A bigger, calmer KenDo', title: 'Your day now has a rhythm.', body: 'Plan on a visual timeline, move tasks with a drag and see your whole day at a glance.' },
  { kind: 'search', icon: 'search', eyebrow: 'Find it, fast', title: 'Search and Inbox are here.', body: 'Search tasks, notes, projects, tags and dates. Keep quick ideas in Inbox until you are ready to place them.' },
  { kind: 'plan', icon: 'clock', eyebrow: 'Plans can change', title: 'Replan without the guilt.', body: 'Missed something? Move it, reschedule it, send it to Inbox or let it go. Every change has Undo.' },
  { kind: 'rhythm', icon: 'sun', eyebrow: 'Plan for real life', title: 'Make a day that fits you.', body: 'Month view, flexible repeats, day types, energy-aware planning and a more useful weekly review.' },
  { kind: 'connect', icon: 'team', eyebrow: 'Your tools, together', title: 'Connected, with your say-so.', body: 'Link notes to tasks and use KenDo with ChatGPT, Copilot or Claude. KenDo previews changes before anything is added.' },
]

function Artwork({ kind }: { kind: SlideKind }) {
  if (kind === 'timeline') return <div className="release-art release-timeline" aria-hidden="true"><div className="release-orb" /><div className="release-phone"><div className="release-phone-head"><i /><span>Tuesday, 4 Nov</span></div><div className="release-time"><span>09</span><b /><em>Plan dissertation</em></div><div className="release-time"><span>11</span><b /><em>Reply to emails</em></div><div className="release-time done"><span>14</span><b /><em>Gym session</em></div></div><span className="release-float float-check"><Icon name="check" /></span><span className="release-float float-clock"><Icon name="clock" /></span></div>
  if (kind === 'search') return <div className="release-art release-search" aria-hidden="true"><div className="search-window"><div className="search-input"><Icon name="search" /><span>Find anything…</span><kbd>⌘ K</kbd></div><div className="search-result"><span className="result-icon pink"><Icon name="calendar" /></span><div><b>Submit course work</b><small>Task · Friday</small></div></div><div className="search-result"><span className="result-icon sage"><Icon name="note" /></span><div><b>Project research notes</b><small>Note · 3 matches</small></div></div><div className="search-result"><span className="result-icon yellow"><Icon name="team" /></span><div><b>University</b><small>Project</small></div></div></div><span className="inbox-label"><Icon name="inbox" /> Inbox</span></div>
  if (kind === 'plan') return <div className="release-art release-plan" aria-hidden="true"><div className="replan-card"><div className="replan-title"><span><Icon name="clock" /></span><div><b>A little reset</b><small>What should we do with this?</small></div></div><div className="replan-task">Finish presentation <i>45 min</i></div><div className="replan-actions"><button>Tomorrow</button><button>Inbox</button><button className="replan-done"><Icon name="check" /></button></div></div><span className="release-float float-undo">↶ Undo</span></div>
  if (kind === 'rhythm') return <div className="release-art release-rhythm" aria-hidden="true"><div className="month-mini"><div><b>November</b><span>Month view</span></div><section>{Array.from({ length: 21 }, (_, i) => <i key={i} className={i === 9 || i === 10 || i === 16 ? 'marked' : ''}>{i + 1}</i>)}</section></div><div className="energy-card"><span>Energy</span><div><i /><i /><i className="on" /></div><b>High focus</b></div><span className="release-float float-repeat">↻ Repeat</span></div>
  return <div className="release-art release-connect" aria-hidden="true"><div className="connect-hub"><span className="hub-logo"><Icon name="check" /></span><b>KenDo</b><small>Your plan, your call</small></div><span className="tool-bubble chatgpt">ChatGPT</span><span className="tool-bubble copilot">Copilot</span><span className="tool-bubble claude">Claude</span><svg className="connect-lines" viewBox="0 0 320 180"><path d="M160 92C103 65 75 51 48 45M160 92c56-25 86-35 116-41M160 92c5 44 25 57 64 70" /></svg></div>
}

export default function WhatsNew({ uid }: { uid: string }) {
  const storageKey = 'kendo-whats-new-' + uid + '-' + VERSION
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) !== 'seen')
  const [slide, setSlide] = useState(0)
  const pointerStart = useRef<number | null>(null)
  if (!open) return null

  const close = () => { localStorage.setItem(storageKey, 'seen'); setOpen(false) }
  const go = (index: number) => setSlide(Math.max(0, Math.min(slides.length - 1, index)))
  const next = () => slide === slides.length - 1 ? close() : go(slide + 1)
  const previous = () => go(slide - 1)
  const onPointerUp = (x: number) => {
    if (pointerStart.current === null) return
    const distance = x - pointerStart.current
    if (Math.abs(distance) > 40) distance < 0 ? next() : previous()
    pointerStart.current = null
  }
  const current = slides[slide]

  return <div className="whats-new-backdrop" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
    <section className="whats-new-card release-card" onPointerDown={event => { pointerStart.current = event.clientX }} onPointerUp={event => onPointerUp(event.clientX)}>
      <button className="whats-new-close" aria-label="Close what's new" onClick={close}><Icon name="close" /></button>
      <Artwork key={current.kind} kind={current.kind} />
      <div className="release-copy">
        <span className="eyebrow">{current.eyebrow}</span>
        <h2 id="whats-new-title">{current.title}</h2>
        <p>{current.body}</p>
      </div>
      <div className="whats-new-dots" aria-label={'Slide ' + (slide + 1) + ' of ' + slides.length}>
        {slides.map((item, index) => <button key={item.kind} type="button" aria-label={'Go to slide ' + (index + 1)} aria-current={index === slide ? 'step' : undefined} className={index === slide ? 'active' : ''} onClick={() => go(index)} />)}
      </div>
      <div className="whats-new-actions">
        <button className="text-btn" onClick={close}>Not now</button>
        <div className="release-nav">
          <button className="release-previous" type="button" aria-label="Previous update" disabled={slide === 0} onClick={previous}>‹</button>
          <button className="btn primary" onClick={next}>{slide === slides.length - 1 ? 'Let’s go' : 'Next'} <Icon name="chevron" /></button>
        </div>
      </div>
    </section>
  </div>
}
