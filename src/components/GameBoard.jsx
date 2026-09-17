import { useMemo, useState } from 'react'
import {
  addRound, updateRound, deleteRound, addPlayerMidGame, reEnterParticipant,
  finishGame, highestLiveScore, recompute,
} from '../lib/game.js'
import { ScoreTable } from './ScoreTable.jsx'
import { ScoreEntry } from './ScoreEntry.jsx'
import { Modal, Confirm } from './Modal.jsx'

export function GameBoard({ gameId, store, onExit }) {
  const stored = store.games.find((g) => g.id === gameId)
  const game = useMemo(() => (stored ? recompute(stored) : null), [stored])

  const [selected, setSelected] = useState(null)
  const [entry, setEntry] = useState(null)        // { round | null }
  const [dialog, setDialog] = useState(null)      // 're-entry' | 'add' | 'finish' | 'delete-round'
  const [newName, setNewName] = useState('')

  if (!game) {
    return <div className="panel"><p>That game is no longer saved.</p>
      <button className="btn" onClick={onExit} style={{ marginTop: 12 }}>Back</button></div>
  }

  function commit(next) {
    store.saveGame(next)
  }

  const live = game.participants.filter((p) => p.status === 'active')
  const out = game.participants.filter((p) => p.status === 'out')
  const selectedRound = game.rounds.find((r) => r.id === selected) || null
  const selectedIndex = game.rounds.findIndex((r) => r.id === selected)
  const base = highestLiveScore(game)
  const reEntryStart = base + (Number(game.config.reEntryPoint) || 0)
  const newPlayerStart = base + (Number(game.config.newPlayerPoint) || 0)
  const seatedIds = new Set(game.participants.map((p) => p.playerId))
  const bench = store.players.filter((p) => !seatedIds.has(p.id))
  const finished = game.status === 'finished'

  function addExisting(player) {
    commit(addPlayerMidGame(game, player))
    setDialog(null)
  }

  async function createAndAdd() {
    const clean = newName.trim()
    if (!clean) return
    const existing = store.players.find((p) => p.name.toLowerCase() === clean.toLowerCase())
    const player = existing || (await store.addPlayer(clean))
    commit(addPlayerMidGame(game, player))
    setNewName('')
    setDialog(null)
  }

  return (
    <div className="panel">
      <div className="spread">
        <div>
          <h2>{game.name}</h2>
          <p className="sub">
            {finished
              ? `Finished — ${game.winnerName || 'no winner recorded'} won.`
              : `${live.length} in play · ${game.rounds.length} match${game.rounds.length === 1 ? '' : 'es'} played`}
          </p>
        </div>
        <button className="btn ghost" onClick={onExit}>Back to menu</button>
      </div>

      <div className="row" style={{ margin: '14px 0' }}>
        <span className="pill">Limit <b>{game.config.totalPoints}</b></span>
        <span className="pill">Full <b>{game.config.fullPoint}</b></span>
        <span className="pill">Initial drop <b>{game.config.initialDropPoint}</b></span>
        <span className="pill">Middle drop <b>{game.config.middleDropPoint}</b></span>
        <span className="pill">Re-entry <b>+{game.config.reEntryPoint}</b></span>
        <span className="pill">New player <b>+{game.config.newPlayerPoint}</b></span>
      </div>

      {!finished && game.isOver && (
        <div className="notice good" style={{ marginBottom: 14 }}>
          Only {live[0] ? live[0].name : 'one player'} is left. End the game, or bring someone back in.
        </div>
      )}

      <ScoreTable
        game={game}
        selectedRoundId={selected}
        onSelectRound={finished ? undefined : setSelected}
      />

      {!finished && (
        <>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={() => setEntry({ round: null })} disabled={live.length < 2}>
              Enter points
            </button>
            <button className="btn" disabled={!selectedRound} onClick={() => setEntry({ round: selectedRound })}>
              Edit selected match
            </button>
            <button className="btn ghost" disabled={!selectedRound} onClick={() => setDialog('delete-round')}>
              Delete selected match
            </button>
            <button className="btn ghost" disabled={out.length === 0} onClick={() => setDialog('re-entry')}>
              Re-entry
            </button>
            <button className="btn ghost" onClick={() => setDialog('add')}>Add player</button>
            <button className="btn danger" onClick={() => setDialog('finish')}>End game</button>
          </div>
          <p className="sub" style={{ marginTop: 8 }}>
            {selectedRound
              ? `Match ${selectedIndex + 1} is selected.`
              : 'Tap a row in the table to edit or delete that match.'}
          </p>
        </>
      )}

      {game.events.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 16 }}>Entries during the game</h3>
          <ul className="list" style={{ marginTop: 8 }}>
            {game.events.map((ev) => (
              <li key={ev.id}>
                <span className="name">{ev.name}</span>
                <span className="meta">
                  {ev.kind === 're-entry' ? 're-entered' : 'joined'} after match {ev.afterRound} at {ev.points} points
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry && (
        <ScoreEntry
          game={game}
          round={entry.round}
          matchNumber={entry.round ? game.rounds.findIndex((r) => r.id === entry.round.id) + 1 : game.rounds.length + 1}
          onClose={() => setEntry(null)}
          onSave={(scores) => {
            commit(entry.round ? updateRound(game, entry.round.id, scores) : addRound(game, scores))
            setEntry(null)
            setSelected(null)
          }}
        />
      )}

      {dialog === 'delete-round' && selectedRound && (
        <Confirm
          title={`Delete match ${selectedIndex + 1}?`}
          danger
          okLabel="Delete match"
          message="The points from that match are removed and every total is recalculated."
          onCancel={() => setDialog(null)}
          onOk={() => { commit(deleteRound(game, selectedRound.id)); setSelected(null); setDialog(null) }}
        />
      )}

      {dialog === 're-entry' && (
        <Modal
          title="Bring a player back in"
          sub={`They restart on ${reEntryStart} — the highest score still in play (${base}) plus the re-entry point (${game.config.reEntryPoint}).`}
          onClose={() => setDialog(null)}
          footer={<button className="btn ghost" onClick={() => setDialog(null)}>Cancel</button>}
        >
          <ul className="list" style={{ marginTop: 14 }}>
            {out.map((p) => (
              <li key={p.id}>
                <span className="name">{p.name}</span>
                <span className="meta">went out on {p.total}</span>
                <span className="actions">
                  <button className="btn primary small" onClick={() => { commit(reEnterParticipant(game, p.id)); setDialog(null) }}>
                    Re-enter at {reEntryStart}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {dialog === 'add' && (
        <Modal
          title="Add a player to this game"
          sub={`They start on ${newPlayerStart} — the highest score still in play (${base}) plus the new player point (${game.config.newPlayerPoint}).`}
          onClose={() => setDialog(null)}
          footer={<button className="btn ghost" onClick={() => setDialog(null)}>Cancel</button>}
        >
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="quickname">New name</label>
            <div className="row">
              <input id="quickname" type="text" value={newName} placeholder="Player name"
                onChange={(e) => setNewName(e.target.value)} style={{ flex: '1 1 200px' }} />
              <button className="btn primary" disabled={!newName.trim()} onClick={createAndAdd}>
                Add at {newPlayerStart}
              </button>
            </div>
          </div>

          {bench.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, marginTop: 18 }}>Or pick someone already on your list</h3>
              <ul className="list" style={{ marginTop: 8 }}>
                {bench.map((p) => (
                  <li key={p.id}>
                    <span className="name">{p.name}</span>
                    <span className="actions">
                      <button className="btn small" onClick={() => addExisting(p)}>Add at {newPlayerStart}</button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal>
      )}

      {dialog === 'finish' && (
        <Confirm
          title="End this game?"
          message="It moves to History & statistics. The lowest score still in play is recorded as the winner."
          okLabel="End game"
          danger
          onCancel={() => setDialog(null)}
          onOk={() => { commit(finishGame(game)); setDialog(null); onExit() }}
        />
      )}
    </div>
  )
}
