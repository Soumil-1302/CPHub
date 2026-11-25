-- CPHub platform architecture.
-- Apply after 006_secure_public_profile_access.sql.
--
-- This migration is additive. It does not drop tables, delete rows, or
-- truncate data. Existing profiles, leetcode_stats, and leetcode_fetch_state
-- rows stay in place, and the columns the current API writes
-- (display_name, solved_total, fetched_at, global_ranking, leetcode_username)
-- keep their names and meaning.
--
-- Do not apply this file to the live Supabase project until it has been reviewed.
-- The migration is transactional: any statement failure rolls back the full
-- schema and backfill change set.

begin;

-- ────────────────────────────────────────
-- 1. PROFILES
--    Keep the current auth.users primary key and the columns already used by
--    signup, profile claim, and the public leaderboard. Add the profile fields
--    the upgraded platform needs beside them.
-- ────────────────────────────────────────

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists university text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists is_public boolean;

-- Copy existing names without bumping updated_at. Claimed usernames stay
-- public, which is how the leaderboard treats them today. Signup placeholders
-- without a username stay private. New rows default to private until a profile
-- is claimed.
alter table public.profiles disable trigger on_profiles_updated;

update public.profiles
set
  full_name = coalesce(full_name, nullif(btrim(display_name), '')),
  is_public = coalesce(
    is_public,
    username is not null and btrim(username) <> ''
  )
where full_name is null
   or is_public is null;

alter table public.profiles enable trigger on_profiles_updated;

alter table public.profiles
  alter column is_public set default false;

update public.profiles
set is_public = false
where is_public is null;

alter table public.profiles
  alter column is_public set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_full_name_length_check'
  ) then
    alter table public.profiles
      add constraint profiles_full_name_length_check
      check (full_name is null or char_length(full_name) between 1 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_university_length_check'
  ) then
    alter table public.profiles
      add constraint profiles_university_length_check
      check (university is null or char_length(btrim(university)) between 1 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_avatar_url_check'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_url_check
      check (
        avatar_url is null
        or (
          char_length(avatar_url) <= 500
          and avatar_url ~ '^https://'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_bio_length_check'
  ) then
    alter table public.profiles
      add constraint profiles_bio_length_check
      check (bio is null or char_length(bio) <= 500);
  end if;
end;
$$;

create or replace function public.sync_profile_name_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.full_name := coalesce(nullif(btrim(new.full_name), ''), nullif(btrim(new.display_name), ''));
    new.display_name := coalesce(nullif(btrim(new.display_name), ''), nullif(btrim(new.full_name), ''), '');
  elsif new.display_name is distinct from old.display_name
        and new.full_name is not distinct from old.full_name then
    new.full_name := nullif(btrim(new.display_name), '');
  elsif new.full_name is distinct from old.full_name
        and new.display_name is not distinct from old.display_name then
    new.display_name := coalesce(nullif(btrim(new.full_name), ''), '');
  end if;
  return new;
end;
$$;

drop trigger if exists on_profiles_sync_name_columns on public.profiles;
create trigger on_profiles_sync_name_columns
  before insert or update of display_name, full_name on public.profiles
  for each row
  execute function public.sync_profile_name_columns();

-- Username uniqueness already exists from 003. Recreate it only if missing.
create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

create index if not exists profiles_public_leaderboard_idx
  on public.profiles (lower(branch), graduation_year)
  where is_public
    and username is not null
    and btrim(username) <> '';

comment on column public.profiles.full_name is
  'Person name shown on a public profile. Copied from display_name for existing rows.';
comment on column public.profiles.university is
  'Optional university name. Not inferred from existing rows.';
comment on column public.profiles.is_public is
  'When false, public profile and leaderboard functions omit this row.';

-- ────────────────────────────────────────
-- 2. LEETCODE STATS
--    user_id stays the primary key. finish_leetcode_fetch_success* upserts on
--    that key, and one cached row per user is the existing invariant.
--    id, total_solved, ranking, last_synced_at, and updated_at are added beside
--    the columns the API already reads and writes.
-- ────────────────────────────────────────

alter table public.leetcode_stats
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists total_solved integer not null default 0,
  add column if not exists ranking bigint,
  add column if not exists last_synced_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.leetcode_stats
set
  id = coalesce(id, gen_random_uuid()),
  total_solved = solved_total,
  ranking = case
    when global_ranking is null or global_ranking >= 0 then global_ranking
    else null
  end,
  last_synced_at = fetched_at,
  updated_at = coalesce(updated_at, fetched_at, now())
where id is null
   or total_solved is distinct from solved_total
   or ranking is distinct from case
        when global_ranking is null or global_ranking >= 0 then global_ranking
        else null
      end
   or last_synced_at is distinct from fetched_at
   or updated_at is null;

alter table public.leetcode_stats
  alter column id set not null;

alter table public.leetcode_stats
  alter column updated_at set default now();

alter table public.leetcode_stats
  alter column updated_at set not null;

create unique index if not exists leetcode_stats_id_key
  on public.leetcode_stats (id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leetcode_stats'::regclass
      and conname = 'leetcode_stats_total_solved_check'
  ) then
    alter table public.leetcode_stats
      add constraint leetcode_stats_total_solved_check
      check (total_solved >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leetcode_stats'::regclass
      and conname = 'leetcode_stats_ranking_check'
  ) then
    alter table public.leetcode_stats
      add constraint leetcode_stats_ranking_check
      check (ranking is null or ranking >= 0);
  end if;
end;
$$;

create or replace function public.sync_leetcode_stats_columns()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;
  new.total_solved := coalesce(new.solved_total, 0);
  new.ranking := case
    when new.global_ranking is null or new.global_ranking >= 0 then new.global_ranking
    else null
  end;
  new.last_synced_at := new.fetched_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_leetcode_stats_sync_columns on public.leetcode_stats;
create trigger on_leetcode_stats_sync_columns
  before insert or update on public.leetcode_stats
  for each row
  execute function public.sync_leetcode_stats_columns();

create index if not exists leetcode_stats_ranking_success_idx
  on public.leetcode_stats (ranking asc nulls last)
  where fetch_status = 'success' and ranking is not null;

comment on column public.leetcode_stats.id is
  'Surrogate key. user_id remains the primary key so existing per-user upserts keep working.';
comment on column public.leetcode_stats.total_solved is
  'Mirror of solved_total, maintained by on_leetcode_stats_sync_columns.';
comment on column public.leetcode_stats.ranking is
  'Mirror of global_ranking when LeetCode provides a non-negative ranking.';
comment on column public.leetcode_stats.last_synced_at is
  'Mirror of fetched_at.';

-- ────────────────────────────────────────
-- 3. NEW TABLES
-- ────────────────────────────────────────

create table if not exists public.leetcode_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  leetcode_username text not null,
  linked_at timestamptz not null default now(),
  last_synced_at timestamptz,
  sync_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leetcode_accounts_user_id_key unique (user_id),
  constraint leetcode_accounts_username_format_check
    check (leetcode_username ~ '^[a-z0-9_-]{1,40}$'),
  constraint leetcode_accounts_sync_status_check
    check (sync_status in ('pending', 'syncing', 'success', 'error', 'unlinked'))
);

comment on table public.leetcode_accounts is
  'One linked LeetCode handle per auth user. profiles.leetcode_username remains the field the current API edits.';

create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  problems_solved integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_activity_user_date_key unique (user_id, activity_date),
  constraint user_activity_problems_solved_check check (problems_solved >= 0)
);

