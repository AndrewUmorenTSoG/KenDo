import { NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'

const links = [
  { to: '/', label: 'Today', end: true },
  { to: '/tasks', label: 'Tasks' },
  { to: '/notes', label: 'Notes' },
  { to: '/focus', label: 'Focus' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  // Applies the saved theme on every screen.
  useTheme()

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <span className="brand">KenDo</span>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="nav-link">
            {l.label}
          </NavLink>
        ))}
      </nav>
      <main id="main" className="content">
        <Outlet />
      </main>
    </div>
  )
}
