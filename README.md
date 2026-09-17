# Rummy Points

A points manager for rummy tables: shared players, live scoring, drops, re-entries, and a full
match-by-match sheet for every game. React + Vite on Vercel, Supabase Postgres for data and
sign-in. Every phone signed in sees the same table and updates in real time.

## Set up Supabase (10 minutes, free tier)

1. **Create the project.** supabase.com → New project. Pick a region near you and save the
   database password somewhere.
2. **Create the tables.** SQL Editor → New query → paste all of `supabase/schema.sql` → Run.
   That creates `profiles`, `players` and `games`, turns on row-level security, and adds both
   tables to the realtime publication.
3. **Turn off email confirmation** (optional, but easier for a private game): Authentication →
   Sign In / Providers → Email → switch off *Confirm email*. Leave it on if you prefer.
4. **Copy your keys.** Settings → API. You need the Project URL and the `anon` public key. The
   `service_role` key is only for the serverless function in step 7 — it must never go in a
   `VITE_` variable.
5. **Local env.** Copy `.env.example` to `.env` and fill it in.
6. **First account.** Run the app, use *Create account*, and sign up. The database trigger makes
   the first account the admin. Everyone after that is a normal member.
7. **Admin-created passwords** (optional). `api/create-user.js` is a Vercel serverless function
   that creates an account with a generated 8-character password and shows it once, the way the
   Members tab expects. It needs `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` set in Vercel. Without it, members sign themselves up instead and
   the rest of the app works exactly the same.

## Run it locally

Node.js 18 or newer.

```bash
npm install
npm run dev
```

The `/api` function does not run under `vite dev`. To test it locally, use `npx vercel dev`.

## Deploy to Vercel

```bash
git add . && git commit -m "Supabase backend" && git push
```

In the Vercel project → Settings → Environment Variables, add all five values from
`.env.example` (the two `VITE_` ones and the three server-side ones), then redeploy. Vite inlines
`VITE_` variables at build time, so a redeploy is required after changing them — restarting is
not enough.

## How the data is shaped

| Table | What it holds |
| --- | --- |
| `profiles` | One row per person allowed in, with `is_admin`. Deleting a row revokes access, because every policy checks membership here. |
| `players` | The shared name list. Unique on lowercased name. |
| `games` | One row per game. `config`, `participants`, `rounds` and `events` are `jsonb`. |

Keeping the sheet as `jsonb` means the scoring engine in `src/lib/game.js` works on it unchanged,
and a game is always read and written as a whole. The trade-off is that you cannot run SQL like
"average points per player" directly — the app computes statistics client-side instead. If you
later want that in SQL, split `rounds` into a `rounds` / `round_scores` pair of tables and the
engine keeps working as long as you rebuild the same shape when loading.

**Concurrent edits.** Every game row has a `rev` counter. Saving does
`update … where id = ? and rev = ?` and bumps it. If another phone saved first, the update matches
nothing, the app says so and reloads the latest sheet rather than overwriting it.

**Live sync.** One Supabase realtime channel listens to both tables. Any insert, update or delete
by anyone pulls a fresh copy down, unless this device is mid-write.

## Scoring rules

A player is out when their running total reaches the limit. A player re-entering, or a new player
joining mid-game, starts on *the highest total still in play* plus the re-entry or new-player
point. Anyone who has not played a hand since joining is excluded from that calculation, so:

> A, B and C are playing. C crosses the limit and is out. A is highest among the rest on 110.
> C re-enters at 110 + re-entry point. D then joins at 110 + new player point — C's fresh score
> does not raise the bar.

In the score table, rows are matches and columns are players, with running totals along the
bottom. A full count shows as `F`, a rummy show as `0`, and a re-entry or late join adds a
"starts at N" marker on the row where that player came in. Tap any row to edit or delete it;
totals and knock-outs recalculate from scratch.

## Free-tier limits

Supabase free projects pause after about a week with no requests — one visit wakes it up, and the
data is not lost. Storage and bandwidth limits are far beyond what score sheets use.
