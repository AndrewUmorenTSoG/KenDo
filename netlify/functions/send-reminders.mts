import type { Config } from '@netlify/functions'
import { adminDb } from '../lib/admin.mts'
import { wantsTaskReminder } from '../../src/lib/notify.ts'
import type { Task } from '../../src/lib/types.ts'
import { people, sendDigests } from '../lib/digest.mts'
import { sendNudges } from '../lib/nudges.mts'
import { pushTo } from '../lib/push.mts'

// Runs every 5 minutes (every minute would use about a third of Netlify's free monthly credits): pushes
// tasks whose reminder time has passed to the owner's devices, then the morning and evening messages
// people asked for, then any encouraging nudges that are due. Quiet hours hold all of them back.
export default async () => {
  const db = adminDb()

  const due = await db
    .collectionGroup('tasks')
    .where('reminderSent', '==', false)
    .where('remindAt', '<=', Date.now())
    .limit(200)
    .get()

  const now = new Date()
  const owners = await people(db, due.docs.map((d) => d.data().uid), now)
  let sent = 0
  for (const taskDoc of due.docs) {
    const task = taskDoc.data()
    const owner = owners.get(task.uid)
    // In quiet hours the reminder waits for the next run after they end.
    if (owner?.quiet && task.status !== 'done') continue
    // Mark first so a slow send can't cause a duplicate on the next run.
    await taskDoc.ref.update({ reminderSent: true })
    if (task.status === 'done' || (owner && !wantsTaskReminder(task as Pick<Task, 'priority' | 'important'>, owner.prefs))) continue
    sent++
    await pushTo(db, task.uid, {
      taskId: taskDoc.id,
      title: task.title,
      body: task.time ? `Planned for ${task.time}` : 'Planned for today',
    })
  }

  const digests = await sendDigests(db, now)
  const nudged = await sendNudges(db, now)
  return new Response(`Sent ${sent} reminders, ${digests} daily messages and ${nudged} nudges`)
}

export const config: Config = { schedule: '*/5 * * * *' }
