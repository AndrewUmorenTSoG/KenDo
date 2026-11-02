import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import type { NewTask } from '../lib/types'

export type Overlay =
  | { kind: 'task'; id: string | null; defaults?: Partial<NewTask> }
  | { kind: 'note'; id: string | null }
  | { kind: 'confirm'; title: string; text: string; onConfirm: () => void }
  | { kind: 'prompt'; title: string; label: string; onSubmit: (value: string) => void }
  | { kind: 'plan' }
  | { kind: 'reminders' }
  | { kind: 'templates' }
  | { kind: 'shared'; projectId?: string }
  | { kind: 'search'; query?: string }
  | { kind: 'replan' }

export interface ToastAction {
  label: string
  run: () => void
}

interface UI {
  overlay: Overlay | null
  open: (overlay: Overlay) => void
  close: () => void
  // An optional action, such as Undo, shows as a button in the toast.
  toast: (message: string, action?: ToastAction) => void
  toastMessage: string
  toastAction: ToastAction | null
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
}

const UIContext = createContext<UI | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [toastAction, setToastAction] = useState<ToastAction | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const timeout = useRef<number>(undefined)

  const toast = useCallback((message: string, action?: ToastAction) => {
    setToastMessage(message)
    setToastAction(action ?? null)
    clearTimeout(timeout.current)
    // A little longer when there's something to press.
    timeout.current = window.setTimeout(() => {
      setToastMessage('')
      setToastAction(null)
    }, action ? 6500 : 3800)
  }, [])

  const value: UI = {
    overlay,
    open: setOverlay,
    close: () => setOverlay(null),
    toast,
    toastMessage,
    toastAction,
    menuOpen,
    setMenuOpen,
  }
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ui = useContext(UIContext)
  if (!ui) throw new Error('useUI must be used inside UIProvider')
  return ui
}
