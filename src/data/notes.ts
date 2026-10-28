import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore'
import type { NewNote, Note } from '../lib/types'
import { useCollection, userCollection, userDoc } from './collection'
import { createTask } from './tasks'

export function useNotes(uid: string) {
  return useCollection<Note>(uid, 'notes')
}

export function createNote(uid: string, input: NewNote = {}) {
  const now = Date.now()
  const note: Omit<Note, 'id'> = {
    title: '',
    body: '',
    color: 'default',
    pinned: false,
    archived: false,
    taskIds: [],
    ...input,
    uid,
    createdAt: now,
    updatedAt: now,
  }
  return addDoc(userCollection(uid, 'notes'), note)
}

export function updateNote(uid: string, id: string, changes: Partial<Note>) {
  return updateDoc(userDoc(uid, 'notes', id), { ...changes, updatedAt: Date.now() })
}

export function deleteNote(uid: string, id: string) {
  return deleteDoc(userDoc(uid, 'notes', id))
}

// Turns a note, or a highlighted piece of it, into a task linked back to the note.
export async function convertToTask(uid: string, note: Note, selectedText?: string) {
  const text = selectedText?.trim() || note.title || htmlToText(note.body).split('\n')[0]
  const ref = await createTask(uid, {
    title: text.slice(0, 200),
    notes: selectedText ? undefined : htmlToText(note.body),
    projectId: note.projectId ?? null,
    noteIds: [note.id],
  })
  await updateNote(uid, note.id, { taskIds: [...note.taskIds, ref.id] })
  return ref
}

export function htmlToText(html: string) {
  const el = document.createElement('div')
  el.innerHTML = html
  return el.innerText.trim()
}
