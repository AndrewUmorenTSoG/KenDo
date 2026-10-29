import { useEffect, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { updateProfile, useStore } from '../data/store'
import { useAuth } from '../hooks/useAuth'
import { useUI } from '../hooks/useUI'
import { todayKey } from '../lib/dates'
import { applyTheme } from '../lib/themes'
import { IconButton } from './bits'
import Icon, { type IconName } from './Icon'
import Overlays from './Overlays'

export const pages: { path: string; label: string; icon: IconName; group: 'space' | 'more' | 'hidden' }[] = [
  { path: '/', label: 'My day', icon: 'sun', group: 'space' },
  { path: '/tasks', label: 'All tasks', icon: 'inbox', group: 'space' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar', group: 'space' },
  { path: '/projects', label: 'Projects', icon: 'board', group: 'space' },
  { path: '/notes', label: 'Sticky notes', icon: 'note', group: 'space' },
  { path: '/focus', label: 'Focus room', icon: 'focus', group: 'more' },
  { path: '/habits', label: 'Habits & goals', icon: 'habit', group: 'more' },
  { path: '/review', label: 'Weekly review', icon: 'chart', group: 'more' },
  { path: '/matrix', label: 'Priority matrix', icon: 'matrix', group: 'more' },
  { path: '/mindmap', label: 'Mind map', icon: 'map', group: 'more' },
  { path: '/workspace', label: 'Workspace', icon: 'team', group: 'hidden' },
  { path: '/settings', label: 'Settings', icon: 'settings', group: 'hidden' },
]

export const initials = (name: string, email?: string | null) =>
  (name || email || 'K')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

export default function Layout() {
  const { uid, tasks, projects, profile } = useStore()
  const { user } = useAuth()
  const { menuOpen, setMenuOpen, open, toastMessage } = useUI()
  const location = useLocation()
  const navigate = useNavigate()
  const [online, setOnline] = useState(navigator.onLine)
  const current = pages.find((p) => p.path === location.pathname) ?? pages[0]
  const todayOpen = tasks.filter((t) => t.date === todayKey() && t.status !== 'done').length
  const avatar = initials(profile.name, user?.email)

  useEffect(() => {
    applyTheme(profile.theme, profile.dark)
    try {
      localStorage.setItem('kendo-dark', profile.dark ? '1' : '0')
      localStorage.setItem('kendo-theme', profile.theme)
    } catch {
      // Only used to avoid a flash on the next load.
    }
  }, [profile.theme, profile.dark])

  useEffect(() => {
    document.title = `${current.label} · KenDo`
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }, [current, setMenuOpen])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.getElementById('global-search')?.focus()
      }
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      document.removeEventListener('keydown', onKey)
    }
  }, [setMenuOpen])

  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')?.toString().trim() ?? ''
    navigate(q ? `/tasks?q=${encodeURIComponent(q)}` : '/tasks')
  }

  const navItem = (p: (typeof pages)[number], count?: number) => (
    <NavLink key={p.path} to={p.path} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon name={p.icon} />
      {p.label}
      {count !== undefined && <span className="nav-count">{count}</span>}
    </NavLink>
  )

  return (
    <>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="check" />
          </span>
          KenDo<span className="dot" />
        </div>
        <button className="workspace-switch" onClick={() => navigate('/workspace')}>
          <span className="avatar small-avatar">{avatar[0]}</span>
          <div>
            <strong className="tiny">My workspace</strong>
            <p className="muted" style={{ fontSize: 9, marginTop: 3 }}>
              A little more intentional
            </p>
          </div>
          <span>
            <Icon name="down" />
          </span>
        </button>
        <div className="sidebar-scroll">
          <div className="nav-heading">YOUR SPACE</div>
          {pages.filter((p) => p.group === 'space').map((p) => navItem(p, p.path === '/' ? todayOpen : undefined))}
          <div className="nav-heading" style={{ marginTop: 19 }}>
            MAKE ROOM FOR MORE
          </div>
          {pages.filter((p) => p.group === 'more').map((p) => navItem(p))}
          <div className="nav-heading" style={{ marginTop: 19 }}>
            MY PROJECTS
          </div>
          {projects.slice(0, 6).map((p) => (
            <button key={p.id} className="nav-item" onClick={() => navigate(`/projects?project=${p.id}`)}>
              <span className={`dot ${p.colour}`} />
              {p.name}
            </button>
          ))}
          {navItem(pages.find((p) => p.path === '/settings')!)}
        </div>
        <div className="profile row">
          <span className="avatar">{avatar}</span>
          <div>
            <strong>{profile.name || 'You'}</strong>
            <p>Personal workspace</p>
          </div>
          <IconButton label="Open settings" icon="settings" onClick={() => navigate('/settings')} />
        </div>
      </aside>
      {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <div className="shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="icon-btn menu-toggle" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>
              <Icon name="menu" />
            </button>
            <span>My workspace</span>
            <Icon name="chevron" />
            <strong>{current.label}</strong>
          </div>
          <div className="top-actions">
            <form className="search" onSubmit={search} key={location.search}>
              <Icon name="search" />
              <input
                id="global-search"
                name="q"
                type="search"
                aria-label="Search tasks"
                placeholder="Search anything…"
                defaultValue={new URLSearchParams(location.search).get('q') ?? ''}
              />
              <kbd>Ctrl K</kbd>
            </form>
            <span className="local-status">
              <i className="dot" />
              {online ? 'Synced' : 'Offline · saved on this device'}
            </span>
            <IconButton
              label={profile.dark ? 'Switch to light mode' : 'Switch to dark mode'}
              icon={profile.dark ? 'sun' : 'moon'}
              onClick={() => updateProfile(uid, { dark: !profile.dark })}
            />
            <IconButton label="Reminders" icon="bell" onClick={() => open({ kind: 'reminders' })} />
            <span className="avatar small-avatar">{avatar}</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <Overlays />
      <div id="toast" role="status" aria-live="polite" className={toastMessage ? 'show' : ''}>
        {toastMessage}
      </div>
    </>
  )
}
