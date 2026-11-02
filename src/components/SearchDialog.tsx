import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useUI } from '../hooks/useUI'
import { fmt, todayKey } from '../lib/dates'
import { noteText, search } from '../lib/search'
import Icon from './Icon'
import Dialog from './Dialog'

interface Item {
  key: string
  group: 'Tasks' | 'Notes' | 'Projects'
  title: string
  detail: string
  done?: boolean
  dot?: string
  go: () => void
}

const RECENT = 6

function when(date: string, done: boolean, completedOn: string | null, today: string) {
  if (done) return `Done${completedOn ? ` ${fmt(completedOn)}` : ''}`
  if (!date) return 'Someday'
  if (date === today) return 'Today'
  return date < today ? `Overdue · ${fmt(date)}` : fmt(date, { weekday: 'short', day: 'numeric', month: 'short' })
}

// One search for tasks (open and finished), notes, projects, tags and dates, over what's on this device.
export default function SearchDialog({ initial = '' }: { initial?: string }) {
  const { tasks, notes, projects } = useStore()
  const { open, close } = useUI()
  const navigate = useNavigate()
  const [query, setQuery] = useState(initial)
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  // showModal() focuses the close button, so hand focus to the search box once it has opened.
  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])
  const today = todayKey()

  const results = useMemo(() => search(query, { tasks, notes, projects }), [query, tasks, notes, projects])
  const searching = query.trim().length > 0

  const items = useMemo<Item[]>(() => {
    const projectName = (id: string | null) => projects.find((p) => p.id === id)
    const taskItem = (t: (typeof tasks)[number]): Item => {
      const project = projectName(t.projectId)
      return {
        key: `t-${t.id}`,
        group: 'Tasks',
        title: t.title,
        detail: [when(t.date, t.status === 'done', t.completedOn, today), t.time, project?.name, t.tags.map((x) => `#${x}`).join(' ')]
          .filter(Boolean)
          .join(' · '),
        done: t.status === 'done',
        dot: project?.colour,
        go: () => open({ kind: 'task', id: t.id }),
      }
    }
    const noteItem = (note: (typeof notes)[number], snippet: string): Item => ({
      key: `n-${note.id}`,
      group: 'Notes',
      title: note.title || 'Untitled note',
      detail: [note.archived ? 'Archived' : '', snippet].filter(Boolean).join(' · '),
      go: () => open({ kind: 'note', id: note.id }),
    })

    if (!searching) {
      // Before typing: what was touched most recently, so the last thing is one tap away.
      const recentTasks = [...tasks].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, RECENT).map(taskItem)
      const recentNotes = notes
        .filter((x) => !x.archived)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 3)
        .map((x) => noteItem(x, noteText(x.body).slice(0, 80)))
      return [...recentTasks, ...recentNotes]
    }
    return [
      ...results.tasks.map((h) => taskItem(h.task)),
      ...results.notes.map((h) => noteItem(h.note, h.snippet)),
      ...results.projects.map(
        (h): Item => ({
          key: `p-${h.project.id}`,
          group: 'Projects',
          title: h.project.name,
          detail: h.open ? `${h.open} open ${h.open === 1 ? 'task' : 'tasks'}` : 'All clear',
          dot: h.project.colour,
          go: () => {
            close()
            navigate(`/projects?project=${h.project.id}`)
          },
        }),
      ),
    ]
  }, [searching, results, tasks, notes, projects, open, close, navigate, today])

  const current = Math.min(active, Math.max(items.length - 1, 0))

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1)
      setActive(next)
      list.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[current]?.go()
    }
  }

  const groups = (['Tasks', 'Notes', 'Projects'] as const)
    .map((g) => [g, items.filter((i) => i.group === g)] as const)
    .filter(([, list]) => list.length)

  return (
    <Dialog title="Search" onClose={close} className="search-dialog">
      <div className="search-field">
        <Icon name="search" />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Tasks, notes, projects, #tags, dates"
          aria-label="Search everything"
          aria-controls="search-results"
          aria-activedescendant={items[current] ? `sr-${items[current].key}` : undefined}
          autoComplete="off"
          enterKeyHint="go"
        />
      </div>

      {searching && results.tags.length > 0 && (
        <div className="search-tags" aria-label="Matching tags">
          {results.tags.map((tag) => (
            <button key={tag} className="pill" onClick={() => setQuery(`#${tag}`)}>
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div id="search-results" className="search-results" role="listbox" ref={list} aria-label="Search results">
        {groups.map(([group, groupItems]) => (
          <div key={group} role="group" aria-labelledby={`sg-${group}`}>
            <div className="task-group-title" id={`sg-${group}`}>
              {searching ? group : `Recent ${group.toLowerCase()}`}
              {searching && ` · ${group === 'Tasks' ? results.tasks.length : group === 'Notes' ? results.notes.length : results.projects.length}`}
            </div>
            {groupItems.map((item) => {
              const index = items.indexOf(item)
              return (
                <button
                  key={item.key}
                  id={`sr-${item.key}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === current}
                  className={`search-result ${index === current ? 'active' : ''} ${item.done ? 'done' : ''}`}
                  onMouseMove={() => index !== current && setActive(index)}
                  onClick={item.go}
                >
                  <span className="search-icon">
                    {item.group === 'Tasks' ? (
                      item.done ? <Icon name="check" /> : <span className={`dot ${item.dot ?? ''}`} />
                    ) : item.group === 'Notes' ? (
                      <Icon name="note" />
                    ) : (
                      <Icon name="board" />
                    )}
                  </span>
                  <span className="search-text">
                    <strong>{item.title}</strong>
                    {item.detail && <span>{item.detail}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        ))}

        {searching && !items.length && (
          <div className="empty">
            <Icon name="search" />
            <p>Nothing matches “{query.trim()}”.</p>
            <p className="tiny">Try fewer words, a #tag or a date like “28 Oct”.</p>
          </div>
        )}
        {!searching && !items.length && (
          <div className="empty">
            <Icon name="search" />
            <p>Nothing here yet.</p>
          </div>
        )}
      </div>
      {searching && results.total > items.length && (
        <p className="tiny muted search-more">Showing the closest {items.length} of {results.total}. Add a word to narrow it down.</p>
      )}
    </Dialog>
  )
}
