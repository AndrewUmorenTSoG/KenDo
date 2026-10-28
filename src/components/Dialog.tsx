import { useEffect, useRef, type ReactNode } from 'react'
import Icon from './Icon'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

// Native <dialog> for focus trapping, Escape to close and the backdrop from the design.
export default function Dialog({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
    return () => el?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-btn" aria-label="Close dialog" title="Close dialog" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  )
}
