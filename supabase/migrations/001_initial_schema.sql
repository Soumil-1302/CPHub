-- ============================================================
-- CPHub — Initial Database Migration
-- File : 001_initial_schema.sql
-- Apply : Supabase Dashboard → SQL Editor → paste → Run
-- ============================================================
--
-- This migration creates everything CPHub needs for user
-- profiles and LeetCode statistics:
--
--   1. profiles           — one row per auth user
--   2. leetcode_stats     — cached LeetCode numbers per user
--   3. indexes            — fast leaderboard & lookup queries
--   4. triggers           — auto-set updated_at, auto-create profile
--   5. Row Level Security — who can read/write what
--
-- Prerequisites
--   • The Supabase project must already exist.
--   • Email OTP auth must be enabled (Dashboard → Auth → Providers).
--   • Run this SQL with the default "postgres" role (the SQL Editor does that).
--
-- After running, verify:
--   Dashboard → Table Editor → you should see "profiles" and "leetcode_stats"
--   Dashboard → Auth → Policies → both tables show green "RLS enabled"
--


-- ────────────────────────────────────────
-- 1. PROFILES
-- ────────────────────────────────────────
-- One row per CPHub user, automatically created when they sign up
-- (see the trigger in Section 5).
--
-- The primary key is the Supabase Auth user UUID, so we never store
-- passwords or emails here — Supabase Auth owns that data.

create table if not exists public.profiles (
  id               uuid        primary key
                                references auth.users (id) on delete cascade,

  display_name     text        not null default '',
  usn              text        unique,          -- University Serial Number, nullable
  branch           text        not null default '',
  graduation_year  text        not null default '',
  leetcode_username text       not null default '',

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Guard-rails: basic sanity checks so the UI can trust column widths.
  constraint display_name_length  check (char_length(display_name)      <= 100),
  constraint usn_length           check (char_length(usn)               <= 30),
  constraint branch_length        check (char_length(branch)            <= 60),
  constraint grad_year_format     check (graduation_year ~ '^\d{4}$' or graduation_year = ''),
  constraint lc_username_length   check (char_length(leetcode_username) <= 40)
);

comment on table  public.profiles is
  'One row per registered CPHub user, linked 1:1 to auth.users.';
comment on column public.profiles.usn is
  'University Serial Number (e.g. 1DS22CS001). Unique when provided, NULL when not yet set.';
comment on column public.profiles.leetcode_username is
  'LeetCode handle used to fetch solve-count stats.';


-- ────────────────────────────────────────
-- 2. LEETCODE_STATS
-- ────────────────────────────────────────
-- Cached results from the LeetCode public API (or scraper).
-- One row per profile; the trigger-or-code that fetches stats
-- upserts into this table.

create table if not exists public.leetcode_stats (
  user_id             uuid        primary key
                                   references public.profiles (id) on delete cascade,

  solved_total        integer     not null default 0  check (solved_total   >= 0),
  easy_solved         integer     not null default 0  check (easy_solved    >= 0),
  medium_solved       integer     not null default 0  check (medium_solved  >= 0),
  hard_solved         integer     not null default 0  check (hard_solved    >= 0),

  submission_calendar jsonb       not null default '{}'::jsonb,

  fetched_at          timestamptz,                     -- NULL until first fetch
  fetch_status        text        not null default 'pending'
                                   check (fetch_status in ('pending','fetching','success','error'))
);

comment on table  public.leetcode_stats is
  'Cached LeetCode statistics per user. One row per profile.';
comment on column public.leetcode_stats.fetched_at is
  'Timestamp of the last successful or attempted fetch. NULL before any fetch.';
comment on column public.leetcode_stats.fetch_status is
  'pending → fetching → success | error. Reset to pending to trigger a re-fetch.';


-- ────────────────────────────────────────
-- 3. INDEXES
-- ────────────────────────────────────────
-- Partial indexes keep the index small by excluding empty / NULL values.

create index if not exists idx_profiles_usn
  on public.profiles (usn)
  where usn is not null;

create index if not exists idx_profiles_branch
  on public.profiles (branch)
  where branch != '';

-- Leaderboard sorts by total solved descending.
create index if not exists idx_leetcode_stats_solved
  on public.leetcode_stats (solved_total desc);


-- ────────────────────────────────────────
-- 4. TRIGGERS
-- ────────────────────────────────────────

-- 4a. Auto-update `updated_at` whenever a profile row is changed.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profiles_updated on public.profiles;
create trigger on_profiles_updated
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- 4b. Auto-create a profiles row when a new user signs up.
--     This means the app never has to worry about "profile missing" —
--     every auth user always has a matching profiles row.
--
--     `security definer` lets this function write to public.profiles even
--     though the new user hasn't been granted INSERT yet via RLS
--     (the trigger runs as the function owner, not as the new user).
--
--     `set search_path = ''` prevents search-path hijacking (a Supabase
--     best practice for security-definer functions).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- ────────────────────────────────────────
-- 5. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────
--
-- Public profile and leaderboard reads are provided by explicitly
-- projected API functions. The base tables remain owner-restricted.

-- Enable RLS (required before any policy takes effect).
alter table public.profiles       enable row level security;
alter table public.leetcode_stats enable row level security;


-- ── PROFILES policies ──

-- Drop existing policies so this migration is re-runnable.
drop policy if exists "Profiles are viewable by everyone"  on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- INSERT: only the owner may create their row.
-- In practice the signup trigger handles this, but the policy
-- ensures the user can also insert via the client SDK if needed.
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- UPDATE: only the owner may change their row.
-- `using` = which existing rows the user can see for the UPDATE,
-- `with check` = what the row must look like after the UPDATE.
create policy "Users can update their own profile"
  on public.profiles for update
  using      (auth.uid() = id)
  with check (auth.uid() = id);

-- No DELETE policy → users cannot delete their own profile from
-- the client. If needed later, add one or handle it server-side.


-- ── LEETCODE_STATS policies ──

drop policy if exists "Stats are viewable by everyone"   on public.leetcode_stats;
drop policy if exists "Users can insert their own stats" on public.leetcode_stats;
drop policy if exists "Users can update their own stats" on public.leetcode_stats;
drop policy if exists "Users can view their own stats"   on public.leetcode_stats;

create policy "Users can view their own stats"
  on public.leetcode_stats for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.profiles from public, anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

revoke all on table public.leetcode_stats from public, anon, authenticated;
grant select on table public.leetcode_stats to authenticated;
grant all on table public.leetcode_stats to service_role;


-- ============================================================
-- Done!  After running this:
--
--   1. Open Dashboard → Table Editor → confirm "profiles" and
--      "leetcode_stats" appear with the columns above.
--
--   2. Open Dashboard → Auth → Policies → both tables should
--      show "RLS enabled" with the policies listed.
--
--   3. Try signing up via your app — a row should appear in
--      profiles automatically (the on_auth_user_created trigger).
--
--   4. If you ever need to tear everything down, run:
--        drop table if exists public.leetcode_stats;
--        drop table if exists public.profiles;
--        drop function if exists public.handle_updated_at;
--        drop function if exists public.handle_new_user;
-- ============================================================
