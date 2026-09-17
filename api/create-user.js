// POST /api/create-user  { email }
//
// Creates a Supabase account with a generated 8-character password and returns
// it once. This runs on the server because it needs the service-role key, which
// must never reach the browser. Set SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY in the Vercel project's environment variables.

const WORDS = ['joker', 'melds', 'trump', 'spade', 'heart', 'clubs', 'deals', 'rummy', 'table', 'chips']
const SYMBOLS = ['!', '@', '#', '$', '%', '&', '*', '?']

function generatePassword() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)]
  const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
  let digits = ''
  for (let i = 0; i < 8 - word.length - 1; i += 1) digits += Math.floor(Math.random() * 10)
  return word + symbol + digits
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' })

  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) {
    return res.status(500).json({ error: 'The server is missing its Supabase environment variables.' })
  }

  const token = String(req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sign in first.' })

  // Who is asking?
  const whoRes = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  })
  if (!whoRes.ok) return res.status(401).json({ error: 'Your session has expired. Sign in again.' })
  const caller = await whoRes.json()

  // Are they an admin?
  const profRes = await fetch(`${url}/rest/v1/profiles?id=eq.${caller.id}&select=is_admin`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  })
  const [profile] = await profRes.json()
  if (!profile || !profile.is_admin) return res.status(403).json({ error: 'Only admins can create accounts.' })

  const email = String((req.body && req.body.email) || '').trim()
  if (!email) return res.status(400).json({ error: 'Enter an email address.' })

  const password = generatePassword()
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const created = await createRes.json()
  if (!createRes.ok) {
    return res.status(createRes.status).json({ error: created.msg || created.message || 'Could not create the account.' })
  }

  return res.status(200).json({ email, password })
}
