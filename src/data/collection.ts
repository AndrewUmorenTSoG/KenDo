import { collection, doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'

export type CollectionName = 'tasks' | 'notes' | 'projects' | 'habits' | 'focusSessions' | 'devices'

// Everything a user owns lives under users/{uid}/..., which keeps security rules simple.
export const userCollection = (uid: string, name: CollectionName) => collection(db, 'users', uid, name)
export const userDoc = (uid: string, name: CollectionName, id: string) => doc(db, 'users', uid, name, id)
export const profileDoc = (uid: string) => doc(db, 'users', uid)

export function useCollection<T>(uid: string, name: CollectionName) {
  const [state, setState] = useState<{ items: T[]; loading: boolean }>({ items: [], loading: true })
  useEffect(
    () =>
      onSnapshot(userCollection(uid, name), (snap) =>
        setState({ items: snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T), loading: false }),
      ),
    [uid, name],
  )
  return state
}
