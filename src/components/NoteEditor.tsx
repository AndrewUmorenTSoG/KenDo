import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { doc } from 'firebase/firestore'
import { userCollection } from '../data/collection'
import { createNote, deleteNote, noteToTask, updateNote } from '../data/notes'
import { useStore } from '../data/store'
import { useUI } from '../hooks/useUI'
import { sanitizeHtml } from '../lib/sanitize'
import type { NoteColour } from '../lib/types'
import Dialog from './Dialog'
import Icon from './Icon'

export const swatches: Record<NoteColour, string> = {
  rose: '#ffc2d6',
  butter: '#ffe98a',
  mint: '#b8ebc6',
  lilac: '#d9c6ff',
  peach: '#ffcfa3',
  sky: '#b5dcff',
  aqua: '#9fe9e1',
  coral: '#ffa59b',
  lime: '#dcf58f',
  slate: '#d5dbe3',
}

const escapeText = (v: string) => v.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

export default function NoteEditor({ id }: { id: string | null }) {
  const { uid, notes, projects, tasks } = useStore()
  const { close, open, toast } = useUI()
  const original = id ? notes.find((n) => n.id === id) : undefined
  const personal = projects.find((p) => p.name === 'Personal') ?? projects[0]
  const [title, setTitle] = useState(original?.title ?? '')
  const [projectId, setProjectId] = useState(original?.projectId ?? personal?.id ?? '')
  const [colour, setColour] = useState<NoteColour>(original?.colour ?? 'rose')
  const [pinned, setPinned] = useState(original?.pinned ?? false)
  const body = useRef<HTMLDivElement>(null)
  const selected = useRef('')
  // New notes get their id up front so "selected text → task" can link back before the first save.
  const [noteId] = useState(() => id ?? doc(userCollection(uid, 'notes')).id)

  if (id && !original) return null

  function persist() {
    if (!title.trim()) {
      document.getElementById('f-note-title')?.focus()
      return false
    }
    const data = {
      title: title.trim(),
      projectId: projectId || null,
      colour,
      pinned,
      body: sanitizeHtml(body.current?.innerHTML ?? ''),
    }
    if (original) updateNote(uid, original.id, data)
    else createNote(uid, data, noteId)
    return true
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!persist()) return
    close()
    toast('Thought saved. A little more headspace.')
  }

  function format(command: 'bold' | 'italic' | 'insertUnorderedList' | 'checklist') {
    body.current?.focus()
    if (command === 'checklist') document.execCommand('insertText', false, '☐ ')
    else document.execCommand(command)
  }

  function selectionToTask() {
    const text = selected.current.trim()
    if (!text) return toast('Highlight some note text first.')
    if (!persist()) return
    noteToTask(uid, { id: noteId, title: title.trim(), body: '', projectId: projectId || null }, text)
    close()
    toast('Selected text added to your tasks.')
  }

  // Enter on a checklist line starts a new box; Enter on an empty box ends the list.
  function continueChecklist(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return
    const sel = window.getSelection()
    if (!sel?.rangeCount || !sel.isCollapsed) return
    const caret = sel.getRangeAt(0).cloneRange()
    sel.modify('extend', 'backward', 'paragraphboundary')
    const line = sel.toString()
    if (!/^[☐☑]/.test(line)) {
      sel.removeAllRanges()
      sel.addRange(caret)
      return
    }
    e.preventDefault()
    if (/^[☐☑]\s*$/.test(line)) {
      document.execCommand('delete')
      return
    }
    sel.removeAllRanges()
    sel.addRange(caret)
    if (!document.execCommand('insertLineBreak')) document.execCommand('insertHTML', false, '<br>')
    document.execCommand('insertText', false, '☐ ')
  }

  const remember = () => (selected.current = window.getSelection()?.toString() ?? '')

  return (
    <Dialog title={original ? 'A thought worth keeping.' : 'A little space to think.'} onClose={close}>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="f-note-title">Note title</label>
          <input
            id="f-note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            placeholder="Give your thought a name"
          />
        </div>
        <div className="field">
          <label htmlFor="f-note-project">Linked project</label>
          <select id="f-note-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="note-colours">
          {(Object.keys(swatches) as NoteColour[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`colour-swatch ${key === colour ? 'selected' : ''}`}
              aria-label={`${key} note colour`}
              aria-pressed={key === colour}
              style={{ background: swatches[key] }}
              onClick={() => setColour(key)}
            />
          ))}
        </div>
        <div className="editor-toolbar" aria-label="Note formatting">
          {(
            [
              ['bold', 'Bold', <b key="b">B</b>],
              ['italic', 'Italic', <i key="i">I</i>],
              ['insertUnorderedList', 'Bulleted list', '≡'],
              ['checklist', 'Add checklist item', '☐'],
            ] as const
          ).map(([cmd, label, glyph]) => (
            <button
              key={cmd}
              type="button"
              aria-label={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => format(cmd)}
            >
              {glyph}
            </button>
          ))}
        </div>
        <div
          ref={body}
          className="rich-editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Note content"
          onMouseUp={remember}
          onKeyUp={remember}
          onKeyDown={continueChecklist}
          onPaste={(e) => {
            e.preventDefault()
            const html = e.clipboardData.getData('text/html')
            const text = e.clipboardData.getData('text/plain')
            document.execCommand('insertHTML', false, html ? sanitizeHtml(html) : escapeText(text).replace(/\n/g, '<br>'))
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(original?.body ?? '') }}
        />
        <button type="button" className="text-btn" onClick={selectionToTask}>
          Selected text → task
        </button>
        <label className="subtask">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin this thought
        </label>
        {original && tasks.some((t) => t.noteId === original.id) && (
          <p className="tiny muted">
            Linked tasks: {tasks.filter((t) => t.noteId === original.id).map((t) => t.title).join(', ')}
          </p>
        )}
        <div className="dialog-footer">
          {original ? (
            <button
              type="button"
              className="btn danger"
              onClick={() =>
                open({
                  kind: 'confirm',
                  title: 'Let this note go?',
                  text: 'This note will be removed. Any tasks created from it will stay.',
                  onConfirm: () => {
                    deleteNote(uid, original.id, tasks)
                    toast('Note deleted.')
                  },
                })
              }
            >
              <Icon name="trash" />
              Delete note
            </button>
          ) : (
            <span />
          )}
          <div className="row">
            <button type="button" className="btn" onClick={close}>
              Cancel
            </button>
            <button className="btn primary" type="submit">
              Save note
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
