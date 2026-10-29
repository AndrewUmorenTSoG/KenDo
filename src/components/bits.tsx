import type { ReactNode } from 'react'
import type { Project } from '../lib/types'
import Icon, { type IconName } from './Icon'

export function PageHeading({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: string
  title: ReactNode
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  )
}

export function Stat({ label, value, foot, icon }: { label: string; value: ReactNode; foot?: ReactNode; icon: IconName }) {
  return (
    <div className="stat">
      <div className="stat-label">
        {label}
        <Icon name={icon} />
      </div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  )
}

export function Pill({ children, colour = '' }: { children: ReactNode; colour?: string }) {
  return <span className={`pill ${colour}`}>{children}</span>
}

export function ProjectPill({ project }: { project?: Project }) {
  return (
    <span className="pill">
      <span className={`dot ${project?.colour ?? ''}`} />
      {project?.name ?? 'No project'}
    </span>
  )
}

export function IconButton({
  label,
  icon,
  onClick,
  pressed,
  style,
}: {
  label: string
  icon: IconName
  onClick: () => void
  pressed?: boolean
  style?: React.CSSProperties
}) {
  return (
    <button className="icon-btn" aria-label={label} title={label} onClick={onClick} aria-pressed={pressed} style={style}>
      <Icon name={icon} />
    </button>
  )
}

export function Empty({ text = 'A little breathing room.', sub = 'No tasks match this view.' }) {
  return (
    <div className="empty">
      <Icon name="check" />
      <p>{text}</p>
      <p className="tiny">{sub}</p>
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button key={v} className={v === value ? 'active' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}
