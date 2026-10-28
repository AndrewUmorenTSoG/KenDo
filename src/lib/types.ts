export type Priority = 'high' | 'medium' | 'low'

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Recurrence {
  freq: RecurrenceFreq
  // Repeat every N units, e.g. every 2 weeks.
  interval: number
  // 0 = Sunday. Only used when freq is 'weekly'.
  weekdays?: number[]
}

export type Energy = 'low' | 'medium' | 'high'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: string
  title: string
  notes?: string
  priority: Priority
  done: boolean
  completedAt?: number | null
  // Epoch millis. Stored as numbers so they survive offline writes unchanged.
  dueAt?: number | null
  remindAt?: number | null
  reminderSent?: boolean
  recurrence?: Recurrence | null
  estimateMinutes?: number | null
  energy?: Energy | null
  projectId?: string | null
  tags: string[]
  subtasks: Subtask[]
  // Task ids that must be completed first.
  blockedBy: string[]
  noteIds: string[]
  // Owner uid, so the reminder function can find the user's devices.
  uid: string
  createdAt: number
  updatedAt: number
}

export type NoteColor = 'default' | 'pink' | 'sage' | 'lavender' | 'amber'

export interface Note {
  id: string
  title: string
  // Sanitised HTML from the rich text editor.
  body: string
  color: NoteColor
  pinned: boolean
  archived: boolean
  projectId?: string | null
  taskIds: string[]
  uid: string
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  color: string
  // Life area such as Work, Health, Finance, Family.
  area?: string | null
  archived: boolean
  uid: string
  createdAt: number
}

export type NewTask = Partial<Omit<Task, 'id' | 'uid' | 'createdAt' | 'updatedAt'>> & { title: string }
export type NewNote = Partial<Omit<Note, 'id' | 'uid' | 'createdAt' | 'updatedAt'>>
