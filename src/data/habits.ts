import { addDoc, deleteDoc, updateDoc } from 'firebase/firestore'
import type { FocusSession, Habit } from '../lib/types'
import { userCollection, userDoc } from './collection'

export function createHabit(uid: string, title: string, area: string) {
  const habit: Omit<Habit, 'id'> = { title, area, icon: 'habit', days: [], uid, createdAt: Date.now() }
  return addDoc(userCollection(uid, 'habits'), habit)
}

export function toggleHabitDay(uid: string, habit: Habit, day: string) {
  const days = habit.days.includes(day) ? habit.days.filter((d) => d !== day) : [...habit.days, day]
  return updateDoc(userDoc(uid, 'habits', habit.id), { days })
}

export function deleteHabit(uid: string, id: string) {
  return deleteDoc(userDoc(uid, 'habits', id))
}

export function logFocusSession(uid: string, session: Pick<FocusSession, 'date' | 'minutes' | 'taskId' | 'projectId'>) {
  return addDoc(userCollection(uid, 'focusSessions'), { ...session, uid, createdAt: Date.now() })
}
