import { useEffect } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { snoozeTask } from '../data/tasks'
import { useUI } from '../hooks/useUI'

// Opened from a reminder's snooze button: pushes the reminder back and returns to My day.
export default function SnoozePage() {
  const { uid, tasks, loading } = useStore()
  const { toast } = useUI()
  const { taskId } = useParams()
  const [params] = useSearchParams()
  const minutes = Number(params.get('minutes')) || 10
  const task = tasks.find((t) => t.id === taskId)

  useEffect(() => {
    if (!task) return
    snoozeTask(uid, task, minutes)
    toast(`Snoozed for ${minutes} minutes.`)
    // Only once per visit, not on every task update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  if (loading || (taskId && !task && tasks.length === 0)) return null
  return <Navigate to="/" replace />
}
