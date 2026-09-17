import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, configured } from './lib/supabase.js'
import * as db from './lib/db.js'
import { AuthScreen, ChangePassword } from './components/Auth.jsx'
import { PlayerManager } from './components/Players.jsx'
import { NewGame } from './components/NewGame.jsx'
import { ContinueGame } from './components/ContinueGame.jsx'
import { History } from './components/History.jsx'
import { GameBoard } from './components/GameBoard.jsx'
import { Members } from './components/Members.jsx'
import { Modal } from './components/Modal.jsx'

const TABS = [
  { id: 'players', label: 'Players' },
  { id: 'continue', label: 'Continue a game' },
  { id: 'new', label: 'New game' },
  { id: 'history', label: 'History & statistics' },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [ready, setReady] = useState(false)
  const [players, setPlayers] = useState([])
  const [games, setGames] = useState([])
  const [message, setMessage] = useState(null)
  const [tab, setTab] = useState('continue')
  const [openGameId, setOpenGameId] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const writing = useRef(0)

  useEffect(() => {
    if (!configured) { setReady(true); return undefined }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    try {
      const next = await db.fetchAll()
      setPlayers(next.players)
      setGames(next.games)
    } catch (err) {
      setMessage({ kind: 'error', text: err.message })
    }
  }, [])

  useEffect(() => {
    if (!session) { setPlayers([]); setGames([]); setProfile(null); return undefined }
    refresh()
    supabase.from('profiles').select('id,email,display_name,is_admin').eq('id', session.user.id)
      .maybeSingle().then(({ data }) => setProfile(data))
    // Any change made by anyone pulls the latest sheet down.
    return db.subscribe(() => { if (writing.current === 0) refresh() })
  }, [session, refresh])

  async function run(fn) {
    writing.current += 1
    try {
      await fn()
    } catch (err) {
      if (err.conflict) {
        setMessage({ kind: 'error', text: 'Another device saved first — showing the latest scores.' })
      } else {
        setMessage({ kind: 'error', text: err.message })
      }
      await refresh()
    } finally {
      writing.current -= 1
    }
  }

  const userId = session ? session.user.id : null

  const store = {
    players,
    games,
    addPlayer: async (name) => {
      const player = await db.insertPlayer(name, userId)
      setPlayers((ps) => [...ps, player].sort((a, b) => a.name.localeCompare(b.name)))
      return player
    },
    renamePlayer: (id, name) => run(async () => {
      await db.renamePlayer(id, name, games)
      await refresh()
    }),
    removePlayer: (id) => run(async () => {
      setPlayers((ps) => ps.filter((p) => p.id !== id))
      await db.deletePlayer(id)
    }),
    createGame: (game) => run(async () => {
      setGames((gs) => [game, ...gs])
      const saved = await db.insertGame(game, userId)
      setGames((gs) => gs.map((g) => (g.id === saved.id ? saved : g)))
    }),
    saveGame: (next) => run(async () => {
      setGames((gs) => gs.map((g) => (g.id === next.id ? next : g)))
      const saved = await db.saveGame(next, userId)
      setGames((gs) => gs.map((g) => (g.id === saved.id ? saved : g)))
    }),
    deleteGame: (id) => run(async () => {
      setGames((gs) => gs.filter((g) => g.id !== id))
      await db.deleteGame(id)
    }),
  }

  if (!configured) {
    return (
      <div className="auth-wrap"><div className="auth"><div className="panel">
        <h2>Almost there</h2>
        <p className="sub">
          Add <span className="code">VITE_SUPABASE_URL</span> and <span className="code">VITE_SUPABASE_ANON_KEY</span>
          {' '}to your environment, then restart the dev server or redeploy. Both values are in your Supabase
          project under Settings → API.
        </p>
      </div></div></div>
    )
  }

  if (!ready) return null
  if (!session) return <AuthScreen />

  const isAdmin = Boolean(profile && profile.is_admin)
  const tabs = isAdmin ? [...TABS, { id: 'members', label: 'Members' }] : TABS
  const openGame = openGameId ? games.find((g) => g.id === openGameId) : null

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <h1>Rummy Points</h1>
          <span className="suit">♦ ♣ ♥ ♠</span>
        </div>
        <div className="topbar-right">
          <span className="who">Signed in as <b>{profile ? profile.display_name || profile.email : session.user.email}</b></span>
          <button className="btn light small" onClick={() => setShowPassword(true)}>Change password</button>
          <button className="btn light small" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>

      {!openGame && (
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="page" style={{ paddingTop: openGame ? 20 : 0 }}>
        {message && (
          <div className={`notice ${message.kind === 'error' ? 'error' : 'good'}`}
            style={{ maxWidth: 1100, margin: '14px 0' }} onClick={() => setMessage(null)}>
            {message.text}
          </div>
        )}
        {openGame ? (
          <GameBoard
            gameId={openGameId}
            store={store}
            onExit={() => { setOpenGameId(null); setTab('continue') }}
          />
        ) : (
          <>
            {tab === 'players' && <PlayerManager store={store} />}
            {tab === 'continue' && <ContinueGame store={store} onOpen={setOpenGameId} />}
            {tab === 'new' && <NewGame store={store} onStarted={setOpenGameId} />}
            {tab === 'history' && <History store={store} />}
            {tab === 'members' && isAdmin && <Members me={session.user} />}
          </>
        )}
      </div>

      {showPassword && (
        <Modal title="Change your password" onClose={() => setShowPassword(false)}>
          <ChangePassword
            email={session.user.email}
            onCancel={() => setShowPassword(false)}
            onDone={() => {
              setShowPassword(false)
              setMessage({ kind: 'good', text: 'Password changed.' })
            }}
          />
        </Modal>
      )}
    </div>
  )
}
