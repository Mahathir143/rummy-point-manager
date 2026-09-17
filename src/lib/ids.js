// Ids for rows go to Postgres as uuids; ids inside the jsonb sheet (participants,
// rounds, events) only have to be unique within one game.

let counter = 0

export function uid(prefix = 'id') {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID()
  // Fallback for older browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
