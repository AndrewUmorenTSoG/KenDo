import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Firestore with full access, for server-side functions only.
export function adminDb() {
  if (!getApps().length) {
    const account = process.env.FIREBASE_SERVICE_ACCOUNT
    // Without a service account (local emulator runs) the Admin SDK falls back to its defaults.
    initializeApp(account ? { credential: cert(JSON.parse(account)) } : { projectId: process.env.GCLOUD_PROJECT })
  }
  return getFirestore()
}
