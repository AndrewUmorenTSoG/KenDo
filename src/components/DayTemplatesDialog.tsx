import { useEffect, useState } from 'react'
import { useCollection } from '../data/collection'
import {
  applyDayTemplate,
  createDayTemplate,
  deleteDayTemplate,
  restoreDayTemplate,
  saveDayTemplate,
  seedDayTemplates,
} from '../data/dayTemplates'
import { useStore } from '../data/store'
import { useUI } from '../hooks/useUI'
import { fmt, plural, todayKey } from '../lib/dates'
import { itemsFromDay, planApply, type ApplyMode, type DayTemplate, type TemplateItem } from '../lib/dayTemplates'
import Dialog from './Dialog'
import Icon from './Icon'

const modes: [ApplyMode, string, string][] = [
  ['merge', 'Fit it around my day', 'Skips anything already planned and moves clashes to the next free time.'],
  ['keep', 'Add everything', 'Keeps your tasks and adds all of these.'],
  ['replace', 'Start fresh', 'Open tasks on that day go to your Inbox. Nothing is deleted.'],
]

// Reusable day types: pick one, choose a date and how it meets what's already planned, then apply.
export default function DayTemplatesDialog({ date: initialDate }: { date?: string }) {
  const { uid, tasks, projects, profile } = useStore()
  const { close, toast } = useUI()
  const templates = useCollection<DayTemplate>(uid, 'dayTemplates')
  const [chosen, setChosen] = useState<string | null>(null)
  const [editing, setEditing] = useState<DayTemplate | null>(null)
  const [date, setDate] = useState(initialDate ?? todayKey())
  const [mode, setMode] = useState<ApplyMode>('merge')
  const list = [...templates.items].sort((a, b) => a.createdAt - b.createdAt)
  const template = list.find((t) => t.id === chosen)
  const dayTasks = tasks.filter((t) => t.date === date)
  const personal = projects.find((p) => p.name === 'Personal' && p.uid === uid)?.id ?? null

  useEffect(() => {
    if (!templates.loading && !templates.items.length && !profile.dayTypesSeeded) seedDayTemplates(uid).catch(() => undefined)
  }, [templates.loading, templates.items.length, profile.dayTypesSeeded, uid])

  if (editing) return <TemplateEditor template={editing} onDone={() => setEditing(null)} />

  function apply() {
    if (!template) return
    const { plan, undo } = applyDayTemplate(uid, template, date, dayTasks, mode, personal)
    close()
    const parts = [`${template.name} added to ${date === todayKey() ? 'today' : fmt(date, { weekday: 'long', day: 'numeric', month: 'short' })}.`]
    if (plan.toInbox.length) parts.push(`${plural(plan.toInbox.length, 'task')} moved to your Inbox.`)
    toast(parts.join(' '), { label: 'Undo', run: undo })
  }

  function saveDay() {
    const items = itemsFromDay(dayTasks)
    if (!items.length) return toast('Plan a few timed tasks on this day first.')
    createDayTemplate(uid, `My ${fmt(date, { weekday: 'long' })}`, items)
      .then((ref) => setEditing({ id: ref.id, name: `My ${fmt(date, { weekday: 'long' })}`, items, uid, createdAt: Date.now() }))
      .catch(() => toast('That didn’t save. Try again in a moment.'))
  }

  const preview = template ? planApply(template.items, dayTasks, mode) : null

  return (
    <Dialog title="Shape the day." onClose={close} className="day-types-dialog">
      <div className="field">
        <label htmlFor="dt-date">Day</label>
        <input id="dt-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </div>

      <div className="day-types" role="radiogroup" aria-label="Day type">
        {list.map((t) => (
          <div key={t.id} className={`day-type ${t.id === chosen ? 'chosen' : ''}`}>
            <button role="radio" aria-checked={t.id === chosen} onClick={() => setChosen(t.id)}>
              <strong>{t.name}</strong>
              <span>{plural(t.items.length, 'task')}</span>
            </button>
            <button className="icon-btn" aria-label={`Edit ${t.name}`} title="Edit" onClick={() => setEditing(t)}>
              <Icon name="edit" />
            </button>
          </div>
        ))}
        {templates.loading && <p className="tiny muted">Loading…</p>}
      </div>

      <div className="day-types-tools">
        <button
          className="text-btn"
          onClick={() =>
            createDayTemplate(uid, 'New day type', [])
              .then((ref) => setEditing({ id: ref.id, name: 'New day type', items: [], uid, createdAt: Date.now() }))
              .catch(() => undefined)
          }
        >
          <Icon name="plus" />
          New day type
        </button>
        <button className="text-btn" onClick={saveDay}>
          Save this day as a type
        </button>
      </div>

      {template && preview && (
        <>
          {dayTasks.some((t) => t.status !== 'done') && (
            <fieldset className="day-type-modes">
              <legend>This day already has {plural(dayTasks.filter((t) => t.status !== 'done').length, 'open task')}</legend>
              {modes.map(([value, label, sub]) => (
                <label key={value} className={mode === value ? 'chosen' : ''}>
                  <input type="radio" name="dt-mode" checked={mode === value} onChange={() => setMode(value)} />
                  <span>
                    <strong>{label}</strong>
                    <small>{sub}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <ul className="day-type-preview" aria-label="What will be added">
            {preview.create.map((it, i) => (
              <li key={i}>
                <span>{it.time || 'Any time'}</span>
                {it.title}
                {preview.moved.includes(it.title) && <em> · moved to fit</em>}
              </li>
            ))}
            {preview.skipped.map((title) => (
              <li key={title} className="skipped">
                <span>Skipped</span>
                {title} is already planned
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="dialog-footer">
        <button className="btn" onClick={close}>
          Cancel
        </button>
        <button className="btn primary" disabled={!template || !preview?.create.length && !preview?.toInbox.length} onClick={apply}>
          Apply
        </button>
      </div>
    </Dialog>
  )
}

// Rename a day type, change its tasks, or delete it (with Undo).
function TemplateEditor({ template, onDone }: { template: DayTemplate; onDone: () => void }) {
  const { uid } = useStore()
  const { toast } = useUI()
  const [name, setName] = useState(template.name)
  const [items, setItems] = useState<TemplateItem[]>(template.items)
  const update = (i: number, changes: Partial<TemplateItem>) => setItems(items.map((it, j) => (j === i ? { ...it, ...changes } : it)))

  function save() {
    const clean = items.filter((it) => it.title.trim()).map((it) => ({ ...it, title: it.title.trim(), estimate: Math.max(5, it.estimate || 25) }))
    saveDayTemplate(uid, { id: template.id, name: name.trim() || 'Day type', items: clean }).catch(() => undefined)
    onDone()
  }

  function remove() {
    deleteDayTemplate(uid, template.id).catch(() => undefined)
    onDone()
    toast(`${template.name} deleted.`, { label: 'Undo', run: () => restoreDayTemplate(uid, template) })
  }

  return (
    <Dialog title="Edit day type" onClose={onDone} className="day-types-dialog">
      <div className="field">
        <label htmlFor="dt-name">Name</label>
        <input id="dt-name" type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="day-type-items">
        {items.map((it, i) => (
          <div key={i} className="day-type-item">
            <input type="time" aria-label="Time" value={it.time} onChange={(e) => update(i, { time: e.target.value })} />
            <input type="text" aria-label="Task" value={it.title} maxLength={180} placeholder="Task" onChange={(e) => update(i, { title: e.target.value })} />
            <input type="number" aria-label="Minutes" min={5} max={600} value={it.estimate} onChange={(e) => update(i, { estimate: Number(e.target.value) })} />
            <button className="icon-btn" aria-label={`Remove ${it.title || 'task'}`} onClick={() => setItems(items.filter((_, j) => j !== i))}>
              <Icon name="close" />
            </button>
          </div>
        ))}
        <button className="text-btn" onClick={() => setItems([...items, { title: '', time: '', estimate: 30 }])}>
          <Icon name="plus" />
          Add a task
        </button>
      </div>
      <div className="dialog-footer">
        <button className="btn danger" onClick={remove}>
          <Icon name="trash" />
          Delete
        </button>
        <div className="row">
          <button className="btn" onClick={onDone}>
            Back
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </Dialog>
  )
}
