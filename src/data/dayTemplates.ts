import { addDoc, deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { planApply, starterTemplates, type ApplyMode, type DayTemplate, type TemplateItem } from '../lib/dayTemplates'
import type { Task } from '../lib/types'
import { profileDoc, userCollection, userDoc } from './collection'
import { blankTask, taskCollection, taskRef } from './tasks'

export async function seedDayTemplates(uid: string) {
  const batch = writeBatch(db)
  starterTemplates.forEach((t, i) => batch.set(doc(userCollection(uid, 'dayTemplates')), { ...t, uid, createdAt: Date.now() + i }))
  batch.set(profileDoc(uid), { dayTypesSeeded: true }, { merge: true })
  return batch.commit()
}

export const createDayTemplate = (uid: string, name: string, items: TemplateItem[]) =>
  addDoc(userCollection(uid, 'dayTemplates'), { name, items, uid, createdAt: Date.now() })

export const saveDayTemplate = (uid: string, t: Pick<DayTemplate, 'id' | 'name' | 'items'>) =>
  updateDoc(userDoc(uid, 'dayTemplates', t.id), { name: t.name, items: t.items })

export const deleteDayTemplate = (uid: string, id: string) => deleteDoc(userDoc(uid, 'dayTemplates', id))

export const restoreDayTemplate = (uid: string, t: DayTemplate) => {
  const { id, ...rest } = t
  return setDoc(userDoc(uid, 'dayTemplates', id), rest)
}

// Writes a template onto a day in one batch and returns what happened plus a way to undo it.
// Replaced tasks go to the Inbox; nothing is deleted.
export function applyDayTemplate(uid: string, template: Pick<DayTemplate, 'name' | 'items'>, date: string, dayTasks: Task[], mode: ApplyMode, projectId: string | null) {
  const plan = planApply(template.items, dayTasks, mode)
  const batch = writeBatch(db)
  const created = plan.create.map((it) => {
    const ref = doc(taskCollection(uid, projectId))
    const { activity: _a, ...task } = blankTask(uid, { title: it.title, date, time: it.time, estimate: it.estimate, colour: it.colour ?? null, projectId })
    batch.set(ref, { ...task, activity: [`From “${template.name}” · ${new Date().toLocaleString('en-GB')}`] })
    return ref
  })
  for (const t of plan.toInbox) batch.update(taskRef(uid, t), { date: '', time: '', remindAt: null, reminder: false, updatedAt: Date.now() })
  batch.commit().catch(() => undefined)

  const undo = () => {
    const back = writeBatch(db)
    for (const ref of created) back.delete(ref)
    for (const t of plan.toInbox) back.update(taskRef(uid, t), { date: t.date, time: t.time, remindAt: t.remindAt, reminder: t.reminder, updatedAt: Date.now() })
    back.commit().catch(() => undefined)
  }
  return { plan, undo }
}
