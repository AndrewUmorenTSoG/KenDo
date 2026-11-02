import { useEffect, useState } from 'react'
import Brand from '../components/Brand'
import { useAuth } from '../hooks/useAuth'

interface Request {
  client_name: string
  redirect_host: string
  scopes: { scope: string; label: string }[]
}

const post = (path: string, body: unknown) =>
  fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(
    async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }),
  )

// /connect: an AI app (ChatGPT, Copilot…) asks to use this KenDo account. Opened by the app's sign-in flow.
export default function ConnectPage() {
  const { user } = useAuth()
  const [params] = useState(() => Object.fromEntries(new URLSearchParams(location.search)))
  const [request, setRequest] = useState<Request | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Never approve inside someone else's frame.
  const framed = window.top !== window.self

  useEffect(() => {
    if (framed) return
    post('/oauth/authorize/check', { params }).then(({ ok, data }) => {
      if (data.redirect) return location.replace(data.redirect)
      if (!ok) return setError(data.error_description ?? 'This link doesn’t work.')
      setRequest(data)
      setChosen(data.scopes.map((s: { scope: string }) => s.scope))
    })
  }, [params, framed])

  async function decide(approve: boolean) {
    setBusy(true)
    const idToken = await user!.getIdToken(true)
    const { data } = await post('/oauth/authorize/decision', { params, idToken, approve, scopes: chosen })
    if (data.redirect) return location.assign(data.redirect)
    setBusy(false)
    setError(data.error_description ?? 'Something went wrong.')
  }

  return (
    <main className="center-screen">
      <section className="panel connect">
        <Brand />
        {framed || error ? (
          <p>{framed ? 'Open this page in its own window.' : error}</p>
        ) : !request ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <h1>Connect {request.client_name}?</h1>
            <p className="small muted">
              {user?.email} · returns to {request.redirect_host}
            </p>
            <ul className="connect-scopes">
              {request.scopes.map((s) => (
                <li key={s.scope}>
                  <label>
                    <input
                      type="checkbox"
                      checked={chosen.includes(s.scope)}
                      onChange={(e) => setChosen((c) => (e.target.checked ? [...c, s.scope] : c.filter((x) => x !== s.scope)))}
                    />
                    {s.label}
                  </label>
                </li>
              ))}
            </ul>
            <div className="row">
              <button className="btn" disabled={busy} onClick={() => decide(false)}>
                Cancel
              </button>
              <button className="btn primary" disabled={busy || !chosen.length} onClick={() => decide(true)}>
                Allow
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
