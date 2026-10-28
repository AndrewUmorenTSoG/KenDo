import { useState } from 'react'
import type { Energy, Priority, Task } from '../lib/types'
import { Segmented } from './bits'

export type DoneFilter = 'all' | 'open' | 'done'

export interface TaskFilters {
  done: DoneFilter
  priority: Priority | 'all'
  energy: Energy | 'all'
}

export function useTaskFilters() {
  const [filters, setFilters] = useState<TaskFilters>({ done: 'all', priority: 'all', energy: 'all' })
  const apply = (list: Task[], query = '') => {
    const q = query.trim().toLowerCase()
    return list.filter(
      (t) =>
        (filters.done === 'all' || (filters.done === 'done' ? t.status === 'done' : t.status !== 'done')) &&
        (filters.priority === 'all' || t.priority === filters.priority) &&
        (filters.energy === 'all' || t.energy === filters.energy) &&
        (!q || `${t.title} ${t.tags.join(' ')} ${t.description}`.toLowerCase().includes(q)),
    )
  }
  return { filters, setFilters, apply }
}

export default function TaskToolbar({
  filters,
  setFilters,
}: {
  filters: TaskFilters
  setFilters: (f: TaskFilters) => void
}) {
  return (
    <div className="toolbar">
      <Segmented
        options={[
          ['all', 'All tasks'],
          ['open', 'To do'],
          ['done', 'Completed'],
        ]}
        value={filters.done}
        onChange={(done) => setFilters({ ...filters, done })}
      />
      <div className="row">
        <select
          aria-label="Filter by priority"
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value as TaskFilters['priority'] })}
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          aria-label="Filter by energy"
          value={filters.energy}
          onChange={(e) => setFilters({ ...filters, energy: e.target.value as TaskFilters['energy'] })}
        >
          <option value="all">All energy</option>
          <option value="high">High energy</option>
          <option value="low">Low energy</option>
        </select>
      </div>
    </div>
  )
}
