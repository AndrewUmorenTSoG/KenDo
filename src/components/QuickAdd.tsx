import { useState, type FormEvent } from 'react'
import { useStore } from '../data/store'
import { createTask } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { parseQuickAdd } from '../lib/quickAdd'
import Icon from './Icon'

const examples = ['Call Pooks', 'Have quiet time', 'Speak to Mum', 'Check on Bacenta Shepherds', 'Read a chapter', 'Plan the week']
const randomExample = () => examples[Math.floor(Math.random() * examples.length)]

export default function QuickAdd() {
  const { uid, projects } = useStore()
  const { toast } = useUI()
  const [text, setText] = useState('')
  const [example, setExample] = useState(randomExample)

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseQuickAdd(text)
    if (!parsed.title) return
    const personal = projects.find((p) => p.name === 'Personal') ?? projects[0]
    // Firestore queues the write offline, so the box clears straight away.
    createTask(uid, { projectId: personal?.id ?? null, ...parsed })
    setText('')
    setExample(randomExample())
    toast('Task captured. A little more headspace.')
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <Icon name="plus" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Quick task title"
        placeholder={example}
        maxLength={180}
        required
      />
      <button type="submit">Add</button>
    </form>
  )
}
