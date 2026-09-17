import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchProfiles, setAdmin, removeMember } from '../lib/db.js'
import { Confirm } from './Modal.jsx'

export function Members({ me }) {
  const [profiles, setProfiles] = useState([])
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(null)

  const load = () => fetchProfiles().then(setProfiles).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  // Creating an account with a generated password needs the service-role key,
  // which can only live on the server — see api/create-user.js.
  async function invite(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: email.trim() }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not create the account.')
      setNotice({ text: `${body.email} can sign in with`, code: body.password })
      setEmail('')
      load()
    } catch (err) {
      setError(`${err.message} If you have not added the serverless function and its service-role key, ask the person to use “Create account” on the sign-in screen instead.`)
    }
    setBusy(false)
  }

  return (
    <div className="panel">
      <header>
        <h2>Members</h2>
        <p className="sub">
          Everyone here shares the same players, games and score sheets. Removing someone cuts off
          their access immediately.
        </p>
      </header>

      <form className="row" onSubmit={invite}>
        <input type="email" placeholder="name@example.com" value={email} aria-label="Email"
          onChange={(e) => { setEmail(e.target.value); setError('') }} style={{ flex: '1 1 240px' }} />
        <button className="btn primary" disabled={busy || !email.trim()}>Create account with a password</button>
      </form>

      {error && <div className="notice error" style={{ marginTop: 12 }}>{error}</div>}
      {notice && (
        <div className="notice good" style={{ marginTop: 12 }}>
          {notice.text} <span className="code">{notice.code}</span> — shown once, pass it on and ask them to change it.
        </div>
      )}

      <ul className="list" style={{ marginTop: 16 }}>
        {profiles.map((p) => (
          <li key={p.id}>
            <span className="name">{p.display_name || p.email}</span>
            <span className="meta">{p.email}</span>
            {p.is_admin && <span className="pill live">admin</span>}
            <span className="actions">
              <button className="btn ghost small" disabled={p.id === me.id}
                onClick={() => setAdmin(p.id, !p.is_admin).then(load).catch((e) => setError(e.message))}>
                {p.is_admin ? 'Remove admin' : 'Make admin'}
              </button>
              <button className="btn danger small" disabled={p.id === me.id} onClick={() => setConfirming(p)}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      {confirming && (
        <Confirm
          title={`Remove ${confirming.email}?`}
          danger
          okLabel="Remove access"
          message="They lose access to every game straight away. The sign-in itself stays in Supabase until you delete it from the dashboard."
          onCancel={() => setConfirming(null)}
          onOk={() => {
            removeMember(confirming.id).then(load).catch((e) => setError(e.message))
            setConfirming(null)
          }}
        />
      )}
    </div>
  )
}
