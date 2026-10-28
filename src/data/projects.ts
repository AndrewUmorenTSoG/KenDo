import { addDoc, updateDoc } from 'firebase/firestore'
import type { Project } from '../lib/types'
import { useCollection, userCollection, userDoc } from './collection'

export function useProjects(uid: string) {
  return useCollection<Project>(uid, 'projects')
}

export function createProject(uid: string, name: string, color = '#efb7cd', area: string | null = null) {
  const project: Omit<Project, 'id'> = { name, color, area, archived: false, uid, createdAt: Date.now() }
  return addDoc(userCollection(uid, 'projects'), project)
}

export function updateProject(uid: string, id: string, changes: Partial<Project>) {
  return updateDoc(userDoc(uid, 'projects', id), changes)
}
