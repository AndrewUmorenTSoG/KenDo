import { onAuthStateChanged, type User } from 'firebase/auth'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth } from '../lib/firebase'

interface AuthState {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: auth.currentUser, loading: true })

  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

// For components rendered inside the signed-in shell.
export function useUid(): string {
  const { user } = useAuth()
  if (!user) throw new Error('useUid called outside the signed-in app')
  return user.uid
}
