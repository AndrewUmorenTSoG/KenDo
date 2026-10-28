import type { NewTask, Priority } from './types'

// Lightweight parsing for the quick-add box until the AI layer exists:
//   "Pay rent #home !high"  -> title "Pay rent", tags ["home"], priority high
export function parseQuickAdd(input: string): NewTask {
  const tags: string[] = []
  let priority: Priority | undefined

  const title = input
    .replace(/(^|\s)#([\w-]+)/g, (_, space, tag) => {
      tags.push(tag.toLowerCase())
      return space
    })
    .replace(/(^|\s)!(high|medium|med|low)\b/gi, (_, space, p: string) => {
      const value = p.toLowerCase()
      priority = value === 'med' ? 'medium' : (value as Priority)
      return space
    })
    .replace(/\s+/g, ' ')
    .trim()

  return { title, tags, ...(priority ? { priority } : {}) }
}
