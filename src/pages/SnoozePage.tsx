import { useEffect } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { updateTask } from '../data/tasks'
import { useUid } from '../hooks/useAuth'

// Opened from a reminder's snooze button: pushes the reminder back and returns to Today.
export default function SnoozePage() {
  const uid = useUid()
  const { taskId } = useParams()
  const [params] = useSearchParams()
  const minutes = Number(params.get('minutes')) || 10

  useEffect(() => {
    if (taskId) updateTask(uid, taskId, { remindAt: Date.now() + minutes * 60_000 })
  }, [uid, taskId, minutes])

  return <Navigate to="/" replace />
}
