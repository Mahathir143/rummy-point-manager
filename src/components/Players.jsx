import { useState } from 'react'
import { Modal, Confirm } from './Modal.jsx'

export function PlayerManager({ store, compact }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)       // { id, name, draft }
  const [confirming, setConfirming] = useState(null) // { kind, player, draft }

  const players = store.players

  function gamesFor(playerId) {
    return store.games.filter((g) => g.participants.some((p) => p.playerId === playerId)).length
  }

  async function add(e) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    if (players.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
      setError(`${clean} is already on the list.`)
      return
    }
    try {
      await store.addPlayer(clean)
      setName('')
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={compact ? '' : 'panel'}>
      {!compact && (
        <header>
          <h2>Players</h2>
          <p className="sub">Everyone who sits at your table. This list is shared with every member.</p>
        </header>
      )}

      <form className="row" onSubmit={add} style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Player name"
          value={name}
          onChange={(e) => { setName(e.target.value); setError('') }}
          style={{ flex: '1 1 220px' }}
          aria-label="Player name"
        />
        <button className="btn primary" disabled={!name.trim()}>Add player</button>
      </form>
      {error && <div className="notice error" style={{ marginBottom: 12 }}>{error}</div>}

      {players.length === 0 ? (
        <div className="empty">No players yet. Add the first name above to get started.</div>
      ) : (
        <ul className="list">
          {players.map((p) => (
            <li key={p.id}>
              <span className="name">{p.name}</span>
              <span className="meta">{gamesFor(p.id)} game{gamesFor(p.id) === 1 ? '' : 's'}</span>
              <span className="actions">
                <button className="btn ghost small" onClick={() => setEditing({ ...p, draft: p.name })}>Edit</button>
                <button className="btn danger small" onClick={() => setConfirming({ kind: 'remove', player: p })}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal
          title={`Edit ${editing.name}`}
          sub="The new name replaces the old one in every saved game."
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button
                className="btn primary"
                disabled={!editing.draft.trim() || editing.draft.trim() === editing.name}
                onClick={() => setConfirming({ kind: 'edit', player: editing, draft: editing.draft.trim() })}
              >
                Save name
              </button>
            </>
          }
        >
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="rename">Name</label>
            <input id="rename" type="text" value={editing.draft}
              onChange={(e) => setEditing({ ...editing, draft: e.target.value })} />
          </div>
        </Modal>
      )}

      {confirming && confirming.kind === 'edit' && (
        <Confirm
          title="Rename this player?"
          message={`${confirming.player.name} becomes ${confirming.draft} everywhere, including in games already played.`}
          okLabel="Rename"
          onCancel={() => setConfirming(null)}
          onOk={() => {
            store.renamePlayer(confirming.player.id, confirming.draft)
            setConfirming(null)
            setEditing(null)
          }}
        />
      )}

      {confirming && confirming.kind === 'remove' && (
        <Confirm
          title="Remove this player?"
          danger
          okLabel="Remove"
          message={
            gamesFor(confirming.player.id) > 0
              ? `${confirming.player.name} is used in ${gamesFor(confirming.player.id)} saved game(s). Those score sheets keep the name, but you can no longer pick this player for a new game.`
              : `${confirming.player.name} will be taken off the player list.`
          }
          onCancel={() => setConfirming(null)}
          onOk={() => { store.removePlayer(confirming.player.id); setConfirming(null) }}
        />
      )}
    </div>
  )
}
