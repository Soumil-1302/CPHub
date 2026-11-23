-- Keep profile and cached-stat tables private to their owners. Public reads
-- are served through narrow functions that return only documented fields.

alter table public.profiles enable row level security;
alter table public.leetcode_stats enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Stats are viewable by everyone" on public.leetcode_stats;
drop policy if exists "Users can view their own stats" on public.leetcode_stats;
drop policy if exists "Users can insert their own stats" on public.leetcode_stats;
drop policy if exists "Users can update their own stats" on public.leetcode_stats;

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

create or replace function public.get_public_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'username', profile.username,
    'display_name', coalesce(nullif(btrim(profile.display_name), ''), profile.username),
    'usn', profile.usn,
    'branch', coalesce(nullif(btrim(profile.branch), ''), 'General'),
    'year_of_passing', nullif(profile.graduation_year, '')::integer,
    'leetcode_username', nullif(btrim(profile.leetcode_username), ''),
    'leetcode_profile_url',
      case
        when nullif(btrim(profile.leetcode_username), '') is null then null
        else 'https://leetcode.com/u/' || btrim(profile.leetcode_username) || '/'
      end,
    'solved_total', coalesce(
      stats.solved_total,
      stats.easy_solved + stats.medium_solved + stats.hard_solved,
      0
    ),
    'easy_solved', coalesce(stats.easy_solved, 0),
    'medium_solved', coalesce(stats.medium_solved, 0),
    'hard_solved', coalesce(stats.hard_solved, 0),
    'contest_rating', stats.contest_rating,
    'global_ranking', stats.global_ranking,
    'fetched_at', stats.fetched_at,
    'created_at', profile.created_at,
    'updated_at', profile.updated_at
  )
  from public.profiles as profile
  left join public.leetcode_stats as stats
    on stats.user_id = profile.id
    and stats.fetch_status = 'success'
    and lower(btrim(stats.provider_username)) = lower(btrim(profile.leetcode_username))
  where lower(btrim(profile.username)) = lower(btrim(p_username))
    and profile.username is not null
    and btrim(profile.username) <> '';
$$;

revoke all on function public.get_public_profile(text)
  from public, anon, authenticated;
grant execute on function public.get_public_profile(text)
  to anon, authenticated;

-- This RPC already emits an explicit public projection. Definer privileges
-- let it read the owner-restricted base tables without granting table access.
alter function public.get_public_leaderboard(
  text[], integer, text, text, integer, integer, text
) security definer;
alter function public.get_public_leaderboard(
  text[], integer, text, text, integer, integer, text
) set search_path = '';

revoke all on function public.get_public_leaderboard(
  text[], integer, text, text, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.get_public_leaderboard(
  text[], integer, text, text, integer, integer, text
) to anon, authenticated;
