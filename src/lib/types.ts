export type Priority = 'high' | 'medium' | 'low'
export type Status = 'todo' | 'doing' | 'done'
export type Energy = 'low' | 'high'
export type Repeat = 'never' | 'daily' | 'weekly' | 'monthly'

export interface Subtask {
  title: string
  done: boolean
}

export interface Comment {
  author: string
  text: string
  at: number
}

export interface Task {
  id: string
  title: string
  description: string
  projectId: string | null
  priority: Priority
  status: Status
  energy: Energy
  // Counts towards "important" in the priority matrix.
  important: boolean
  // Local calendar date and time ("2026-10-28", "09:00") so a task stays on the day it was planned.
  date: string
  time: string
  estimate: number
  repeat: Repeat
  // The task created by completing this one, so re-completing doesn't duplicate it.
  recurringFrom?: string | null
  tags: string[]
  subtasks: Subtask[]
  comments: Comment[]
  activity: string[]
  dependsOn: string | null
  noteId: string | null
  // Push reminder: remindAt is derived from date + time when `reminder` is on.
  reminder: boolean
  remindAt: number | null
  reminderSent: boolean
  completedOn: string | null
  uid: string
  createdAt: number
  updatedAt: number
  // Where the document lives, filled in by the store and never saved: users/{uid}/tasks/{id}, or
  // users/{owner}/projects/{projectId}/tasks/{id} for a shared project.
  path?: string
}

export type NoteColour = 'rose' | 'butter' | 'mint' | 'lilac' | 'peach'

export interface Note {
  id: string
  title: string
  // Sanitised HTML from the rich text editor.
  body: string
  colour: NoteColour
  projectId: string | null
  pinned: boolean
  archived: boolean
  uid: string
  createdAt: number
  updatedAt: number
}

export type ProjectColour = 'purple' | 'green' | 'yellow' | 'pink'

export interface Project {
  id: string
  name: string
  colour: ProjectColour
  // The owner. Projects shared with you belong to someone else.
  uid: string
  createdAt: number
  shared?: boolean
  members?: string[]
  memberNames?: Record<string, string>
  // Anyone with the invite link (which carries this code) can join until the owner makes a new one.
  inviteCode?: string
  joinCode?: string
}

export interface Habit {
  id: string
  title: string
  area: string
  icon: string
  // Date keys of the days it was done.
  days: string[]
  uid: string
  createdAt: number
}

export interface FocusSession {
  id: string
  date: string
  minutes: number
  taskId: string | null
  projectId: string | null
  uid: string
  createdAt: number
}

export interface Profile {
  name: string
  dark: boolean
  celebrations: boolean
  verses: boolean
  reflection: string
  seeded: boolean
}

export type NewTask = Partial<Omit<Task, 'id' | 'uid' | 'createdAt' | 'updatedAt' | 'path'>> & { title: string }
