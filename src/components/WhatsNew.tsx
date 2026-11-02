import { useState } from 'react'
import Icon from './Icon'
import { enableNotifications } from '../lib/notifications'

const VERSION = '2026-11-02'

export default function WhatsNew({ uid }: { uid: string }) {
  const key = `kendo-whats-new-${uid}-${VERSION}`
  const [open, setOpen] = useState(() => localStorage.getItem(key) !== 'seen')
  const [slide, setSlide] = useState(0)
  const [busy, setBusy] = useState(false)
  if (!open) return null
  const close = () => { localStorage.setItem(key, 'seen'); setOpen(false) }
  const next = () => slide < 2 ? setSlide(slide + 1) : close()
  async function notifications() {
    setBusy(true)
    try { await enableNotifications(uid) } finally { setBusy(false); next() }
  }
  const slides = [
    { icon: 'calendar' as const, eyebrow: 'A calmer way to get things done', title: "What's new in KenDo?", body: 'A faster daily timeline, clearer task planning and a little more room to focus on what matters.' },
    { icon: 'team' as const, eyebrow: 'KenDo, wherever you work', title: 'Connect your tools', body: 'Link KenDo with ChatGPT or Copilot, and connect your Google or Outlook email when you want your plans in one place.' },
    { icon: 'bell' as const, eyebrow: 'Never miss what matters', title: 'Turn on notifications', body: 'KenDo can gently remind you about tasks and deadlines. You can change this anytime in Settings.' },
  ]
  const current = slides[slide]
  return <div className="whats-new-backdrop" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
    <section className="whats-new-card">
      <button className="whats-new-close" aria-label="Close what's new" onClick={close}><Icon name="close" /></button>
      <div className={`whats-new-art whats-new-art-${slide}`}><Icon name={current.icon} /></div>
      <span className="eyebrow">{current.eyebrow}</span>
      <h2 id="whats-new-title">{current.title}</h2>
      <p>{current.body}</p>
      <div className="whats-new-dots" aria-label={`Slide ${slide + 1} of 3`}>{slides.map((_, i) => <i key={i} className={i === slide ? 'active' : ''} />)}</div>
      <div className="whats-new-actions">
        <button className="text-btn" onClick={close}>Not now</button>
        {slide === 2 ? <button className="btn primary" disabled={busy} onClick={notifications}>{busy ? 'Setting up…' : 'Turn on notifications'}</button> : <button className="btn primary" onClick={next}>{slide === 0 ? 'Show me' : 'Next'}</button>}
      </div>
    </section>
  </div>
}
