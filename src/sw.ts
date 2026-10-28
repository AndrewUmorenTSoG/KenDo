/// <reference lib="webworker" />
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// App shell caching, so KenDo opens with no connection.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/\.netlify\//, /^\/api\//] }))

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// Reminders arrive as data-only pushes so we control the notification and its snooze buttons.
if (import.meta.env.VITE_FIREBASE_API_KEY) {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })

  onBackgroundMessage(getMessaging(app), (payload) => {
    const data = payload.data ?? {}
    self.registration.showNotification(data.title || 'KenDo reminder', {
      body: data.body || '',
      tag: data.taskId,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data,
      actions: [
        { action: 'snooze-10', title: 'Snooze 10 min' },
        { action: 'snooze-60', title: 'Snooze 1 hour' },
      ],
    } as NotificationOptions)
  })
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const taskId = event.notification.data?.taskId as string | undefined
  const minutes = event.action.startsWith('snooze-') ? event.action.split('-')[1] : null
  const url = taskId && minutes ? `/snooze/${taskId}?minutes=${minutes}` : taskId ? `/tasks?open=${taskId}` : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients[0] as WindowClient | undefined
      if (existing) return existing.navigate(url).then((c) => c?.focus())
      return self.clients.openWindow(url)
    }),
  )
})