comment on table public.user_activity is
  'One activity total per user per UTC day. Historical rows are copied from submission_calendar and are not deleted when a later sync omits a day.';
comment on column public.user_activity.problems_solved is
  'Count stored for that day. LeetCode''s submission calendar counts submissions, so backfilled values are submission counts.';

create table if not exists public.topic_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_name text not null,
  problems_solved integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topic_stats_topic_name_check
    check (char_length(btrim(topic_name)) between 1 and 80),
  constraint topic_stats_problems_solved_check check (problems_solved >= 0)
);

create unique index if not exists topic_stats_user_topic_unique_idx
  on public.topic_stats (user_id, lower(topic_name));

comment on table public.topic_stats is
  'One solved-count per user per topic. solved_by_topic on leetcode_stats is left in place.';

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint sync_logs_status_check
    check (status in ('running', 'success', 'error')),
  constraint sync_logs_error_message_length_check
    check (error_message is null or char_length(error_message) <= 500),
  constraint sync_logs_completed_after_start_check
    check (completed_at is null or completed_at >= started_at)
);

comment on table public.sync_logs is
  'Append-only record of LeetCode sync attempts. leetcode_fetch_state remains the lease and rate-limit table.';

create index if not exists sync_logs_user_started_idx
  on public.sync_logs (user_id, started_at desc);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_preferences jsonb not null default '{}'::jsonb,
  dashboard_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_user_id_key unique (user_id),
  constraint user_preferences_notification_object_check
    check (jsonb_typeof(notification_preferences) = 'object'),
  constraint user_preferences_dashboard_object_check
    check (jsonb_typeof(dashboard_preferences) = 'object')
);

comment on table public.user_preferences is
  'Private per-user settings. Not included in public profile or leaderboard responses.';

create index if not exists user_activity_user_date_idx
  on public.user_activity (user_id, activity_date desc);

create index if not exists user_activity_leaderboard_idx
  on public.user_activity (activity_date desc, problems_solved desc);

create index if not exists topic_stats_leaderboard_idx
  on public.topic_stats (lower(topic_name), problems_solved desc, user_id);

-- ────────────────────────────────────────
-- 4. updated_at TRIGGERS
-- ────────────────────────────────────────

drop trigger if exists on_leetcode_accounts_updated on public.leetcode_accounts;
create trigger on_leetcode_accounts_updated
  before update on public.leetcode_accounts
  for each row
  execute function public.handle_updated_at();

drop trigger if exists on_user_activity_updated on public.user_activity;
create trigger on_user_activity_updated
  before update on public.user_activity
  for each row
  execute function public.handle_updated_at();

