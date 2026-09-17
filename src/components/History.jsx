import { useState } from 'react'
import { recompute, reopenGame, buildStats } from '../lib/game.js'
import { ScoreTable } from './ScoreTable.jsx'
import { Confirm } from './Modal.jsx'

export function History({ store }) {
  const [open, setOpen] = useState(null)
  const [confirming, setConfirming] = useState(null)

  const finished = store.games.filter((g) => g.status === 'finished').map(recompute)
  const stats = buildStats(store.games.map(recompute), store.players)
  const played = stats.filter((s) => s.games > 0)

  return (
    <>
      <div className="panel">
        <header>
          <h2>History</h2>
          <p className="sub">Every finished game keeps its full match-by-match sheet.</p>
        </header>

        {finished.length === 0 ? (
          <div className="empty">No finished games yet. End a game to file it here.</div>
        ) : (
          <ul className="list">
            {finished.map((g) => (
              <li key={g.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div className="spread">
                  <div>
                    <div className="name">{g.name}</div>
                    <div className="meta">
                      Won by {g.winnerName || '—'} · {g.rounds.length} matches ·{' '}
                      {new Date(g.finishedAt || g.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="actions">
                    <button className="btn ghost small" onClick={() => setOpen(open === g.id ? null : g.id)}>
                      {open === g.id ? 'Hide sheet' : 'View sheet'}
                    </button>
                    <button className="btn small" onClick={() => setConfirming({ kind: 'reopen', game: g })}>Reopen</button>
                    <button className="btn danger small" onClick={() => setConfirming({ kind: 'delete', game: g })}>Delete</button>
                  </span>
                </div>
                {open === g.id && (
                  <div style={{ marginTop: 12 }}>
                    <ScoreTable game={g} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <header>
          <h2>Statistics</h2>
          <p className="sub">Across every game saved on this account, finished or still running.</p>
        </header>

        {played.length === 0 ? (
          <div className="empty">Play a match and the numbers show up here.</div>
        ) : (
          <div className="table-wrap">
            <table className="score">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Games</th>
                  <th>Wins</th>
                  <th>Matches</th>
                  <th>Points</th>
                  <th>Average</th>
                  <th>Shows</th>
                  <th>Drops</th>
                  <th>Full counts</th>
                  <th>Re-entries</th>
                </tr>
              </thead>
              <tbody>
                {played.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.games}</td>
                    <td>{s.wins}</td>
                    <td>{s.matches}</td>
                    <td>{s.points}</td>
                    <td>{s.average}</td>
                    <td>{s.shows}</td>
                    <td>{s.drops}</td>
                    <td>{s.fulls}</td>
                    <td>{s.reEntries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirming && confirming.kind === 'delete' && (
        <Confirm
          title="Delete this game?"
          danger
          okLabel="Delete game"
          message={`${confirming.game.name} and its score sheet are removed for good.`}
          onCancel={() => setConfirming(null)}
          onOk={() => {
            store.deleteGame(confirming.game.id)
            setConfirming(null)
          }}
        />
      )}

      {confirming && confirming.kind === 'reopen' && (
        <Confirm
          title="Reopen this game?"
          okLabel="Reopen"
          message={`${confirming.game.name} moves back to Continue a game so you can add more matches.`}
          onCancel={() => setConfirming(null)}
          onOk={() => {
            store.saveGame(reopenGame(confirming.game))
            setConfirming(null)
          }}
        />
      )}
    </>
  )
}
