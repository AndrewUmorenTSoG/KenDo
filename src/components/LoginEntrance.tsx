import { useEffect, useState, type ReactNode, type CSSProperties } from 'react'
import Brand from './Brand'

/** Mounted once per authenticated session; route changes do not replay it. */
export default function LoginEntrance({ children, duration = 1900 }: { children: ReactNode; duration?: number }) {
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const timeout = window.setTimeout(() => setEntering(false), duration)
    return () => window.clearTimeout(timeout)
  }, [duration])

  return (
    <>
      <div inert={entering} aria-hidden={entering || undefined}>
        {children}
      </div>
      {entering && (
        <div
          className="login-entrance"
          style={{ '--entrance-duration': `${duration}ms` } as CSSProperties}
          role="status"
          aria-label="Welcome to KenDo"
        >
          <Brand animated />
        </div>
      )}
    </>
  )
}
