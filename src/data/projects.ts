import { addDoc, doc, setDoc, writeBatch } from 'firebase/firestore'
import { shift, todayKey } from '../lib/dates'
import { db } from '../lib/firebase'
import type { Project, ProjectColour } from '../lib/types'
import { userCollection } from './collection'
import { blankTask } from './tasks'

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
    ['Health & wellbeing', 'yellow'],
    ['Family & friends', 'pink'],
  ]
  await Promise.all(
    starters.map(([name, colour], i) =>
      setDoc(doc(userCollection(uid, 'projects')), { name, colour, uid, createdAt: Date.now() + i }),
    ),
  )
}
