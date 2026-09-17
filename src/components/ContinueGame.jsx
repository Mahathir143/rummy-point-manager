import { useState } from 'react'
import { recompute } from '../lib/game.js'
import { Confirm } from './Modal.jsx'

export function ContinueGame({ store, onOpen }) {
  const [confirming, setConfirming] = useState(null)
  const games = store.games.filter((g) => g.status === 'active').map(recompute)

  return (
    <div className="panel">
      <header>
        <h2>Continue a game</h2>
        <p className="sub">Games stay open until you end them, so you can pick up a table days later.</p>
      </header>

      {games.length === 0 ? (
        <div className="empty">Nothing in progress. Start one from the New game tab.</div>
      ) : (
        <ul className="list">
          {games.map((g) => {
            const live = g.participants.filter((p) => p.status === 'active')
            return (
              <li key={g.id}>
                <div>
                  <div className="name">{g.name}</div>
                  <div className="meta">
                    {g.rounds.length} match{g.rounds.length === 1 ? '' : 'es'} ·{' '}
                    {live.map((p) => `${p.name} ${p.total}`).join(' · ') || 'no one left in play'}
                  </div>
                  <div className="meta">Last played {new Date(g.updatedAt).toLocaleString()}</div>
                </div>
                <span className="actions">
                  <button className="btn primary small" onClick={() => onOpen(g.id)}>Continue</button>
                  <button className="btn danger small" onClick={() => setConfirming(g)}>Delete</button>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {confirming && (
        <Confirm
          title="Delete this game?"
          danger
          okLabel="Delete game"
          message={`${confirming.name} and all of its match points are removed for good.`}
          onCancel={() => setConfirming(null)}
          onOk={() => {
            store.deleteGame(confirming.id)
            setConfirming(null)
          }}
        />
      )}
    </div>
  )
}
