-- ============================================================
-- CPHub Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ────────────────────────────────────────
-- 1. PROFILES TABLE
-- ────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text not null default '',
  usn              text unique,
  branch           text not null default '',
  graduation_year  text not null default '',
  leetcode_username text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table  public.profiles is 'One row per registered CPHub user, linked 1:1 to auth.users.';
comment on column public.profiles.usn is 'University Serial Number (e.g. eng25ct0060). Unique if provided.';
comment on column public.profiles.leetcode_username is 'LeetCode handle used to fetch stats.';

-- ────────────────────────────────────────
-- 2. LEETCODE_STATS TABLE
-- ────────────────────────────────────────
create table if not exists public.leetcode_stats (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  solved_total        integer not null default 0,
  easy_solved         integer not null default 0,
  medium_solved       integer not null default 0,
  hard_solved         integer not null default 0,
  submission_calendar jsonb   not null default '{}'::jsonb,
  fetched_at          timestamptz,
  fetch_status        text not null default 'pending'
    check (fetch_status in ('pending', 'fetching', 'success', 'error'))
);

comment on table  public.leetcode_stats is 'Cached LeetCode statistics per user. One row per profile.';
comment on column public.leetcode_stats.fetch_status is 'pending | fetching | success | error';

-- ────────────────────────────────────────
-- 3. INDEXES
-- ────────────────────────────────────────
create index if not exists idx_profiles_usn
  on public.profiles (usn)
  where usn is not null;

create index if not exists idx_profiles_branch
  on public.profiles (branch)
  where branch != '';

create index if not exists idx_leetcode_stats_solved
  on public.leetcode_stats (solved_total desc);

-- ────────────────────────────────────────
-- 4. AUTO-UPDATE updated_at ON PROFILES
-- ────────────────────────────────────────
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

-- ────────────────────────────────────────
-- 5. AUTO-CREATE PROFILE ON SIGN-UP
--    When a new user is inserted into auth.users,
--    create a matching profiles row automatically.
-- ────────────────────────────────────────
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
-- 6. ROW LEVEL SECURITY
-- ────────────────────────────────────────

-- Profiles: anyone can read (leaderboard is public), only owner can update
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone"    on public.profiles;
drop policy if exists "Users can update their own profile"   on public.profiles;
drop policy if exists "Users can insert their own profile"   on public.profiles;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Leetcode stats: anyone can read, only owner can insert/update
alter table public.leetcode_stats enable row level security;

drop policy if exists "Stats are viewable by everyone"       on public.leetcode_stats;
drop policy if exists "Users can insert their own stats"     on public.leetcode_stats;
drop policy if exists "Users can update their own stats"     on public.leetcode_stats;

create policy "Stats are viewable by everyone"
  on public.leetcode_stats for select
  using (true);

create policy "Users can insert their own stats"
  on public.leetcode_stats for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own stats"
  on public.leetcode_stats for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
