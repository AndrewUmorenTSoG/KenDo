import { createContext, useContext, useState, type ReactNode } from 'react'
import { countCompletion, useStore } from '../data/store'
import { celebrate } from '../lib/celebrate'
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

  // The 100th and 1000th completions get their own celebration.
  function counted() {
    const total = (profile.completedTotal ?? 0) + 1
    countCompletion(uid)
    if (!profile.celebrations) return false
    if (total === 100) celebrate({ kind: 'hundred' })
    if (total === 1000) celebrate({ kind: 'thousand' })
    return total === 100 || total === 1000
  }

  async function complete(task: Task) {
    const finishing = task.status !== 'done'
    if ((await toggleDone(uid, task, tasks)) === 'blocked') {
      toast('Finish the prerequisite task first.')
      return
    }
    const milestone = finishing && counted()
    if (finishing && profile.celebrations && !milestone) {
      setCelebrating(task.id)
      setTimeout(() => setCelebrating(null), 700)
      toast(task.repeat !== 'never' ? 'A little win! The next repeat is ready.' : 'One less thing on your mind. Nicely done.')
    } else if (!milestone) toast('Task updated.')
  }

  async function move(task: Task, status: Status) {
    if (task.status === status) return true
    if ((await setStatus(uid, task, status, tasks)) === 'blocked') {
      toast('Finish the prerequisite task first.')
      return false
    }
    if (status === 'done') counted()
    return true
  }

  return <Context.Provider value={{ complete, move, celebrating }}>{children}</Context.Provider>
}

export function useTaskActions() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useTaskActions must be used inside TaskActionsProvider')
  return ctx
}
