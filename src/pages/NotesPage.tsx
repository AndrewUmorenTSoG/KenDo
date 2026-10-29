import { useState } from 'react'
import { IconButton, PageHeading, Segmented } from '../components/bits'
import Icon from '../components/Icon'
import { noteToTask, updateNote } from '../data/notes'
import { plural } from '../lib/dates'
import { useStore } from '../data/store'
import { useUI } from '../hooks/useUI'
import { sanitizeHtml } from '../lib/sanitize'
import type { Note } from '../lib/types'

type Tab = 'all' | 'pinned' | 'archive'

export default function NotesPage() {
  const { notes } = useStore()
  const { open } = useUI()
  const [tab, setTab] = useState<Tab>('all')
  const visible = notes
    .filter((n) => (tab === 'archive' ? n.archived : !n.archived && (tab !== 'pinned' || n.pinned)))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)

  return (
    <>
      <PageHeading
        eyebrow="STICKY NOTES"
        title="A home for your thoughts."
        actions={
          <button className="btn primary" onClick={() => open({ kind: 'note', id: null })}>
            <Icon name="plus" />
            New note
          </button>
        }
      />
      <div className="toolbar">
        <Segmented
          options={[
            ['all', 'All notes'],
            ['pinned', 'Pinned'],
            ['archive', 'Archive'],
          ]}
          value={tab}
          onChange={setTab}
        />
        <span className="tiny muted">{plural(visible.length, 'note')}</span>
      </div>
      <div className="notes-grid">
        {visible.map((n) => (
          <StickyNote key={n.id} note={n} />
        ))}
        <button className="notes-empty" onClick={() => open({ kind: 'note', id: null })}>
          <Icon name="plus" />
          <span>A thought worth keeping?</span>
          <span className="tiny">Add a sticky note</span>
        </button>
      </div>
    </>
  )
}

function StickyNote({ note }: { note: Note }) {
  const { uid, projects } = useStore()
  const { open, toast } = useUI()
  const project = projects.find((p) => p.id === note.projectId)

  // Tapping a ☐ or ☑ in a saved note ticks it, like a paper checklist.
  function toggleCheckbox(e: React.MouseEvent<HTMLDivElement>) {
    if (window.getSelection()?.toString()) return
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY)
    const el = e.currentTarget
    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE || !el.contains(range.startContainer)) return
    const node = range.startContainer
    const text = node.textContent ?? ''
    const index = [range.startOffset, range.startOffset - 1].find((i) => i >= 0 && (text[i] === '☐' || text[i] === '☑'))
    if (index === undefined) return
    node.textContent = text.slice(0, index) + (text[index] === '☐' ? '☑' : '☐') + text.slice(index + 1)
    updateNote(uid, note.id, { body: sanitizeHtml(el.innerHTML) })
  }

  return (
    <article className={`sticky ${note.colour}`}>
      <div className="row between">
        <span className="eyebrow" style={{ fontSize: 8, color: '#786775' }}>
          {project?.name ?? ''}
        </span>
        <IconButton
          label={note.pinned ? 'Unpin note' : 'Pin note'}
          icon="pin"
          pressed={note.pinned}
          onClick={() => updateNote(uid, note.id, { pinned: !note.pinned })}
        />
      </div>
      <button className="card-open" onClick={() => open({ kind: 'note', id: note.id })}>
        <h3>{note.title}</h3>
      </button>
      <div
        className="note-content"
        onClick={toggleCheckbox}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.body) }}
      />
      <div className="note-footer">
        <button
          className="row tiny"
          onClick={() => {
            noteToTask(uid, note)
            toast('Note added to today’s tasks. Your thought stays here, too.')
          }}
        >
          <Icon name="plus" /> Make a task
        </button>
        <div className="note-actions">
          <IconButton label="Edit note" icon="edit" onClick={() => open({ kind: 'note', id: note.id })} />
          <IconButton
            label={note.archived ? 'Restore note' : 'Archive note'}
            icon="archive"
            onClick={() => {
              updateNote(uid, note.id, { archived: !note.archived })
              toast(note.archived ? 'Note restored.' : 'Note tucked away in the archive.')
            }}
          />
        </div>
      </div>
    </article>
  )
}
