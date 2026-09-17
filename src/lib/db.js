import { supabase } from './supabase.js'
import { newId } from './ids.js'

export class ConflictError extends Error {
  constructor() {
    super('Another device saved this game first.')
    this.conflict = true
  }
}

const GAME_COLUMNS = 'id,name,status,config,participants,rounds,events,winner_id,winner_name,rev,created_at,updated_at'

function toGame(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    config: row.config,
    participants: row.participants || [],
    rounds: row.rounds || [],
    events: row.events || [],
    winnerId: row.winner_id,
    winnerName: row.winner_name,
    rev: row.rev,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

function toRow(game) {
  return {
    name: game.name,
    status: game.status,
    config: game.config,
    // Strip the fields recompute() derives, so the sheet is the only source of truth.
    participants: game.participants.map(({ total, status, ...rest }) => rest),
    rounds: game.rounds,
    events: game.events,
    winner_id: game.winnerId || null,
    winner_name: game.winnerName || null,
  }
}

export async function fetchAll() {
  const [players, games] = await Promise.all([
    supabase.from('players').select('id,name,created_at').order('name'),
    supabase.from('games').select(GAME_COLUMNS).order('updated_at', { ascending: false }),
  ])
  if (players.error) throw players.error
  if (games.error) throw games.error
  return {
    players: players.data.map((p) => ({ id: p.id, name: p.name })),
    games: games.data.map(toGame),
  }
}

export async function insertPlayer(name, userId) {
  const { data, error } = await supabase
    .from('players')
    .insert({ id: newId(), name, created_by: userId })
    .select('id,name')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`${name} is already on the list.`)
    throw error
  }
  return { id: data.id, name: data.name }
}

export async function renamePlayer(playerId, name, games) {
  const { error } = await supabase.from('players').update({ name }).eq('id', playerId)
  if (error) {
    if (error.code === '23505') throw new Error(`${name} is already on the list.`)
    throw error
  }
  // Keep the name in the saved sheets in step with the player list.
  const affected = games.filter((g) => g.participants.some((p) => p.playerId === playerId))
  for (const game of affected) {
    await supabase
      .from('games')
      .update({
        participants: game.participants
          .map(({ total, status, ...rest }) => rest)
          .map((p) => (p.playerId === playerId ? { ...p, name } : p)),
        winner_name: game.winnerId === playerId ? name : game.winnerName,
      })
      .eq('id', game.id)
  }
}

export async function deletePlayer(playerId) {
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw error
}

export async function insertGame(game, userId) {
  const { data, error } = await supabase
    .from('games')
    .insert({ id: game.id, ...toRow(game), rev: 0, updated_by: userId })
    .select(GAME_COLUMNS)
    .single()
  if (error) throw error
  return toGame(data)
}

export async function saveGame(game, userId) {
  const { data, error } = await supabase
    .from('games')
    .update({
      ...toRow(game),
      rev: (game.rev || 0) + 1,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', game.id)
    .eq('rev', game.rev || 0)
    .select(GAME_COLUMNS)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new ConflictError()
  return toGame(data)
}

export async function deleteGame(gameId) {
  const { error } = await supabase.from('games').delete().eq('id', gameId)
  if (error) throw error
}

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,display_name,is_admin,created_at')
    .order('created_at')
  if (error) throw error
  return data
}

export async function setAdmin(profileId, isAdmin) {
  const { error } = await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', profileId)
  if (error) throw error
}

export async function removeMember(profileId) {
  const { error } = await supabase.from('profiles').delete().eq('id', profileId)
  if (error) throw error
}

// One channel for both tables. The callback fires for any insert, update or
// delete made by anyone, including this device.
export function subscribe(onChange) {
  const channel = supabase
    .channel('rummy-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
