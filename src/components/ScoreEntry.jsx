import { useState } from 'react'
import { Modal } from './Modal.jsx'
import { SCORE_TYPES, valueForType } from '../lib/game.js'

const QUICK = ['show', 'initial', 'middle', 'full']

export function ScoreEntry({ game, round, matchNumber, onSave, onClose }) {
  const { config } = game

  const seats = game.participants.filter(
    (p) => p.status === 'active' || (round && round.scores[p.id]),
  )

  const [rows, setRows] = useState(() =>
    seats.map((p) => {
      const existing = round ? round.scores[p.id] : null
      return {
        id: p.id,
        name: p.name,
        type: existing ? existing.type : 'manual',
        manual: existing ? String(existing.value) : '',
      }
    }),
  )

  const set = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const filled = rows.every((r) => r.manual !== '' && !Number.isNaN(Number(r.manual)))
  const winners = rows.filter((r) => Number(r.manual) === 0).length
  const sum = rows.reduce((t, r) => t + (Number(r.manual) || 0), 0)

  function save() {
    const scores = {}
    if (round) Object.assign(scores, round.scores)
    rows.forEach((r) => {
      scores[r.id] = { value: valueForType(r.type, config, r.manual), type: r.type }
    })
    onSave(scores)
  }

  return (
    <Modal
      wide
      title={round ? `Edit match ${matchNumber}` : `Match ${matchNumber} points`}
      sub="Pick a shortcut or type the count for each player. The winner gets 0."
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!filled} onClick={save}>
            {round ? 'Save changes' : 'Save match'}
          </button>
        </>
      }
    >
      {rows.map((r) => (
        <div className="entry-row" key={r.id}>
          <div className="top">
            <span className="name">{r.name}</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={r.manual}
              aria-label={`Points for ${r.name}`}
              onChange={(e) => set(r.id, { manual: e.target.value, type: 'manual' })}
            />
          </div>
          <div className="choices">
            {QUICK.map((t) => (
              <button
                key={t}
                type="button"
                className="chip"
                data-on={r.type === t}
                onClick={() => set(r.id, { type: t, manual: String(valueForType(t, config, 0)) })}
              >
                {SCORE_TYPES[t].label} · {valueForType(t, config, 0)}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="row" style={{ marginTop: 14 }}>
        <span className="pill">Match total <b>{sum}</b></span>
        {winners === 0 && filled && <span className="pill out">No one is on 0 — check the winner</span>}
        {winners > 1 && <span className="pill out">{winners} players on 0</span>}
      </div>
    </Modal>
  )
}
