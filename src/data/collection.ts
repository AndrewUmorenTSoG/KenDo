import { collection, doc, onSnapshot, query, type QueryConstraint } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'

export type CollectionName = 'tasks' | 'notes' | 'projects' | 'devices'

// Everything a user owns lives under users/{uid}/..., which keeps security rules simple.
export const userCollection = (uid: string, name: CollectionName) => collection(db, 'users', uid, name)
export const userDoc = (uid: string, name: CollectionName, id: string) => doc(db, 'users', uid, name, id)

export function useCollection<T>(uid: string, name: CollectionName, ...constraints: QueryConstraint[]) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  // Constraints are rebuilt each render, so key the subscription on the uid and collection only.
  useEffect(() => {
    const q = query(userCollection(uid, name), ...constraints)
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T))
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, name])
  return { items, loading }
}
