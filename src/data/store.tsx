import { onSnapshot, setDoc } from 'firebase/firestore'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { FocusSession, Habit, Note, Profile, Project, Task } from '../lib/types'
import { profileDoc, useCollection } from './collection'
import { seedProjects } from './projects'

interface Store {
  uid: string
  tasks: Task[]
  notes: Note[]
  projects: Project[]
  habits: Habit[]
  sessions: FocusSession[]
  profile: Profile
  loading: boolean
}

const defaultProfile: Profile = {
  name: '',
  dark: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  celebrations: true,
  reflection: '',
  seeded: false,
}

const StoreContext = createContext<Store | null>(null)

// One live subscription per collection for the whole app. A person's data is small,
// and Firestore's offline cache serves it instantly after the first load.
export function StoreProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const { user } = useAuth()
  const tasks = useCollection<Task>(uid, 'tasks')
  const notes = useCollection<Note>(uid, 'notes')
  const projects = useCollection<Project>(uid, 'projects')
  const habits = useCollection<Habit>(uid, 'habits')
  const sessions = useCollection<FocusSession>(uid, 'focusSessions')
  const [profile, setProfile] = useState<Profile | null>(null)

  const seeding = useRef(false)

  useEffect(
    () =>
      // Metadata changes too, so we hear when a cached answer is confirmed by the server.
      onSnapshot(profileDoc(uid), { includeMetadataChanges: true }, (snap) => {
        const data = (snap.exists() ? snap.data() : {}) as Partial<Profile>
        const name = data.name ?? user?.displayName?.split(' ')[0] ?? ''
        setProfile({ ...defaultProfile, ...data, name })
        // First sign-in: fill in the profile and add starter projects, once. A cache miss on a
        // new device isn't proof it's missing, so only act on an answer from the server.
        if (data.seeded || snap.metadata.fromCache || seeding.current) return
        seeding.current = true
        const { name: _blank, ...defaults } = defaultProfile
        setDoc(profileDoc(uid), { ...defaults, ...data, ...(name ? { name } : {}), seeded: true }, { merge: true }).then(
          () => seedProjects(uid),
        )
      }),
    [uid, user],
  )

  const value: Store = {
    uid,
    tasks: tasks.items,
    notes: notes.items,
    projects: [...projects.items].sort((a, b) => a.createdAt - b.createdAt),
    habits: [...habits.items].sort((a, b) => a.createdAt - b.createdAt),
    sessions: sessions.items,
    profile: profile ?? defaultProfile,
    loading: tasks.loading || projects.loading || !profile,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}

export function updateProfile(uid: string, changes: Partial<Profile>) {
  return setDoc(profileDoc(uid), changes, { merge: true })
}
