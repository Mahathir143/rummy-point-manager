import { uid, newId } from './ids.js'

export const DEFAULT_CONFIG = {
  totalPoints: 201,
  fullPoint: 80,
  initialDropPoint: 20,
  middleDropPoint: 40,
  reEntryPoint: 40,
  newPlayerPoint: 40,
}

export const CONFIG_FIELDS = [
  { key: 'totalPoints', label: 'Total points (knock-out limit)', hint: 'A player is out when the running total reaches this number.' },
  { key: 'fullPoint', label: 'Full count', hint: 'Shown as F in the score table.' },
  { key: 'initialDropPoint', label: 'Initial drop', hint: 'Drop before picking a card.' },
  { key: 'middleDropPoint', label: 'Middle drop', hint: 'Drop after play has started.' },
  { key: 'reEntryPoint', label: 'Re-entry point', hint: 'Added to the highest score still in play.' },
  { key: 'newPlayerPoint', label: 'New player point', hint: 'Added to the highest score still in play.' },
]

export const SCORE_TYPES = {
  show: { label: 'Rummy show', short: 'W' },
  initial: { label: 'Initial drop', short: 'D' },
  middle: { label: 'Middle drop', short: 'M' },
  full: { label: 'Full count', short: 'F' },
  manual: { label: 'Manual', short: '' },
}

export function valueForType(type, config, manual) {
  switch (type) {
    case 'show': return 0
    case 'full': return Number(config.fullPoint) || 0
    case 'middle': return Number(config.middleDropPoint) || 0
    case 'initial': return Number(config.initialDropPoint) || 0
    default: return Math.max(0, Math.round(Number(manual) || 0))
  }
}

export function totalOf(participant, rounds) {
  let total = Number(participant.startPoints) || 0
  rounds.forEach((round, index) => {
    if (index < participant.joinedRound) return
    const entry = round.scores[participant.id]
    if (entry) total += Number(entry.value) || 0
  })
  return total
}

// Recalculates every total and knock-out status from the rounds, so editing an
// old match stays consistent with the rest of the game.
export function recompute(game) {
  const limit = Number(game.config.totalPoints) || 0
  const participants = game.participants.map((p) => {
    const total = totalOf(p, game.rounds)
    return { ...p, total, status: limit > 0 && total >= limit ? 'out' : 'active' }
  })
  const activeCount = participants.filter((p) => p.status === 'active').length
  return {
    ...game,
    participants,
    isOver: game.rounds.length > 0 && activeCount <= 1,
  }
}

// The highest total among players who are still in and have actually played a
// match since they joined. Players who just joined or just re-entered are
// excluded, so their own starting score never feeds the next calculation.
export function highestLiveScore(game) {
  const eligible = game.participants.filter(
    (p) => p.status === 'active' && game.rounds.length > p.joinedRound,
  )
  if (eligible.length === 0) return 0
  return Math.max(...eligible.map((p) => (p.total != null ? p.total : totalOf(p, game.rounds))))
}

