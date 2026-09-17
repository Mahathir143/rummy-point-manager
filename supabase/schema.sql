-- Rummy Points — Supabase schema.
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to rerun: this drops any earlier version of the two helper functions
-- first, so a partial previous run can never leave a duplicate-signature
-- conflict behind.

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where proname in ('is_admin', 'is_member')
      and pronamespace = 'public'::regnamespace
  loop
    execute format('drop function %s cascade', r.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------- profiles
-- One row per person allowed into the app. Deleting a row revokes access,
-- because every policy below checks for membership here.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  display_name text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- New sign-ups get a profile automatically. The very first one is the admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, is_admin)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    not exists (select 1 from public.profiles)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- players
create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists players_name_key on public.players (lower(name));

-- ---------------------------------------------------------------- games
-- participants / rounds / events stay as jsonb: the scoring engine in
-- src/lib/game.js works on those shapes directly, and a game sheet is always
-- read and written as a whole. `rev` gives optimistic locking so two phones
-- saving the same match cannot silently overwrite each other.

create table if not exists public.games (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  status       text not null default 'active' check (status in ('active', 'finished')),
  config       jsonb not null,
  participants jsonb not null default '[]'::jsonb,
  rounds       jsonb not null default '[]'::jsonb,
  events       jsonb not null default '[]'::jsonb,
  winner_id    uuid,
  winner_name  text,
  rev          integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null
);

create index if not exists games_status_idx on public.games (status, updated_at desc);

-- ---------------------------------------------------------------- security
alter table public.profiles enable row level security;
alter table public.players  enable row level security;
alter table public.games    enable row level security;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin);
$$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (public.is_member());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete to authenticated using (public.is_admin() and id <> auth.uid());

-- Everyone signed in shares the same players and games, which is what makes
-- live sync at the table work.
drop policy if exists players_all on public.players;
create policy players_all on public.players
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists games_all on public.games;
create policy games_all on public.games
  for all to authenticated using (public.is_member()) with check (public.is_member());

-- ---------------------------------------------------------------- realtime
alter table public.players replica identity full;
alter table public.games   replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.players;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null;
end $$;
