-- Keep provider metadata separate from stats so failed refreshes never
-- overwrite a user's last successful stats with defaults or partial data.
alter table public.leetcode_stats
  add column if not exists provider_username text;

drop policy if exists "Users can insert their own stats" on public.leetcode_stats;
drop policy if exists "Users can update their own stats" on public.leetcode_stats;
revoke insert, update, delete on public.leetcode_stats from public, anon, authenticated;

create table if not exists public.leetcode_fetch_state (
  leetcode_username text primary key
    check (char_length(leetcode_username) between 1 and 40),
  user_id uuid not null references auth.users(id) on delete cascade,
  fetch_status text not null default 'pending'
    check (fetch_status in ('pending', 'fetching', 'success', 'error')),
  last_attempted_at timestamptz,
  last_successful_at timestamptz,
  next_allowed_at timestamptz not null default '-infinity',
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now()
);

alter table public.leetcode_fetch_state enable row level security;
revoke all on public.leetcode_fetch_state from public, anon, authenticated;
grant all on public.leetcode_fetch_state to service_role;

create or replace function public.claim_leetcode_fetch(
  p_username text,
  p_user_id uuid,
  p_min_interval_seconds integer,
  p_lease_seconds integer
)
returns table (
  claimed boolean,
  retry_after_seconds integer,
  reason text,
  attempt_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text := lower(btrim(p_username));
  current_state public.leetcode_fetch_state%rowtype;
  new_token uuid := gen_random_uuid();
begin
  if normalized_username !~ '^[a-z0-9_-]{1,40}$'
     or p_user_id is null
     or p_min_interval_seconds < 1
     or p_lease_seconds < 1 then
    raise exception 'Invalid LeetCode refresh claim.';
  end if;

  insert into public.leetcode_fetch_state (leetcode_username, user_id)
  values (normalized_username, p_user_id)
  on conflict (leetcode_username) do nothing;

  select state.* into current_state
  from public.leetcode_fetch_state as state
  where state.leetcode_username = normalized_username
  for update;

  if current_state.lease_until > now() then
    return query select
      false,
      greatest(1, ceil(extract(epoch from (current_state.lease_until - now())))::integer),
      'in_progress'::text,
      null::uuid;
    return;
  end if;

  if current_state.next_allowed_at > now() then
    return query select
      false,
      greatest(1, ceil(extract(epoch from (current_state.next_allowed_at - now())))::integer),
      'rate_limited'::text,
      null::uuid;
    return;
  end if;

  update public.leetcode_fetch_state as state
  set user_id = p_user_id,
      fetch_status = 'fetching',
      last_attempted_at = now(),
      next_allowed_at = now() + make_interval(secs => least(p_min_interval_seconds, 3600)),
      lease_token = new_token,
      lease_until = now() + make_interval(secs => least(p_lease_seconds, 120)),
      last_error_code = null,
      updated_at = now()
  where state.leetcode_username = normalized_username;

  return query select true, 0, null::text, new_token;
end;
$$;

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
  where state.leetcode_username = lower(btrim(p_username))
    and state.user_id = p_user_id
    and state.lease_token = p_attempt_token
    and state.fetch_status = 'fetching';

  get diagnostics updated_state_count = row_count;
  if updated_state_count <> 1 then
    raise exception 'LeetCode refresh lease is no longer valid.';
  end if;

  return true;
end;
$$;

revoke all on function public.claim_leetcode_fetch(text, uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.finish_leetcode_fetch_success(
  text, uuid, uuid, text, integer, integer, integer, integer, jsonb
) from public, anon, authenticated;
revoke all on function public.finish_leetcode_fetch_error(text, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_leetcode_fetch(text, uuid, integer, integer)
  to service_role;
grant execute on function public.finish_leetcode_fetch_success(
  text, uuid, uuid, text, integer, integer, integer, integer, jsonb
) to service_role;
grant execute on function public.finish_leetcode_fetch_error(text, uuid, uuid, text)
  to service_role;