drop trigger if exists on_topic_stats_updated on public.topic_stats;
create trigger on_topic_stats_updated
  before update on public.topic_stats
  for each row
  execute function public.handle_updated_at();

drop trigger if exists on_user_preferences_updated on public.user_preferences;
create trigger on_user_preferences_updated
  before update on public.user_preferences
  for each row
  execute function public.handle_updated_at();

-- ────────────────────────────────────────
-- 5. ROW LEVEL SECURITY
--    Owners can read their own rows. Authenticated users can edit only their
--    profile and their preferences. Statistics, account links, activity, and
--    sync logs are written by service_role after FastAPI has verified the JWT.
-- ────────────────────────────────────────

alter table public.leetcode_accounts enable row level security;
alter table public.user_activity enable row level security;
alter table public.topic_stats enable row level security;
alter table public.sync_logs enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "Users can view their own LeetCode account" on public.leetcode_accounts;
create policy "Users can view their own LeetCode account"
  on public.leetcode_accounts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view their own activity" on public.user_activity;
create policy "Users can view their own activity"
  on public.user_activity for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view their own topic stats" on public.topic_stats;
create policy "Users can view their own topic stats"
  on public.topic_stats for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view their own sync logs" on public.sync_logs;
create policy "Users can view their own sync logs"
  on public.sync_logs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view their own preferences" on public.user_preferences;
create policy "Users can view their own preferences"
  on public.user_preferences for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own preferences" on public.user_preferences;
create policy "Users can insert their own preferences"
  on public.user_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own preferences" on public.user_preferences;
create policy "Users can update their own preferences"
  on public.user_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on table public.leetcode_accounts from public, anon, authenticated;
grant select on table public.leetcode_accounts to authenticated;
grant all on table public.leetcode_accounts to service_role;

revoke all on table public.user_activity from public, anon, authenticated;
grant select on table public.user_activity to authenticated;
grant all on table public.user_activity to service_role;

revoke all on table public.topic_stats from public, anon, authenticated;
grant select on table public.topic_stats to authenticated;
grant all on table public.topic_stats to service_role;

revoke all on table public.sync_logs from public, anon, authenticated;
grant select on table public.sync_logs to authenticated;
grant all on table public.sync_logs to service_role;

revoke all on table public.user_preferences from public, anon, authenticated;
grant select, insert, update on table public.user_preferences to authenticated;
grant all on table public.user_preferences to service_role;

-- Stats remain owner-readable and service-role-writable, including new columns.
revoke all on table public.leetcode_stats from public, anon, authenticated;
grant select on table public.leetcode_stats to authenticated;
grant all on table public.leetcode_stats to service_role;

-- ────────────────────────────────────────
-- 6. SYNC WRITES
--    One transaction updates the account, appends a log, and upserts activity
--    and topic rows. It never deletes an existing activity day or topic.
-- ────────────────────────────────────────

