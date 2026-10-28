import { useRegisterSW } from 'virtual:pwa-register/react'

// Registers the service worker (offline + push) and offers updates when a new version is deployed.
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div className="banner update-banner">
      A new version of KenDo is ready.{' '}
      <button className="text-btn" onClick={() => updateServiceWorker(true)}>
        Update
      </button>
    </div>
  )
}