export function createGame({ name, config, players }) {
  const game = {
    id: newId(),
    name: name || `Game ${new Date().toLocaleDateString()}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'active',
    config: { ...config },
    participants: players.map((pl) => ({
      id: uid('pt'),
      playerId: pl.id,
      name: pl.name,
      startPoints: 0,
      joinedRound: 0,
      entries: 1,
      status: 'active',
    })),
    rounds: [],
    events: [],
    rev: 0,
    winnerId: null,
    winnerName: null,
  }
  return recompute(game)
}

export function addRound(game, scores) {
  const round = { id: uid('rd'), at: Date.now(), scores }
  return recompute({ ...game, rounds: [...game.rounds, round], updatedAt: Date.now() })
}

export function updateRound(game, roundId, scores) {
  const rounds = game.rounds.map((r) => (r.id === roundId ? { ...r, scores, editedAt: Date.now() } : r))
  return recompute({ ...game, rounds, updatedAt: Date.now() })
}

export function deleteRound(game, roundId) {
  const index = game.rounds.findIndex((r) => r.id === roundId)
  const rounds = game.rounds.filter((r) => r.id !== roundId)
  // Anyone who joined after the removed match shifts back one row.
  const participants = game.participants.map((p) =>
    p.joinedRound > index ? { ...p, joinedRound: p.joinedRound - 1 } : p,
  )
  return recompute({ ...game, rounds, participants, updatedAt: Date.now() })
}

export function addPlayerMidGame(game, player) {
  const startPoints = highestLiveScore(game) + (Number(game.config.newPlayerPoint) || 0)
  const participant = {
    id: uid('pt'),
    playerId: player.id,
    name: player.name,
    startPoints,
    joinedRound: game.rounds.length,
    entries: 1,
    status: 'active',
  }
  const event = {
    id: uid('ev'),
    kind: 'join',
    name: player.name,
    points: startPoints,
    afterRound: game.rounds.length,
  }
  return recompute({
    ...game,
    participants: [...game.participants, participant],
    events: [...game.events, event],
    updatedAt: Date.now(),
  })
}

export function reEnterParticipant(game, participantId) {
  const startPoints = highestLiveScore(game) + (Number(game.config.reEntryPoint) || 0)
  let name = ''
  const participants = game.participants.map((p) => {
    if (p.id !== participantId) return p
    name = p.name
    return {
      ...p,
      startPoints,
      joinedRound: game.rounds.length,
      entries: (p.entries || 1) + 1,
      status: 'active',
    }
  })
  const event = {
    id: uid('ev'),
    kind: 're-entry',
    name,
    points: startPoints,
    afterRound: game.rounds.length,
  }
  return recompute({
    ...game,
    participants,
    events: [...game.events, event],
    updatedAt: Date.now(),
  })
}

export function finishGame(game) {
  const live = game.participants.filter((p) => p.status === 'active')
  const pool = live.length > 0 ? live : game.participants
  const winner = pool.slice().sort((a, b) => a.total - b.total)[0]
  return {
    ...game,
    status: 'finished',
    finishedAt: Date.now(),
    updatedAt: Date.now(),
    winnerId: winner ? winner.playerId : null,
    winnerName: winner ? winner.name : null,
  }
}

export function reopenGame(game) {
  return recompute({ ...game, status: 'active', winnerId: null, winnerName: null, updatedAt: Date.now() })
}

export function cellLabel(entry, config) {
  if (!entry) return null
  if (entry.type === 'full' && Number(entry.value) === Number(config.fullPoint)) return 'F'
  if (entry.type === 'show' && Number(entry.value) === 0) return '0'
  return String(entry.value)
}

export function buildStats(games, players) {
  const rows = players.map((pl) => ({
    id: pl.id,
    name: pl.name,
    games: 0,
    wins: 0,
    matches: 0,
    points: 0,
    fulls: 0,
    drops: 0,
    shows: 0,
    reEntries: 0,
  }))
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]))

  games.forEach((game) => {
    game.participants.forEach((p) => {
      const row = byId[p.playerId]
      if (!row) return
      row.games += 1
      row.reEntries += (p.entries || 1) - 1
      if (game.status === 'finished' && game.winnerId === p.playerId) row.wins += 1
      game.rounds.forEach((round) => {
        const entry = round.scores[p.id]
        if (!entry) return
        row.matches += 1
        row.points += Number(entry.value) || 0
        if (entry.type === 'full') row.fulls += 1
        if (entry.type === 'initial' || entry.type === 'middle') row.drops += 1
        if (entry.type === 'show') row.shows += 1
      })
    })
  })

  return rows
    .map((r) => ({ ...r, average: r.matches ? Math.round((r.points / r.matches) * 10) / 10 : 0 }))
    .sort((a, b) => b.wins - a.wins || a.average - b.average)
}
