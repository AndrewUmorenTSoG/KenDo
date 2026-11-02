import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import LoginEntrance from './components/LoginEntrance'
import UpdateBanner from './components/UpdateBanner'
import { StoreProvider, useStore } from './data/store'
import { useAuth } from './hooks/useAuth'
import { FocusTimerProvider } from './hooks/useFocusTimer'
import { TaskActionsProvider } from './hooks/useTaskActions'
import { UIProvider } from './hooks/useUI'
import { firebaseConfigured } from './lib/firebase'
import CalendarPage from './pages/CalendarPage'
import ConnectPage from './pages/ConnectPage'
import FocusPage from './pages/FocusPage'
import HabitsPage from './pages/HabitsPage'
import InboxPage from './pages/InboxPage'
import JoinPage from './pages/JoinPage'
import MatrixPage from './pages/MatrixPage'
import MindmapPage from './pages/MindmapPage'
import NotesPage from './pages/NotesPage'
import ProjectsPage from './pages/ProjectsPage'
import ReviewPage from './pages/ReviewPage'
import SettingsPage from './pages/SettingsPage'
import SignInPage from './pages/SignInPage'
import SnoozePage from './pages/SnoozePage'
import TasksPage from './pages/TasksPage'
import TodayPage from './pages/TodayPage'
import WorkspacePage from './pages/WorkspacePage'
import WhatsNew from './components/WhatsNew'

export default function App() {
  return (
    <LoginEntrance duration={2200}>
      <UpdateBanner />
      <Screens />
    </LoginEntrance>
  )
}

function Screens() {
  const { user, loading } = useAuth()

  if (!firebaseConfigured) {
    return (
      <main className="center-screen">
        <h1>KenDo</h1>
        <p className="muted">
          Firebase isn't configured yet. Copy .env.example to .env and fill in your Firebase keys.
        </p>
      </main>
    )
  }
  if (loading) return <main className="center-screen muted">Loading…</main>
  if (!user) return <SignInPage />

  return (
    <LoginEntrance key={user.uid}>
      <StoreProvider uid={user.uid}>
        <UIProvider>
          <FocusTimerProvider>
            <TaskActionsProvider>
              <SignedIn />
            </TaskActionsProvider>
          </FocusTimerProvider>
        </UIProvider>
      </StoreProvider>
    </LoginEntrance>
  )
}

function SignedIn() {
  const { loading, uid } = useStore()
  if (loading) return <main className="center-screen muted">Gathering your day…</main>
  return (
    <>
    {location.pathname !== '/connect' && <WhatsNew uid={uid} />}
    <Routes>
      <Route path="connect" element={<ConnectPage />} />
      <Route element={<Layout />}>
        <Route index element={<TodayPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="focus" element={<FocusPage />} />
        <Route path="habits" element={<HabitsPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="matrix" element={<MatrixPage />} />
        <Route path="mindmap" element={<MindmapPage />} />
        <Route path="workspace" element={<WorkspacePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="snooze/:taskId" element={<SnoozePage />} />
        <Route path="join/:owner/:projectId/:code" element={<JoinPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </>
  )
}
