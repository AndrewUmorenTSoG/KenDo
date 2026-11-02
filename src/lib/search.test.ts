import { describe, expect, it } from 'vitest'
import { noteText, search } from './search'
import { taskDefaults } from './taskRules'
import type { Note, Project, Task } from './types'

let n = 0
const task = (title: string, extra: Partial<Task> = {}): Task => ({
  ...taskDefaults,
  id: `t${++n}`,
  title,
  date: '2026-11-02',
  activity: [],
  uid: 'me',
  createdAt: n,
  updatedAt: n,
  ...extra,
})
const note = (title: string, body: string, extra: Partial<Note> = {}): Note => ({
  id: `n${++n}`,
  title,
  body,
  colour: 'rose',
  projectId: null,
  pinned: false,
  archived: false,
  uid: 'me',
  createdAt: n,
  updatedAt: n,
  ...extra,
})
const project = (id: string, name: string): Project => ({ id, name, colour: 'purple', uid: 'me', createdAt: 0 })

const projects = [project('p1', 'Spiritual'), project('p2', 'University')]
const tasks = [
  task('Call Pooks'),
  task('Speak to Mum', { status: 'done', completedOn: '2026-09-14', date: '2026-09-14' }),
  task('Revise for exam', { projectId: 'p2', tags: ['study'] }),
  task('Have quiet time', { projectId: 'p1', date: '2026-10-28', tags: ['morning'] }),
]
const notes = [note('Sermon notes', '<p>Grace is <strong>sufficient</strong></p><p>Psalm 23 &amp; more</p>'), note('Shopping', '<p>Milk</p>')]
const data = { tasks, notes, projects }

describe('global search', () => {
  it('finds an old completed task by title', () => {
    const r = search('mum', data)
    expect(r.tasks.map((h) => h.task.title)).toEqual(['Speak to Mum'])
    expect(r.tasks[0].task.status).toBe('done')
  })

  it('finds text inside a note and shows it in context', () => {
    const r = search('sufficient', data)
    expect(r.notes).toHaveLength(1)
    expect(r.notes[0].snippet).toContain('Grace is sufficient')
    expect(r.tasks).toHaveLength(0)
  })

  it('finds projects by name, and the tasks inside them', () => {
    const r = search('university', data)
    expect(r.projects.map((h) => h.project.name)).toEqual(['University'])
    expect(r.projects[0].open).toBe(1)
    expect(r.tasks.map((h) => h.task.title)).toEqual(['Revise for exam'])
  })

  it('searches by tag, with or without #', () => {
    expect(search('#study', data).tasks.map((h) => h.task.title)).toEqual(['Revise for exam'])
    expect(search('#stu', data).tags).toEqual(['study'])
    expect(search('morning', data).tasks.map((h) => h.task.title)).toEqual(['Have quiet time'])
    expect(search('#study', data).notes).toHaveLength(0)
  })

  it('searches by date in the ways people write it', () => {
    const titles = (q: string) => search(q, data).tasks.map((h) => h.task.title)
    expect(titles('2026-10-28')).toEqual(['Have quiet time'])
    expect(titles('28 oct')).toEqual(['Have quiet time'])
    expect(titles('14 september')).toEqual(['Speak to Mum'])
  })

  it('needs every word to match, ignoring case and accents', () => {
    expect(search('quiet time', data).tasks).toHaveLength(1)
    expect(search('quiet pooks', data).tasks).toHaveLength(0)
    expect(search('CALL', data).tasks).toHaveLength(1)
    expect(search('café', { ...data, tasks: [task('Cafe with Ama')] }).tasks).toHaveLength(1)
  })

  it('puts title matches first and open tasks before finished ones', () => {
    const list = [task('Pray', { status: 'done' }), task('Pray for family'), task('Read', { description: 'then pray' })]
    expect(search('pray', { ...data, tasks: list }).tasks.map((h) => h.task.title)).toEqual(['Pray for family', 'Pray', 'Read'])
  })

  it('returns nothing for an empty query', () => {
    expect(search('   ', data).total).toBe(0)
  })

  it('turns note HTML into plain words', () => {
    expect(noteText('<p>A &amp; B</p><p>C<br>D</p>')).toBe('A & B C D')
  })
})
