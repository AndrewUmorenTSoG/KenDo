import type { Config } from '@netlify/functions'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

// Runs every minute: finds tasks whose reminder time has passed and pushes them to the owner's devices.
export default async () => {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')) })
  }
  const db = getFirestore()
  const messaging = getMessaging()

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
    if (task.done) continue

    const devices = await db.collection('users').doc(task.uid).collection('devices').get()
    const tokens = devices.docs.map((d) => d.id)
    if (!tokens.length) continue

    const result = await messaging.sendEachForMulticast({
      tokens,
      data: { taskId: taskDoc.id, title: task.title, body: task.notes?.slice(0, 120) ?? 'Reminder' },
      webpush: { headers: { Urgency: 'high' } },
    })

    // Drop tokens for devices that uninstalled or revoked permission.
    await Promise.all(
      result.responses.map((r, i) => {
        const code = r.error?.code
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          return devices.docs[i].ref.delete()
        }
      }),
    )
  }

  return new Response(`Sent ${due.size} reminders`)
}

export const config: Config = { schedule: '* * * * *' }
