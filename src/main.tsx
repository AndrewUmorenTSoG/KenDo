import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import './styles.css'
import './app.css'
import './themes.css'

// Apply the last theme before React renders, so dark mode doesn't flash light on launch.
try {
  if (localStorage.getItem('kendo-dark') === '1') document.body.classList.add('dark')
  document.body.dataset.theme = localStorage.getItem('kendo-theme') ?? 'pink'
} catch {
  // Storage blocked: the theme arrives with the profile instead.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
