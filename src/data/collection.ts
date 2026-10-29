import { collection, doc, onSnapshot, type DocumentSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'

export type CollectionName = 'tasks' | 'notes' | 'projects' | 'habits' | 'focusSessions' | 'devices' | 'joined' | 'reflections'

// Everything a user owns lives under users/{uid}/..., which keeps security rules simple.
export const userCollection = (uid: string, name: CollectionName) => collection(db, 'users', uid, name)
export const userDoc = (uid: string, name: CollectionName, id: string) => doc(db, 'users', uid, name, id)
export const profileDoc = (uid: string) => doc(db, 'users', uid)

// The document's data plus its id and path (tasks use the path to find their way back).
export const withId = <T,>(d: DocumentSnapshot) => ({ ...d.data(), id: d.id, path: d.ref.path }) as T

export function useCollection<T>(uid: string, name: CollectionName) {
  const [state, setState] = useState<{ items: T[]; loading: boolean }>({ items: [], loading: true })
  useEffect(
    () =>
      onSnapshot(userCollection(uid, name), (snap) =>
        setState({ items: snap.docs.map((d) => withId<T>(d)), loading: false }),
      ),
    [uid, name],
  )
  return state
}
