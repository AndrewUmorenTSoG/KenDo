import { useEffect, useState, type ReactNode } from 'react'
import Brand from './Brand'

/** Mounted once per authenticated session; route changes do not replay it. */
export default function LoginEntrance({ children }: { children: ReactNode }) {
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const timeout = window.setTimeout(() => setEntering(false), 1900)
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <>
      <div inert={entering} aria-hidden={entering || undefined}>
        {children}
      </div>
      {entering && (
        <div className="login-entrance" role="status" aria-label="Welcome to KenDo">
          <Brand animated />
        </div>
      )}
    </>
  )
}
