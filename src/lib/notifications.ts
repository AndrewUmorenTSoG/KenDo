import { setDoc } from 'firebase/firestore'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { userDoc } from '../data/collection'
import { app } from './firebase'

export async function notificationsSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && (await isSupported())
}

// Asks for permission and registers this device so the reminder function can push to it.
// On iPhone this only works once KenDo has been added to the Home Screen.
export async function enableNotifications(uid: string): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!(await notificationsSupported())) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const registration = await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(app), {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  await setDoc(userDoc(uid, 'devices', token), {
    token,
    userAgent: navigator.userAgent,
    updatedAt: Date.now(),
  })
  return 'granted'
}
