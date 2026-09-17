import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export function AuthScreen() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    if (mode === 'signin') {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) setError(err.message)
    } else {
      const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password })
      if (err) setError(err.message)
      else if (!data.session) setNotice('Check your inbox and confirm the address, then sign in.')
    }
    setBusy(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth">
        <div className="panel">
          <h2>Rummy Points <span className="suit">♦</span></h2>
          <p className="sub">Everyone signed in shares the same table, live.</p>

          <div className="row" style={{ marginTop: 16 }}>
            <button className={mode === 'signin' ? 'btn small' : 'btn ghost small'} onClick={() => setMode('signin')}>
              Sign in
            </button>
            <button className={mode === 'signup' ? 'btn small' : 'btn ghost small'} onClick={() => setMode('signup')}>
              Create account
            </button>
          </div>

          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }} />
            </div>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input id="pw" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} />
              {mode === 'signup' && <span className="hint">At least 6 characters.</span>}
            </div>
            {error && <div className="notice error">{error}</div>}
            {notice && <div className="notice good">{notice}</div>}
            <button className="btn primary" disabled={busy || !email || !password}>
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="sub" style={{ marginTop: 16 }}>The first account created becomes the admin.</p>
        </div>
      </div>
    </div>
  )
}

export function ChangePassword({ email, onDone, onCancel }) {
  const [oldPassword, setOld] = useState('')
  const [newPassword, setNew] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (newPassword !== confirm) { setError('The two new passwords do not match.'); return }
    if (newPassword.length < 6) { setError('Use at least 6 characters.'); return }
    setBusy(true)
    // Check the current password before changing it.
    const check = await supabase.auth.signInWithPassword({ email, password: oldPassword })
    if (check.error) { setBusy(false); setError('The current password is not correct.'); return }
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    setBusy(false)
    if (err) { setError(err.message); return }
    onDone()
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
      <div className="field">
        <label htmlFor="op">Current password</label>
        <input id="op" type="password" value={oldPassword} onChange={(e) => { setOld(e.target.value); setError('') }} />
      </div>
      <div className="field">
        <label htmlFor="np">New password</label>
        <input id="np" type="password" value={newPassword} onChange={(e) => { setNew(e.target.value); setError('') }} />
      </div>
      <div className="field">
        <label htmlFor="cp">Repeat new password</label>
        <input id="cp" type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError('') }} />
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="row">
        <button className="btn primary" disabled={busy || !oldPassword || !newPassword}>Save password</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
