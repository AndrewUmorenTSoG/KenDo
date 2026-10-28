import { useState, type FormEvent } from 'react'
import { createTask } from '../data/tasks'
import { useUid } from '../hooks/useAuth'
import { parseQuickAdd } from '../lib/quickAdd'
import type { NewTask } from '../lib/types'

export default function QuickAdd({ defaults, autoFocus }: { defaults?: Partial<NewTask>; autoFocus?: boolean }) {
  const uid = useUid()
  const [text, setText] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseQuickAdd(text)
    if (!parsed.title) return
    createTask(uid, { ...defaults, ...parsed })
    setText('')
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a task… try #tag or !high"
        aria-label="Quick add task"
      />
      <button className="btn primary" type="submit">
        Add
      </button>
    </form>
  )
}