create or replace function public.apply_leetcode_sync_result(
  p_user_id uuid,
  p_leetcode_username text,
  p_status text,
  p_error_message text,
  p_submission_calendar jsonb,
  p_solved_by_topic jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text := lower(btrim(coalesce(p_leetcode_username, '')));
  started_at timestamptz := now();
  account_status text;
  current_profile_username text;
begin
  if p_user_id is null
     or p_status not in ('running', 'success', 'error')
     or normalized_username !~ '^[a-z0-9_-]{1,40}$'
     or (p_error_message is not null and char_length(p_error_message) > 500)
     or (
       p_submission_calendar is not null
       and jsonb_typeof(p_submission_calendar) <> 'object'
     )
     or (
       p_solved_by_topic is not null
       and jsonb_typeof(p_solved_by_topic) <> 'object'
     ) then
    raise exception 'Invalid LeetCode sync result.';
  end if;

  select coalesce(state.last_attempted_at, now())
    into started_at
  from public.leetcode_fetch_state as state
  where state.leetcode_username = normalized_username
    and state.user_id = p_user_id;

  started_at := coalesce(started_at, now());
  account_status := case when p_status = 'running' then 'syncing' else p_status end;

  select lower(btrim(coalesce(profile.leetcode_username, '')))
    into current_profile_username
  from public.profiles as profile
  where profile.id = p_user_id
  for update;

  if current_profile_username = normalized_username then
    insert into public.leetcode_accounts as account (
      user_id,
      leetcode_username,
      linked_at,
      last_synced_at,
      sync_status
    )
    values (
      p_user_id,
      normalized_username,
      started_at,
      case when p_status = 'success' then now() else null end,
      account_status
    )
    on conflict (user_id) do update
    set leetcode_username = excluded.leetcode_username,
        last_synced_at = case
          when p_status = 'success' then now()
          else account.last_synced_at
        end,
        sync_status = excluded.sync_status,
        updated_at = now();
  end if;

  insert into public.sync_logs (
    user_id,
    status,
    error_message,
    started_at,
    completed_at
  )
  values (
    p_user_id,
    p_status,
    nullif(btrim(coalesce(p_error_message, '')), ''),
    started_at,
    case when p_status = 'running' then null else now() end
  );

  if p_status <> 'success' or p_submission_calendar is null then
    null;
  else
    insert into public.user_activity (user_id, activity_date, problems_solved)
    select
      p_user_id,
      (to_timestamp(entry.key::double precision) at time zone 'utc')::date,
      sum(entry.value::integer)::integer
    from jsonb_each_text(p_submission_calendar) as entry(key, value)
    where entry.key ~ '^[0-9]{1,12}$'
      and entry.value ~ '^[0-9]{1,9}$'
    group by (to_timestamp(entry.key::double precision) at time zone 'utc')::date
    on conflict (user_id, activity_date) do update
    set problems_solved = excluded.problems_solved,
        updated_at = now();
  end if;

  if p_status <> 'success' or p_solved_by_topic is null then
    return;
  end if;

  insert into public.topic_stats (user_id, topic_name, problems_solved)
  select
    p_user_id,
    min(left(btrim(entry.key), 80)),
    max(entry.value::integer)
  from jsonb_each_text(p_solved_by_topic) as entry(key, value)
  where char_length(btrim(entry.key)) between 1 and 80
    and entry.value ~ '^[0-9]{1,9}$'
  group by lower(btrim(entry.key))
  on conflict (user_id, lower(topic_name)) do update
  set topic_name = excluded.topic_name,
      problems_solved = excluded.problems_solved,
      updated_at = now();
end;
$$;

revoke all on function public.apply_leetcode_sync_result(uuid, text, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_leetcode_sync_result(uuid, text, text, text, jsonb, jsonb)
  to service_role;

revoke all on function public.sync_leetcode_stats_columns()
  from public, anon, authenticated;
grant execute on function public.sync_leetcode_stats_columns()
  to service_role;

-- Keep the existing fetch functions. Their signatures do not change. Each
-- successful or failed finish now also records the normalized sync tables.
create or replace function public.finish_leetcode_fetch_success(
  p_username text,
  p_user_id uuid,
  p_attempt_token uuid,
  p_provider_username text,
  p_solved_total integer,
  p_easy_solved integer,
  p_medium_solved integer,
  p_hard_solved integer,
  p_submission_calendar jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text := lower(btrim(p_username));
  saved_stats public.leetcode_stats%rowtype;
  updated_state_count integer;
begin
  if lower(btrim(p_provider_username)) <> normalized_username
     or p_solved_total < 0
     or p_easy_solved < 0
     or p_medium_solved < 0
     or p_hard_solved < 0
     or p_easy_solved + p_medium_solved + p_hard_solved <> p_solved_total
     or p_submission_calendar is null
     or jsonb_typeof(p_submission_calendar) <> 'object' then
    raise exception 'Invalid validated LeetCode stats.';
  end if;

  update public.leetcode_fetch_state as state
  set fetch_status = 'success',
      last_successful_at = now(),
      lease_token = null,
      lease_until = null,
      last_error_code = null,
      updated_at = now()
  where state.leetcode_username = normalized_username
    and state.user_id = p_user_id
    and state.lease_token = p_attempt_token
    and state.fetch_status = 'fetching';

  get diagnostics updated_state_count = row_count;
  if updated_state_count <> 1 then
    raise exception 'LeetCode refresh lease is no longer valid.';
  end if;

  insert into public.leetcode_stats (
    user_id,
    provider_username,
    solved_total,
    easy_solved,
    medium_solved,
    hard_solved,
    submission_calendar,
    fetched_at,
    fetch_status
  )
  values (
    p_user_id,
    normalized_username,
    p_solved_total,
    p_easy_solved,
    p_medium_solved,
    p_hard_solved,
    p_submission_calendar,
    now(),
    'success'
  )
  on conflict (user_id) do update
  set provider_username = excluded.provider_username,
      solved_total = excluded.solved_total,
      easy_solved = excluded.easy_solved,
      medium_solved = excluded.medium_solved,
      hard_solved = excluded.hard_solved,
      submission_calendar = excluded.submission_calendar,
      fetched_at = excluded.fetched_at,
      fetch_status = excluded.fetch_status
  returning * into saved_stats;

  perform public.apply_leetcode_sync_result(
    p_user_id,
    normalized_username,
    'success',
    null,
    p_submission_calendar,
    null
  );

  return to_jsonb(saved_stats);
end;
$$;

create or replace function public.finish_leetcode_fetch_success_v2(
  p_username text,
  p_user_id uuid,
  p_attempt_token uuid,
  p_provider_username text,
  p_solved_total integer,
  p_easy_solved integer,
  p_medium_solved integer,
  p_hard_solved integer,
  p_submission_calendar jsonb,
  p_contest_rating numeric,
  p_global_ranking bigint,
  p_solved_by_topic jsonb,
  p_recent_submissions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text := lower(btrim(p_username));
  saved_stats public.leetcode_stats%rowtype;
  updated_state_count integer;
begin
  if p_username is null
     or p_user_id is null
     or p_attempt_token is null
     or p_provider_username is null
     or p_solved_total is null
     or p_easy_solved is null
     or p_medium_solved is null
     or p_hard_solved is null
     or lower(btrim(p_provider_username)) <> normalized_username
     or p_solved_total < 0
     or p_easy_solved < 0
     or p_medium_solved < 0
     or p_hard_solved < 0
     or p_easy_solved + p_medium_solved + p_hard_solved <> p_solved_total
     or p_submission_calendar is null
     or jsonb_typeof(p_submission_calendar) <> 'object'
     or (p_contest_rating is not null and p_contest_rating < 0)
     or (p_global_ranking is not null and p_global_ranking < 0)
     or (p_solved_by_topic is not null and jsonb_typeof(p_solved_by_topic) <> 'object')
     or (p_recent_submissions is not null and jsonb_typeof(p_recent_submissions) <> 'array') then
    raise exception 'Invalid validated LeetCode stats.';
  end if;

  update public.leetcode_fetch_state as state
  set fetch_status = 'success',
      last_successful_at = now(),
      lease_token = null,
      lease_until = null,
      last_error_code = null,
      updated_at = now()
  where state.leetcode_username = normalized_username
    and state.user_id = p_user_id
    and state.lease_token = p_attempt_token
    and state.fetch_status = 'fetching';

  get diagnostics updated_state_count = row_count;
  if updated_state_count <> 1 then
    raise exception 'LeetCode refresh lease is no longer valid.';
  end if;

  insert into public.leetcode_stats (
    user_id,
    provider_username,
    solved_total,
    easy_solved,
    medium_solved,
    hard_solved,
    submission_calendar,
    contest_rating,
    global_ranking,
    solved_by_topic,
    recent_submissions,
    fetched_at,
    fetch_status
  )
  values (
    p_user_id,
    normalized_username,
    p_solved_total,
    p_easy_solved,
    p_medium_solved,
    p_hard_solved,
    p_submission_calendar,
    p_contest_rating,
    p_global_ranking,
    p_solved_by_topic,
    p_recent_submissions,
    now(),
    'success'
  )
  on conflict (user_id) do update
  set provider_username = excluded.provider_username,
      solved_total = excluded.solved_total,
      easy_solved = excluded.easy_solved,
      medium_solved = excluded.medium_solved,
      hard_solved = excluded.hard_solved,
      submission_calendar = excluded.submission_calendar,
      contest_rating = excluded.contest_rating,
      global_ranking = excluded.global_ranking,
      solved_by_topic = excluded.solved_by_topic,
      recent_submissions = excluded.recent_submissions,
      fetched_at = excluded.fetched_at,
      fetch_status = excluded.fetch_status
  returning * into saved_stats;

  perform public.apply_leetcode_sync_result(
    p_user_id,
    normalized_username,
    'success',
    null,
    p_submission_calendar,
    p_solved_by_topic
  );

  return to_jsonb(saved_stats);
end;
$$;

create or replace function public.finish_leetcode_fetch_error(
  p_username text,
  p_user_id uuid,
  p_attempt_token uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text := lower(btrim(p_username));
  updated_state_count integer;
begin
  if p_error_code !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'Invalid LeetCode provider error code.';
  end if;

  update public.leetcode_fetch_state as state
  set fetch_status = 'error',
      lease_token = null,
      lease_until = null,
      last_error_code = p_error_code,
      updated_at = now()
  where state.leetcode_username = normalized_username
    and state.user_id = p_user_id
    and state.lease_token = p_attempt_token
    and state.fetch_status = 'fetching';

  get diagnostics updated_state_count = row_count;
  if updated_state_count <> 1 then
    raise exception 'LeetCode refresh lease is no longer valid.';
  end if;

  perform public.apply_leetcode_sync_result(
    p_user_id,
    normalized_username,
    'error',
    p_error_code,
    null,
    null
  );

  return true;
end;
$$;

revoke all on function public.finish_leetcode_fetch_success(
  text, uuid, uuid, text, integer, integer, integer, integer, jsonb
) from public, anon, authenticated;
revoke all on function public.finish_leetcode_fetch_success_v2(
  text, uuid, uuid, text, integer, integer, integer, integer, jsonb,
  numeric, bigint, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.finish_leetcode_fetch_error(text, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.finish_leetcode_fetch_success(
  text, uuid, uuid, text, integer, integer, integer, integer, jsonb
) to service_role;
grant execute on function public.finish_leetcode_fetch_success_v2(
  text, uuid, uuid, text, integer, integer, integer, integer, jsonb,
  numeric, bigint, jsonb, jsonb
) to service_role;
grant execute on function public.finish_leetcode_fetch_error(text, uuid, uuid, text)
  to service_role;

-- ────────────────────────────────────────
-- 7. KEEP ACCOUNT LINKS ALIGNED WITH profiles.leetcode_username
--    Clearing a handle does not delete the account row.
-- ────────────────────────────────────────

create or replace function public.sync_leetcode_account_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  handle text := nullif(lower(btrim(coalesce(new.leetcode_username, ''))), '');
begin
  if handle is null then
    update public.leetcode_accounts
    set sync_status = 'unlinked',
        updated_at = now()
    where user_id = new.id
      and sync_status <> 'unlinked';
    return new;
  end if;

  if handle !~ '^[a-z0-9_-]{1,40}$' then
    return new;
  end if;

  insert into public.leetcode_accounts as account (
    user_id,
    leetcode_username,
    linked_at,
    sync_status
  )
  values (new.id, handle, now(), 'pending')
  on conflict (user_id) do update
  set leetcode_username = excluded.leetcode_username,
      linked_at = case
        when account.leetcode_username is distinct from excluded.leetcode_username then now()
        else account.linked_at
      end,
      sync_status = case
        when account.leetcode_username is distinct from excluded.leetcode_username then 'pending'
        else account.sync_status
      end,
      updated_at = now()
  where account.leetcode_username is distinct from excluded.leetcode_username;

  return new;
end;
$$;

drop trigger if exists on_profile_leetcode_username on public.profiles;
create trigger on_profile_leetcode_username
  after insert or update of leetcode_username on public.profiles
  for each row
  execute function public.sync_leetcode_account_from_profile();

revoke all on function public.sync_leetcode_account_from_profile()
  from public, anon, authenticated;
grant execute on function public.sync_leetcode_account_from_profile()
  to authenticated, service_role;

-- ────────────────────────────────────────
-- 8. BACKFILL FROM EXISTING ROWS
--    Preserve every valid profile link, including legacy shared handles.
-- ────────────────────────────────────────

with source_handles as (
  select
    profile.id as user_id,
    lower(btrim(profile.leetcode_username)) as leetcode_username,
    coalesce(profile.updated_at, profile.created_at, now()) as linked_at
  from public.profiles as profile
  where nullif(btrim(profile.leetcode_username), '') is not null
    and lower(btrim(profile.leetcode_username)) ~ '^[a-z0-9_-]{1,40}$'
)
insert into public.leetcode_accounts (
  user_id,
  leetcode_username,
  linked_at,
  last_synced_at,
  sync_status
)
select
  handles.user_id,
  handles.leetcode_username,
  handles.linked_at,
  stats.fetched_at,
  case
    when stats.fetch_status = 'fetching' then 'syncing'
    when stats.fetch_status in ('pending', 'success', 'error') then stats.fetch_status
    else 'pending'
  end
from source_handles as handles
left join public.leetcode_stats as stats
  on stats.user_id = handles.user_id
on conflict do nothing;

insert into public.user_activity (user_id, activity_date, problems_solved)
select
  stats.user_id,
  (to_timestamp(entry.key::double precision) at time zone 'utc')::date,
  sum(entry.value::integer)::integer
from public.leetcode_stats as stats
cross join lateral jsonb_each_text(stats.submission_calendar) as entry(key, value)
where entry.key ~ '^[0-9]{1,12}$'
  and entry.value ~ '^[0-9]{1,9}$'
group by
  stats.user_id,
  (to_timestamp(entry.key::double precision) at time zone 'utc')::date
on conflict (user_id, activity_date) do update
set problems_solved = excluded.problems_solved,
    updated_at = now();

insert into public.topic_stats (user_id, topic_name, problems_solved)
select
  stats.user_id,
  min(left(btrim(entry.key), 80)),
  max(entry.value::integer)
from public.leetcode_stats as stats
cross join lateral jsonb_each_text(stats.solved_by_topic) as entry(key, value)
where stats.solved_by_topic is not null
  and jsonb_typeof(stats.solved_by_topic) = 'object'
  and char_length(btrim(entry.key)) between 1 and 80
  and entry.value ~ '^[0-9]{1,9}$'
group by stats.user_id, lower(btrim(entry.key))
on conflict (user_id, lower(topic_name)) do update
set topic_name = excluded.topic_name,
    problems_solved = excluded.problems_solved,
    updated_at = now();

insert into public.sync_logs (
  user_id,
  status,
  error_message,
  started_at,
  completed_at
)
select
  attempt.user_id,
  attempt.status,
  attempt.error_message,
  attempt.started_at,
  case
    when attempt.status = 'running' or attempt.completed_candidate is null then null
    else greatest(attempt.started_at, attempt.completed_candidate)
  end
from (
  select
    state.user_id,
    case
      when state.fetch_status = 'fetching' then 'running'
      else state.fetch_status
    end as status,
    state.last_error_code as error_message,
    coalesce(state.last_attempted_at, state.updated_at, now()) as started_at,
    case
      when state.fetch_status = 'success'
        then coalesce(state.last_successful_at, state.updated_at, now())
      when state.fetch_status = 'error'
        then coalesce(state.updated_at, state.last_attempted_at, now())
      else null
    end as completed_candidate
  from public.leetcode_fetch_state as state
  where state.fetch_status in ('fetching', 'success', 'error')
) as attempt
where not exists (
  select 1
  from public.sync_logs as log
  where log.user_id = attempt.user_id
    and log.started_at = attempt.started_at
);

insert into public.user_preferences (user_id)
select profile.id
from public.profiles as profile
on conflict (user_id) do nothing;

-- ────────────────────────────────────────
-- 9. SIGNUP AND PROFILE CLAIM
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

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.create_or_complete_profile(
  p_user_id uuid,
  p_username text,
  p_display_name text,
  p_branch text,
  p_graduation_year text,
  p_leetcode_username text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile public.profiles%rowtype;
begin
  if p_user_id is null
     or p_username is null
     or p_username !~ '^[a-z0-9_]{3,30}$'
     or p_display_name is null
     or char_length(p_display_name) not between 1 and 100
     or p_branch is null
     or char_length(p_branch) not between 1 and 60
     or p_graduation_year is null
     or p_graduation_year !~ '^\d{4}$'
     or p_leetcode_username is null
     or char_length(p_leetcode_username) > 40 then
    raise exception using
      errcode = '22023',
      message = 'Invalid profile data.';
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select profile.* into current_profile
  from public.profiles as profile
  where profile.id = p_user_id
  for update;

  if nullif(btrim(current_profile.username), '') is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Profile already exists.';
  end if;

  update public.profiles as profile
  set username = p_username,
      display_name = coalesce(nullif(btrim(profile.display_name), ''), p_display_name),
      full_name = coalesce(nullif(btrim(profile.full_name), ''), p_display_name),
      branch = coalesce(nullif(btrim(profile.branch), ''), p_branch),
      graduation_year = coalesce(
        nullif(btrim(profile.graduation_year), ''),
        p_graduation_year
      ),
      leetcode_username = coalesce(
        nullif(btrim(profile.leetcode_username), ''),
        p_leetcode_username
      ),
      is_public = true
  where profile.id = p_user_id
  returning profile.* into current_profile;

  return current_profile;
end;
$$;

revoke all on function public.create_or_complete_profile(
  uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_or_complete_profile(
  uuid, text, text, text, text, text
) to service_role;

-- ────────────────────────────────────────
-- 10. PUBLIC READS
--     Anonymous and authenticated callers still cannot select the base tables.
--     These functions return an explicit field list, and only when is_public
--     is true. Private preferences, sync logs, calendars, and user ids stay out.
-- ────────────────────────────────────────

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
    'full_name', coalesce(
      nullif(btrim(profile.full_name), ''),
      nullif(btrim(profile.display_name), ''),
      profile.username
    ),
    'university', nullif(btrim(profile.university), ''),
    'usn', profile.usn,
    'branch', coalesce(nullif(btrim(profile.branch), ''), 'General'),
    'year_of_passing', nullif(profile.graduation_year, '')::integer,
    'avatar_url', profile.avatar_url,
    'bio', profile.bio,
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
    'total_solved', coalesce(stats.total_solved, stats.solved_total, 0),
    'easy_solved', coalesce(stats.easy_solved, 0),
    'medium_solved', coalesce(stats.medium_solved, 0),
    'hard_solved', coalesce(stats.hard_solved, 0),
    'contest_rating', stats.contest_rating,
    'global_ranking', stats.global_ranking,
    'ranking', stats.ranking,
    'fetched_at', stats.fetched_at,
    'last_synced_at', stats.last_synced_at,
    'created_at', profile.created_at,
    'updated_at', profile.updated_at
  )
  from public.profiles as profile
  left join public.leetcode_stats as stats
    on stats.user_id = profile.id
    and stats.fetch_status = 'success'
    and lower(btrim(stats.provider_username)) = lower(btrim(profile.leetcode_username))
  where lower(btrim(profile.username)) = lower(btrim(p_username))
    and profile.is_public
    and profile.username is not null
    and btrim(profile.username) <> '';
$$;

revoke all on function public.get_public_profile(text)
  from public, anon, authenticated;
grant execute on function public.get_public_profile(text)
  to anon, authenticated;

create or replace function public.get_public_leaderboard(
  p_branches text[],
  p_year_of_passing integer,
  p_sort_by text,
  p_sort_order text,
  p_limit integer,
  p_offset integer,
  p_search text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with public_profiles as (
    select
      profile.username,
      coalesce(
        nullif(btrim(profile.full_name), ''),
        nullif(btrim(profile.display_name), ''),
        profile.username
      ) as name,
      profile.usn,
      coalesce(nullif(btrim(profile.branch), ''), 'General') as branch,
      coalesce(profile.graduation_year, '') as year,
      nullif(btrim(profile.leetcode_username), '') as leetcode_username,
      case
        when stats.fetch_status = 'success'
          then coalesce(stats.solved_total, stats.easy_solved + stats.medium_solved + stats.hard_solved, 0)
        else 0
      end as leetcode,
      case when stats.fetch_status = 'success' then coalesce(stats.solved_total, 0) else 0 end as total,
      case when stats.fetch_status = 'success' then coalesce(stats.easy_solved, 0) else 0 end as easy_solved,
      case when stats.fetch_status = 'success' then coalesce(stats.medium_solved, 0) else 0 end as medium_solved,
      case when stats.fetch_status = 'success' then coalesce(stats.hard_solved, 0) else 0 end as hard_solved,
      case when stats.fetch_status = 'success' then stats.contest_rating else null end as contest_rating,
      case when stats.fetch_status = 'success' then stats.ranking else null end as ranking,
      case when stats.fetch_status = 'success' then stats.fetched_at else null end as fetched_at
    from public.profiles as profile
    left join public.leetcode_stats as stats
      on stats.user_id = profile.id
      and stats.fetch_status = 'success'
      and lower(btrim(stats.provider_username)) = lower(btrim(profile.leetcode_username))
    where profile.is_public
      and profile.username is not null
      and btrim(profile.username) <> ''
  ),
  filtered_profiles as (
    select public_profiles.*
    from public_profiles
    where (
      p_branches is null
      or lower(btrim(public_profiles.branch)) = any (p_branches)
    )
      and (
        p_year_of_passing is null
        or public_profiles.year = p_year_of_passing::text
      )
      and (
        nullif(btrim(p_search), '') is null
        or position(
          lower(btrim(p_search))
          in lower(concat_ws(' ', public_profiles.username, public_profiles.name, public_profiles.usn))
        ) > 0
      )
  ),
  ranked_profiles as (
    select
      filtered_profiles.*,
      row_number() over (
        order by
          case when p_sort_by = 'total_solved' and p_sort_order = 'desc' then total end desc nulls last,
          case when p_sort_by = 'total_solved' and p_sort_order = 'asc' then total end asc nulls last,
          case when p_sort_by = 'easy_solved' and p_sort_order = 'desc' then easy_solved end desc nulls last,
          case when p_sort_by = 'easy_solved' and p_sort_order = 'asc' then easy_solved end asc nulls last,
          case when p_sort_by = 'medium_solved' and p_sort_order = 'desc' then medium_solved end desc nulls last,
          case when p_sort_by = 'medium_solved' and p_sort_order = 'asc' then medium_solved end asc nulls last,
          case when p_sort_by = 'hard_solved' and p_sort_order = 'desc' then hard_solved end desc nulls last,
          case when p_sort_by = 'hard_solved' and p_sort_order = 'asc' then hard_solved end asc nulls last,
          case when p_sort_by = 'contest_rating' and p_sort_order = 'desc' then contest_rating end desc nulls last,
          case when p_sort_by = 'contest_rating' and p_sort_order = 'asc' then contest_rating end asc nulls last,
          case when p_sort_by = 'ranking' and p_sort_order = 'asc' then ranking end asc nulls last,
          case when p_sort_by = 'ranking' and p_sort_order = 'desc' then ranking end desc nulls last,
          case when p_sort_by = 'name' and p_sort_order = 'desc' then lower(name) end desc nulls last,
          case when p_sort_by = 'name' and p_sort_order = 'asc' then lower(name) end asc nulls last,
          lower(name) asc,
          lower(username) asc
      ) as rank
    from filtered_profiles
  ),
  page_rows as (
    select ranked_profiles.*
    from ranked_profiles
    order by rank
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  filtered_totals as (
    select count(*) as total
    from filtered_profiles
  ),
  overall_summary as (
    select
      count(*) as total_students,
      coalesce(sum(leetcode), 0) as total_solved,
      count(distinct branch) filter (where branch <> 'General') as active_branch_count
    from public_profiles
  ),
  available_filters as (
    select
      coalesce(
        jsonb_agg(distinct branch order by branch) filter (where branch <> 'General'),
        '[]'::jsonb
      ) as branches,
      coalesce(
        jsonb_agg(distinct year order by year desc) filter (where year ~ '^[0-9]{4}$'),
        '[]'::jsonb
      ) as years
    from public_profiles
  )
  select jsonb_build_object(
    'students',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'username', page_rows.username,
            'name', page_rows.name,
            'usn', page_rows.usn,
            'branch', page_rows.branch,
            'year', page_rows.year,
            'leetcode', page_rows.leetcode,
            'total', page_rows.total,
            'easy_solved', page_rows.easy_solved,
            'medium_solved', page_rows.medium_solved,
            'hard_solved', page_rows.hard_solved,
            'contest_rating', page_rows.contest_rating,
            'leetcode_username', page_rows.leetcode_username,
            'leetcode_profile_url',
              case
                when page_rows.leetcode_username is null then null
                else 'https://leetcode.com/u/' || page_rows.leetcode_username || '/'
              end,
            'fetched_at', page_rows.fetched_at,
            'rank', page_rows.rank
          )
          order by page_rows.rank
        )
        from page_rows
      ),
      '[]'::jsonb
    ),
    'summary',
    (
      select jsonb_build_object(
        'total_students', overall_summary.total_students,
        'total_solved', overall_summary.total_solved,
        'active_branch_count', overall_summary.active_branch_count,
        'available_branches', available_filters.branches,
        'available_years', available_filters.years
      )
      from overall_summary
      cross join available_filters
    ),
    'pagination',
    jsonb_build_object(
      'total', (select filtered_totals.total from filtered_totals),
      'limit', least(greatest(coalesce(p_limit, 20), 1), 100),
      'offset', greatest(coalesce(p_offset, 0), 0),
      'has_more',
        greatest(coalesce(p_offset, 0), 0)
        + least(greatest(coalesce(p_limit, 20), 1), 100)
        < (select filtered_totals.total from filtered_totals)
    )
  );
$$;

revoke all on function public.get_public_leaderboard(
  text[], integer, text, text, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.get_public_leaderboard(
  text[], integer, text, text, integer, integer, text
) to anon, authenticated;

commit;
