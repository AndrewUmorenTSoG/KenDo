import { todayKey } from './dates'

// Downloads everything as a JSON backup.
export function exportData(data: object) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kendo-backup-${todayKey()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
