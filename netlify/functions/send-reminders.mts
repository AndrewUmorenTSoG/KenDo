import type { Config } from '@netlify/functions'
import { adminDb } from '../lib/admin.mts'
import { sendNudges } from '../lib/nudges.mts'
import { pushTo } from '../lib/push.mts'

// Runs every 5 minutes (every minute would use about a third of Netlify's free monthly credits): pushes
// tasks whose reminder time has passed to the owner's devices, then any encouraging nudges that are due.
export default async () => {
  const db = adminDb()

  const due = await db
    .collectionGroup('tasks')
    .where('reminderSent', '==', false)
    .where('remindAt', '<=', Date.now())
    .limit(200)
    .get()

  for (const taskDoc of due.docs) {
    const task = taskDoc.data()
    // Mark first so a slow send can't cause a duplicate on the next run.
    await taskDoc.ref.update({ reminderSent: true })
    if (task.status === 'done') continue
    await pushTo(db, task.uid, {
      taskId: taskDoc.id,
      title: task.title,
      body: task.time ? `Planned for ${task.time}` : 'Planned for today',
    })
  }

  const nudged = await sendNudges(db)
  return new Response(`Sent ${due.size} reminders and ${nudged} nudges`)
}

export const config: Config = { schedule: '*/5 * * * *' }
