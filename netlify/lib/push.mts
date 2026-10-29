import type { Firestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

// Pushes a data-only message to every device someone has turned notifications on for.
export async function pushTo(db: Firestore, uid: string, data: Record<string, string>) {
  const devices = await db.collection('users').doc(uid).collection('devices').get()
  const tokens = devices.docs.map((d) => d.id)
  if (!tokens.length) return false

  const result = await getMessaging().sendEachForMulticast({ tokens, data, webpush: { headers: { Urgency: 'high' } } })

  // Drop tokens for devices that uninstalled or revoked permission.
  await Promise.all(
    result.responses.map((r, i) => {
      const code = r.error?.code
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        return devices.docs[i].ref.delete()
      }
    }),
  )
  return result.successCount > 0
}
