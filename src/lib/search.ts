import { fmt } from './dates'
import type { Note, Project, Task } from './types'

// Global search runs over the data already on this device (Firestore's offline cache),
// so it works the same with or without a connection.

export interface TaskHit {
  task: Task
  project?: Project
}
export interface NoteHit {
  note: Note
  snippet: string
}
export interface ProjectHit {
  project: Project
  open: number
}
export interface SearchResults {
  tasks: TaskHit[]
  notes: NoteHit[]
  projects: ProjectHit[]
  // Tags in use that match the query, for one-tap "#tag" searches.
  tags: string[]
  total: number
}

interface Data {
  tasks: Task[]
  notes: Note[]
  projects: Project[]
}

const LIMIT = 30

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }

// Note bodies are sanitised HTML; search wants the words.
export const noteText = (html: string) =>
  html
    .replace(/<br\s*\/?>|<\/(p|div|li)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim()

// "#study" looks only at tags; anything else must appear somewhere in the item.
function parse(query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean)
  return {
    tags: words.filter((w) => w.startsWith('#') && w.length > 1).map((w) => w.slice(1)),
    words: words.filter((w) => !w.startsWith('#')),
  }
}

// Words people use for dates: the key itself, "2 Nov", "2 November 2026", "Monday".
export function dateWords(key: string) {
  if (!key) return ''
  return [
    key,
    fmt(key),
    fmt(key, { day: 'numeric', month: 'long', year: 'numeric' }),
    fmt(key, { weekday: 'long' }),
  ].join(' ')
}

// 0 = title starts with the query, 1 = a title word starts with it, 2 = in the title, 3 = elsewhere.
function titleRank(title: string, phrase: string) {
  const t = fold(title)
  if (!phrase) return 3
  if (t.startsWith(phrase)) return 0
  if (t.split(/\s+/).some((w) => w.startsWith(phrase))) return 1
  if (t.includes(phrase)) return 2
  return 3
}

function snippetOf(text: string, words: string[], size = 90) {
  const lower = fold(text)
  const at = words.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, at - 30)
  const end = Math.min(text.length, start + size)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

export function search(query: string, data: Data): SearchResults {
  const { tags, words } = parse(query)
  const phrase = words.join(' ')
  const empty = { tasks: [], notes: [], projects: [], tags: [], total: 0 }
  if (!tags.length && !words.length) return empty

  const projectById = new Map(data.projects.map((p) => [p.id, p]))
  const matches = (haystack: string) => words.every((w) => haystack.includes(w))
  const hasTags = (list: string[]) => tags.every((tag) => list.some((t) => fold(t).includes(tag)))

  const tasks = data.tasks
    .filter((t) => {
      const project = t.projectId ? projectById.get(t.projectId) : undefined
      const haystack = fold(
        [t.title, t.description, t.tags.join(' '), project?.name ?? '', dateWords(t.date), t.subtasks.map((s) => s.title).join(' ')].join(
          ' ',
        ),
      )
      return hasTags(t.tags) && matches(haystack)
    })
    .map((task) => ({ task, project: task.projectId ? projectById.get(task.projectId) : undefined }))
    .sort(
      (a, b) =>
        titleRank(a.task.title, phrase) - titleRank(b.task.title, phrase) ||
        Number(a.task.status === 'done') - Number(b.task.status === 'done') ||
        b.task.updatedAt - a.task.updatedAt,
    )

  // Notes have no tags, so a tag-only search leaves them out.
  const notes = words.length
    ? data.notes
        .map((note) => ({ note, text: noteText(note.body) }))
        .filter(({ note, text }) => !tags.length && matches(fold(`${note.title} ${text}`)))
        .sort(
          (a, b) =>
            titleRank(a.note.title, phrase) - titleRank(b.note.title, phrase) ||
            Number(a.note.archived) - Number(b.note.archived) ||
            b.note.updatedAt - a.note.updatedAt,
        )
        .map(({ note, text }) => ({ note, snippet: snippetOf(text, words) }))
    : []

  const projects = words.length && !tags.length
    ? data.projects
        .filter((p) => matches(fold(p.name)))
        .sort((a, b) => titleRank(a.name, phrase) - titleRank(b.name, phrase))
        .map((project) => ({
          project,
          open: data.tasks.filter((t) => t.projectId === project.id && t.status !== 'done').length,
        }))
    : []

  const allTags = [...new Set(data.tasks.flatMap((t) => t.tags))]
  const tagHits = allTags
    .filter((tag) => {
      const t = fold(tag)
      return tags.length ? tags.some((q) => t.includes(q)) : words.some((w) => t.includes(w))
    })
    .sort()
    .slice(0, 8)

  return {
    tasks: tasks.slice(0, LIMIT),
    notes: notes.slice(0, LIMIT),
    projects: projects.slice(0, LIMIT),
    tags: tagHits,
    total: tasks.length + notes.length + projects.length,
  }
}
