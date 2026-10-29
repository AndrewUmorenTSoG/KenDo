import {
  addDoc,
  arrayRemove,
  arrayUnion,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { shift, todayKey } from '../lib/dates'
import { db } from '../lib/firebase'
import type { Project, ProjectColour, Task } from '../lib/types'
import { userCollection, userDoc } from './collection'
import { blankTask, stored } from './tasks'

const palette: ProjectColour[] = ['purple', 'green', 'yellow', 'pink']

export const nextColour = (projects: Project[]) => palette[projects.length % palette.length]

export function createProject(uid: string, name: string, colour: ProjectColour) {
  const project: Omit<Project, 'id'> = { name, colour, uid, createdAt: Date.now() }
  return addDoc(userCollection(uid, 'projects'), project)
}

export const templates = {
  'Website launch': ['Write the brief', 'Design the pages', 'Build the experience', 'Review and test', 'Launch the project'],
  'Weekly reset': ['Reflect on the week', 'Clear the inbox', 'Plan next week', 'Make space to rest'],
  'Community meetup': ['Plan the meetup', 'Prepare the materials', 'Welcome everyone', 'Follow up'],
} as const

export const templateSummaries: Record<keyof typeof templates, string> = {
  'Website launch': 'Brief → Design → Build → Review → Launch',
  'Weekly reset': 'Reflect → Clear inbox → Plan → Rest',
  'Community meetup': 'Plan → Prepare → Welcome → Follow up',
}

// Creates the project plus one task per step, each depending on the one before.
export async function applyTemplate(uid: string, name: keyof typeof templates, projects: Project[]) {
  let projectName: string = name
  for (let n = 2; projects.some((p) => p.name === projectName); n++) projectName = `${name} ${n}`

  const batch = writeBatch(db)
  const projectRef = doc(userCollection(uid, 'projects'))
  batch.set(projectRef, { name: projectName, colour: nextColour(projects), uid, createdAt: Date.now() })

  let previous: string | null = null
  templates[name].forEach((title, i) => {
    const ref = doc(userCollection(uid, 'tasks'))
    batch.set(ref, blankTask(uid, { title, projectId: projectRef.id, date: shift(todayKey(), i), dependsOn: previous }))
    previous = ref.id
  })
  await batch.commit()
  return projectRef.id
}

// First sign-in: Kenny's starting life areas.
export async function seedProjects(uid: string) {
  const starters: [string, ProjectColour][] = [
    ['Personal', 'green'],
    ['Work', 'purple'],
    ['Spiritual', 'yellow'],
    ['Family & friends', 'pink'],
  ]
  await Promise.all(
    starters.map(([name, colour], i) =>
      setDoc(doc(userCollection(uid, 'projects')), { name, colour, uid, createdAt: Date.now() + i }),
    ),
  )
}

// Sharing. A shared project keeps its tasks under users/{owner}/projects/{id}/tasks, where the
// security rules let every member in. Members keep a pointer in users/{uid}/joined/{id}.

const projectDoc = (owner: string, id: string) => doc(db, 'users', owner, 'projects', id)
const newCode = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20)

export const inviteLink = (project: Project) =>
  `${location.origin}/join/${project.uid}/${project.id}/${project.inviteCode}`

// Moves documents in chunks, since a batch holds at most 500 writes.
async function moveAll(moves: { from: DocumentReference; to: DocumentReference; data: object }[]) {
  for (let i = 0; i < moves.length; i += 200) {
    const batch = writeBatch(db)
    for (const m of moves.slice(i, i + 200)) {
      batch.set(m.to, m.data)
      batch.delete(m.from)
    }
    await batch.commit()
  }
}

export async function startSharing(uid: string, name: string, project: Project, tasks: Task[]) {
  await updateDoc(projectDoc(uid, project.id), {
    shared: true,
    members: [uid],
    memberNames: { [uid]: name || 'Owner' },
    inviteCode: newCode(),
  })
  const own = tasks.filter((t) => t.projectId === project.id && t.path === `users/${uid}/tasks/${t.id}`)
  await moveAll(
    own.map((t) => ({ from: doc(db, t.path!), to: doc(projectDoc(uid, project.id), 'tasks', t.id), data: stored(t) })),
  )
}

// Brings every task back to the owner's own list; members lose access straight away.
export async function stopSharing(uid: string, project: Project, tasks: Task[]) {
  const prefix = `users/${uid}/projects/${project.id}/tasks/`
  const inside = tasks.filter((t) => t.path?.startsWith(prefix))
  await moveAll(inside.map((t) => ({ from: doc(db, t.path!), to: userDoc(uid, 'tasks', t.id), data: stored(t) })))
  await updateDoc(projectDoc(uid, project.id), {
    shared: false,
    members: deleteField(),
    memberNames: deleteField(),
    inviteCode: deleteField(),
    joinCode: deleteField(),
  })
}

// Old links stop working; anyone already in stays in.
export const newInviteLink = (uid: string, project: Project) =>
  updateDoc(projectDoc(uid, project.id), { inviteCode: newCode() })

export const removeMember = (project: Project, member: string) =>
  updateDoc(projectDoc(project.uid, project.id), {
    members: arrayRemove(member),
    [`memberNames.${member}`]: deleteField(),
  })

export async function leaveProject(uid: string, project: Project) {
  await removeMember(project, uid)
  await deleteDoc(userDoc(uid, 'joined', project.id))
}

export type JoinResult = 'joined' | 'already' | 'own' | 'invalid'

export async function joinProject(uid: string, name: string, owner: string, id: string, code: string): Promise<JoinResult> {
  if (owner === uid) return 'own'
  const ref = projectDoc(owner, id)
  // Members can read the project; anyone else gets a permission error, which is expected here.
  const existing = await getDoc(ref).catch(() => null)
  const already = existing?.exists() && (existing.data().members as string[] | undefined)?.includes(uid)
  if (!already) {
    try {
      await updateDoc(ref, { members: arrayUnion(uid), [`memberNames.${uid}`]: name || 'Friend', joinCode: code })
    } catch {
      return 'invalid'
    }
  }
  await setDoc(userDoc(uid, 'joined', id), { owner, projectId: id, joinedAt: Date.now() })
  return already ? 'already' : 'joined'
}
