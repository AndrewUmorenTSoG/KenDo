import { doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { htmlToText } from '../lib/sanitize'
import type { Note, Task } from '../lib/types'
import { userCollection, userDoc } from './collection'
import { createTask } from './tasks'

export type NoteInput = Pick<Note, 'title' | 'body' | 'colour' | 'projectId' | 'pinned'>

export function createNote(uid: string, input: NoteInput, id?: string) {
  const now = Date.now()
  const note: Omit<Note, 'id'> = { ...input, archived: false, uid, createdAt: now, updatedAt: now }
  const ref = id ? userDoc(uid, 'notes', id) : doc(userCollection(uid, 'notes'))
  return setDoc(ref, note)
}

export function updateNote(uid: string, id: string, changes: Partial<Note>) {
  return updateDoc(userDoc(uid, 'notes', id), { ...changes, updatedAt: Date.now() })
}

// Tasks made from the note stay; they just lose the link.
export async function deleteNote(uid: string, id: string, tasks: Task[]) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'users', uid, 'notes', id))
  for (const t of tasks) if (t.noteId === id) batch.update(doc(db, 'users', uid, 'tasks', t.id), { noteId: null })
  await batch.commit()
}

export function noteToTask(uid: string, note: Pick<Note, 'id' | 'title' | 'body' | 'projectId'>, selected?: string) {
  const text = selected?.trim()
  return createTask(uid, {
    title: (text || note.title || 'Untitled note').slice(0, 180),
    description: text ? '' : htmlToText(note.body),
    projectId: note.projectId,
    noteId: note.id,
  })
}
