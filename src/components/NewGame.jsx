import { useState } from 'react'
import { DEFAULT_CONFIG, CONFIG_FIELDS, createGame } from '../lib/game.js'
import { PlayerManager } from './Players.jsx'

export function NewGame({ store, onStarted }) {
  const [name, setName] = useState('')
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [picked, setPicked] = useState([])
  const [showPlayers, setShowPlayers] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  function start() {
    if (picked.length < 2) { setError('Pick at least two players.'); return }
    const bad = CONFIG_FIELDS.find((f) => config[f.key] === '' || Number.isNaN(Number(config[f.key])))
    if (bad) { setError(`Enter a number for “${bad.label}”.`); return }
    if (Number(config.totalPoints) <= 0) { setError('The total points limit must be above zero.'); return }

    const players = picked.map((id) => store.players.find((p) => p.id === id)).filter(Boolean)
    const game = createGame({
      name: name.trim(),
      config: Object.fromEntries(CONFIG_FIELDS.map((f) => [f.key, Number(config[f.key])])),
      players,
    })
    store.createGame(game)
    setName('')
    setPicked([])
    onStarted(game.id)
  }

  return (
    <>
      <div className="panel">
        <header>
          <h2>New game</h2>
          <p className="sub">Choose who is playing and the points this table runs on.</p>
        </header>

        <div className="field" style={{ maxWidth: 360 }}>
          <label htmlFor="gname">Game name</label>
          <input id="gname" type="text" placeholder="Friday night" value={name} onChange={(e) => setName(e.target.value)} />
          <span className="hint">Leave blank to name it by today's date.</span>
        </div>

        <h3 style={{ fontSize: 16, margin: '22px 0 10px' }}>Points</h3>
        <div className="grid">
          {CONFIG_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                type="number"
                min="0"
                inputMode="numeric"
                value={config[f.key]}
                onChange={(e) => { setConfig({ ...config, [f.key]: e.target.value }); setError('') }}
              />
              <span className="hint">{f.hint}</span>
            </div>
          ))}
        </div>

        <div className="spread" style={{ margin: '24px 0 10px' }}>
          <h3 style={{ fontSize: 16 }}>Players ({picked.length} picked)</h3>
          <button className="btn ghost small" onClick={() => setShowPlayers((s) => !s)}>
            {showPlayers ? 'Hide player list' : 'Add, edit or remove players'}
          </button>
        </div>

        {store.players.length === 0 ? (
          <div className="empty">No players on your list yet. Open the player list above and add a few names.</div>
        ) : (
          <div className="grid">
            {store.players.map((p) => (
              <label className="pickable" key={p.id} data-on={picked.includes(p.id)}>
                <input type="checkbox" checked={picked.includes(p.id)} onChange={() => { toggle(p.id); setError('') }} />
                <span className="name">{p.name}</span>
              </label>
            ))}
          </div>
        )}

        {error && <div className="notice error" style={{ marginTop: 14 }}>{error}</div>}

        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn primary" onClick={start} disabled={picked.length < 2}>Start game</button>
        </div>
      </div>

      {showPlayers && (
        <div className="panel">
          <header><h2>Player list</h2></header>
          <PlayerManager store={store} compact />
        </div>
      )}
    </>
  )
}
