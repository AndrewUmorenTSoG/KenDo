import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import UpdateBanner from './components/UpdateBanner'
import { useAuth } from './hooks/useAuth'
import { firebaseConfigured } from './lib/firebase'
import FocusPage from './pages/FocusPage'
import NotesPage from './pages/NotesPage'
import SettingsPage from './pages/SettingsPage'
import SignInPage from './pages/SignInPage'
import SnoozePage from './pages/SnoozePage'
import TasksPage from './pages/TasksPage'
import TodayPage from './pages/TodayPage'

export default function App() {
  return (
    <>
      <UpdateBanner />
      <Screens />
    </>
  )
}

function Screens() {
  const { user, loading } = useAuth()

  if (!firebaseConfigured) {
    return (
      <main className="center-screen">
        <h1>KenDo</h1>
        <p className="muted">Firebase isn't configured yet. Copy .env.example to .env and fill in your Firebase keys.</p>
      </main>
    )
  }
  if (loading) return <main className="center-screen muted">Loading…</main>
  if (!user) return <SignInPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TodayPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="focus" element={<FocusPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="snooze/:taskId" element={<SnoozePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
