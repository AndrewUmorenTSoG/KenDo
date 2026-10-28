import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth'
import { useState, type FormEvent } from 'react'
import { auth } from '../lib/firebase'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'signin') await signInWithEmailAndPassword(auth, email, password)
      else await createUserWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function google() {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch {
      // Installed apps on some phones block popups; a redirect works there.
      await signInWithRedirect(auth, provider)
    }
  }

  return (
    <main className="center-screen">
      <form className="card stack sign-in" onSubmit={submit}>
        <div>
          <h1>KenDo</h1>
          <p className="muted">A little more intentional.</p>
        </div>
        <button type="button" className="btn" onClick={google}>
          Continue with Google
        </button>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn primary">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="text-btn" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </main>
  )
}
