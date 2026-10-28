import { useRef, useState } from 'react'
import { convertToTask, createNote, deleteNote, updateNote, useNotes } from '../data/notes'
import { useUid } from '../hooks/useAuth'
import { sanitizeHtml } from '../lib/sanitize'
import type { Note, NoteColor } from '../lib/types'

const colors: NoteColor[] = ['default', 'pink', 'sage', 'lavender', 'amber']

export default function NotesPage() {
  const uid = useUid()
  const { items: notes, loading } = useNotes(uid)
  const [showArchived, setShowArchived] = useState(false)

  const visible = notes
    .filter((n) => n.archived === showArchived)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)

  return (
    <section className="stack">
      <div className="row between">
        <h1>Notes</h1>
        <div className="row">
          <button className="btn" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Show active' : 'Show archived'}
          </button>
          <button className="btn primary" onClick={() => createNote(uid)}>
            New note
          </button>
        </div>
      </div>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="muted">{showArchived ? 'No archived notes.' : 'No notes yet.'}</p>
      ) : (
        <div className="notes-grid">
          {visible.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </div>
      )}
    </section>
  )
}

function NoteCard({ note }: { note: Note }) {
  const uid = useUid()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('')

  const format = (command: 'bold' | 'italic') => {
    bodyRef.current?.focus()
    document.execCommand(command)
  }
  const addChecklistItem = () => {
    bodyRef.current?.focus()
    document.execCommand('insertHTML', false, '<div><input type="checkbox"> </div>')
  }
  const saveBody = () => {
    const html = sanitizeHtml(bodyRef.current?.innerHTML ?? '')
    if (html !== note.body) updateNote(uid, note.id, { body: html })
  }
  // Checkbox ticks don't change innerHTML's "checked" attribute on their own, so mirror it before saving.
  const onBodyClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLInputElement
    if (target.tagName === 'INPUT') {
      target.toggleAttribute('checked', target.checked)
      saveBody()
    }
  }
  const toTask = async () => {
    const selection = window.getSelection()?.toString()
    await convertToTask(uid, note, selection)
    setMessage(selection ? 'Highlighted text added as a task' : 'Added as a task')
    setTimeout(() => setMessage(''), 2500)
  }

  return (
    <article className={`note note-${note.color}`}>
      <input
        className="note-title"
        defaultValue={note.title}
        placeholder="Title"
        onBlur={(e) => e.target.value !== note.title && updateNote(uid, note.id, { title: e.target.value })}
      />
      <div className="row toolbar">
        <button className="icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => format('bold')} aria-label="Bold">
          <b>B</b>
        </button>
        <button className="icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => format('italic')} aria-label="Italic">
          <i>I</i>
        </button>
        <button className="icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={addChecklistItem} aria-label="Checklist item">
          ☑
        </button>
      </div>
      <div
        ref={bodyRef}
        className="note-body"
        contentEditable
        suppressContentEditableWarning
        onBlur={saveBody}
        onClick={onBodyClick}
        dangerouslySetInnerHTML={{ __html: note.body }}
      />
      <div className="row between note-actions">
        <div className="row">
          {colors.map((c) => (
            <button
              key={c}
              className={`swatch note-${c} ${note.color === c ? 'active' : ''}`}
              onClick={() => updateNote(uid, note.id, { color: c })}
              aria-label={`${c} colour`}
            />
          ))}
        </div>
        <div className="row">
          <button className="text-btn" onMouseDown={(e) => e.preventDefault()} onClick={toTask}>
            To task
          </button>
          <button className="text-btn" onClick={() => updateNote(uid, note.id, { pinned: !note.pinned })}>
            {note.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button className="text-btn" onClick={() => updateNote(uid, note.id, { archived: !note.archived })}>
            {note.archived ? 'Restore' : 'Archive'}
          </button>
          <button className="text-btn danger" onClick={() => deleteNote(uid, note.id)}>
            Delete
          </button>
        </div>
      </div>
      {message && <p className="tiny muted">{message}</p>}
    </article>
  )
}
