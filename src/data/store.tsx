import { collection, deleteDoc, doc, increment, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { db } from '../lib/firebase'
import type { FocusSession, Habit, Note, Profile, Project, Task } from '../lib/types'
import { profileDoc, useCollection, userDoc, withId } from './collection'
import { seedProjects } from './projects'
import { setSharedOwners } from './tasks'

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
  verses: true,
  nudges: true,
  theme: 'pink',
  focusMinutes: 25,
  breakMinutes: 5,
  restMinutes: 15,
  reflection: '',
  seeded: false,
}

const StoreContext = createContext<Store | null>(null)

// One live subscription per collection for the whole app. A person's data is small,
// and Firestore's offline cache serves it instantly after the first load.
export function StoreProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const { user } = useAuth()
  const ownTasks = useCollection<Task>(uid, 'tasks')
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

  // One-off: the "Health & wellbeing" starter became "Spiritual".
  const ready = profile && !projects.loading
  useEffect(() => {
    // Wait for the server's copy of the profile (seeded), so this can't race first-time setup.
    if (!ready || !profile.seeded || profile.spiritual) return
    const old = projects.items.find((p) => p.name === 'Health & wellbeing')
    const hasSpiritual = projects.items.some((p) => p.name === 'Spiritual')
    if (old && !hasSpiritual) updateDoc(userDoc(uid, 'projects', old.id), { name: 'Spiritual' })
    setDoc(profileDoc(uid), { spiritual: true }, { merge: true })
  }, [ready, profile?.seeded, profile?.spiritual, projects.items, uid])

  // Nudges are sent at local times, so the server needs to know this person's time zone.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  useEffect(() => {
    if (profile?.seeded && timeZone && profile.timeZone !== timeZone) setDoc(profileDoc(uid), { timeZone }, { merge: true })
  }, [profile?.seeded, profile?.timeZone, timeZone, uid])

  const joined = useJoinedProjects(uid)
  const allProjects = [...projects.items, ...joined.projects].sort((a, b) => a.createdAt - b.createdAt)
  const shared = allProjects.filter((p) => p.shared)
  setSharedOwners(new Map(shared.map((p) => [p.id, p.uid])))
  const sharedTasks = useSharedTasks(shared)

  const value: Store = {
    uid,
    tasks: [...ownTasks.items, ...sharedTasks],
    notes: notes.items,
    projects: allProjects,
    habits: [...habits.items].sort((a, b) => a.createdAt - b.createdAt),
    sessions: sessions.items,
    profile: profile ?? defaultProfile,
    loading: ownTasks.loading || projects.loading || joined.loading || !profile,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

const without = <T,>(map: Record<string, T>, key: string) => {
  const { [key]: _gone, ...rest } = map
  return rest
}

// Projects other people have shared with this user, kept live. If the owner removes them or stops
// sharing, the read is refused, so the pointer is tidied away.
function useJoinedProjects(uid: string) {
  const joined = useCollection<{ id: string; owner: string }>(uid, 'joined')
  const [byId, setById] = useState<Record<string, Project>>({})
  const key = joined.items.map((j) => `${j.owner}/${j.id}`).sort().join(',')

  useEffect(() => {
    const pointers = key ? key.split(',').map((k) => k.split('/') as [string, string]) : []
    setById((current) => Object.fromEntries(Object.entries(current).filter(([id]) => pointers.some(([, p]) => p === id))))
    const drop = (id: string) => {
      setById((current) => without(current, id))
      deleteDoc(userDoc(uid, 'joined', id))
    }
    const stops = pointers.map(([owner, id]) =>
      onSnapshot(
        doc(db, 'users', owner, 'projects', id),
        (snap) => {
          if (!snap.exists()) return drop(id)
          // Name it after the owner too, so "Family & friends · Kenny" isn't mistaken for your own.
          const project = withId<Project>(snap)
          const owner = project.memberNames?.[project.uid]
          setById((current) => ({ ...current, [id]: { ...project, name: owner ? `${project.name} · ${owner}` : project.name } }))
        },
        () => drop(id),
      ),
    )
    return () => stops.forEach((stop) => stop())
  }, [uid, key])

  return { projects: Object.values(byId), loading: joined.loading }
}

// Tasks inside shared projects, whoever owns them. Firestore pushes each change to every member live.
function useSharedTasks(projects: Project[]) {
  const [byProject, setByProject] = useState<Record<string, Task[]>>({})
  const key = projects.map((p) => `${p.uid}/${p.id}`).sort().join(',')

  useEffect(() => {
    const list = key ? key.split(',').map((k) => k.split('/') as [string, string]) : []
    setByProject((current) => Object.fromEntries(Object.entries(current).filter(([id]) => list.some(([, p]) => p === id))))
    const stops = list.map(([owner, id]) =>
      onSnapshot(
        collection(db, 'users', owner, 'projects', id, 'tasks'),
        (snap) => setByProject((current) => ({ ...current, [id]: snap.docs.map((d) => withId<Task>(d)) })),
        () => setByProject((current) => without(current, id)),
      ),
    )
    return () => stops.forEach((stop) => stop())
  }, [key])

  return Object.values(byProject).flat()
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}

// Adds one to the lifetime count of completed tasks.
export function countCompletion(uid: string) {
  return setDoc(profileDoc(uid), { completedTotal: increment(1) }, { merge: true })
}

export function updateProfile(uid: string, changes: Partial<Profile>) {
  return setDoc(profileDoc(uid), changes, { merge: true })
}
