import { createContext, useContext, useState, type ReactNode } from 'react'
import { useStore } from '../data/store'
import { setStatus, toggleDone } from '../data/tasks'
import type { Status, Task } from '../lib/types'
import { useUI } from './useUI'

interface TaskActions {
  complete: (task: Task) => Promise<void>
  move: (task: Task, status: Status) => Promise<boolean>
  celebrating: string | null
}

const Context = createContext<TaskActions | null>(null)

// Completing a task shows the same messages and celebration everywhere it can be ticked off.
export function TaskActionsProvider({ children }: { children: ReactNode }) {
  const { uid, tasks, profile } = useStore()
  const { toast } = useUI()
  const [celebrating, setCelebrating] = useState<string | null>(null)

  async function complete(task: Task) {
    const finishing = task.status !== 'done'
    if ((await toggleDone(uid, task, tasks)) === 'blocked') {
      toast('Finish the prerequisite task first.')
      return
    }
    if (finishing && profile.celebrations) {
      setCelebrating(task.id)
      setTimeout(() => setCelebrating(null), 700)
      toast(task.repeat !== 'never' ? 'A little win! The next repeat is ready.' : 'One less thing on your mind. Nicely done.')
    } else toast('Task updated.')
  }

  async function move(task: Task, status: Status) {
    if (task.status === status) return true
    if ((await setStatus(uid, task, status, tasks)) === 'blocked') {
      toast('Finish the prerequisite task first.')
      return false
    }
    return true
  }

  return <Context.Provider value={{ complete, move, celebrating }}>{children}</Context.Provider>
}

export function useTaskActions() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useTaskActions must be used inside TaskActionsProvider')
  return ctx
}
