import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from 'firebase/auth'
import { setDoc } from 'firebase/firestore'
import { useState, type FormEvent } from 'react'
import Brand from '../components/Brand'
import { profileDoc } from '../data/collection'
import { auth } from '../lib/firebase'

const friendly: Record<string, string> = {
  'auth/invalid-credential': 'That email and password don’t match.',
  'auth/user-not-found': 'That email and password don’t match.',
  'auth/wrong-password': 'That email and password don’t match.',
  'auth/email-already-in-use': 'There’s already an account with that email. Try signing in.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/network-request-failed': 'You seem to be offline. Connect once to sign in.',
}

export default function SignInPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const fail = (err: unknown) => setMessage(friendly[(err as { code?: string }).code ?? ''] ?? (err as Error).message)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      if (mode === 'signin') await signInWithEmailAndPassword(auth, email, password)
      else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        if (name.trim()) {
          await updateProfile(user, { displayName: name.trim() })
          await setDoc(profileDoc(user.uid), { name: name.trim() }, { merge: true })
        }
      }
    } catch (err) {
      fail(err)
    }
  }

  async function google() {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch (err) {
      // Installed apps on some phones block popups; a redirect works there.
      if ((err as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(auth, provider)
      else if ((err as { code?: string }).code !== 'auth/popup-closed-by-user') fail(err)
    }
  }

  async function reset() {
    if (!email) return setMessage('Enter your email above first.')
    await sendPasswordResetEmail(auth, email).catch(fail)
    setMessage('Check your inbox for a reset link.')
  }

  return (
    <main className="center-screen">
      <form className="sign-in" onSubmit={submit}>
        <div className="brand">
          <Brand />
        </div>
        <h1>{mode === 'signin' ? 'Welcome back.' : 'A little more intentional.'}</h1>
        <p className="muted small" style={{ marginTop: 6 }}>
          {mode === 'signin' ? 'Your tasks are right where you left them.' : 'Make a space for what matters.'}
        </p>

        <button type="button" className="btn" style={{ marginTop: 22 }} onClick={google}>
          Continue with Google
        </button>
        <div className="or">or with email</div>

        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="f-name">Your first name</label>
            <input id="f-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </div>
        )}
        <div className="field">
          <label htmlFor="f-email">Email</label>
          <input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="f-password">Password</label>
          <input
            id="f-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </div>
        {message && <p className="error">{message}</p>}
        <button type="submit" className="btn primary">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <div className="row between" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setMessage('')
            }}
          >
            {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
          </button>
          {mode === 'signin' && (
            <button type="button" className="text-btn" onClick={reset}>
              Forgot password?
            </button>
          )}
        </div>
      </form>
    </main>
  )
}
