import { cellLabel } from '../lib/game.js'

export function ScoreTable({ game, selectedRoundId, onSelectRound }) {
  const { participants, rounds, config } = game
  const pickable = Boolean(onSelectRound)

  return (
    <div className="table-wrap">
      <table className="score">
        <thead>
          <tr>
            <th scope="col">Match</th>
            {participants.map((p) => (
              <th key={p.id} scope="col" className={p.status === 'out' ? 'dead' : ''}>
                {p.name}{(p.entries || 1) > 1 ? ` ·${p.entries}` : ''}
                <span className="sum">{p.status === 'out' ? 'out' : 'in play'}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.length === 0 && (
            <tr>
              <td colSpan={participants.length + 1} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 22 }}>
                No matches yet. Use “Enter points” after the first hand.
              </td>
            </tr>
          )}
          {rounds.map((round, index) => (
            <tr
              key={round.id}
              className={`${pickable ? 'pick' : ''} ${selectedRoundId === round.id ? 'selected' : ''}`}
              onClick={pickable ? () => onSelectRound(round.id === selectedRoundId ? null : round.id) : undefined}
            >
              <td>Match {index + 1}</td>
              {participants.map((p) => {
                const entry = round.scores[p.id]
                const joinedHere = p.joinedRound === index && p.joinedRound > 0
                const label = cellLabel(entry, config)
                const cls = !entry ? 'blank' : entry.type === 'full' ? 'f' : entry.type === 'show' ? 'win' : ''
                return (
                  <td key={p.id} className={cls}>
                    {joinedHere && <span className="joinmark">starts at {p.startPoints}</span>}
                    {label === null ? '–' : label}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            {participants.map((p) => (
              <td key={p.id} className={p.status === 'out' ? 'out' : ''}>{p.total}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
