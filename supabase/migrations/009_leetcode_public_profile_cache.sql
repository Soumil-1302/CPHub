begin;

alter table public.leetcode_stats
  add column if not exists public_profile jsonb,
  add column if not exists total_submissions bigint,
  add column if not exists acceptance_rate numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.leetcode_stats'::regclass
      and conname = 'leetcode_stats_public_profile_object_check'
  ) then
    alter table public.leetcode_stats
      add constraint leetcode_stats_public_profile_object_check
      check (public_profile is null or jsonb_typeof(public_profile) = 'object');
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.leetcode_stats'::regclass
      and conname = 'leetcode_stats_total_submissions_check'
  ) then
    alter table public.leetcode_stats
      add constraint leetcode_stats_total_submissions_check
      check (total_submissions is null or total_submissions >= 0);
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.leetcode_stats'::regclass
      and conname = 'leetcode_stats_acceptance_rate_check'
  ) then
    alter table public.leetcode_stats
      add constraint leetcode_stats_acceptance_rate_check
      check (acceptance_rate is null or acceptance_rate between 0 and 100);
  end if;
end;
$$;

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
      last_synced_at = case
        when account.leetcode_username is distinct from excluded.leetcode_username then null
        else account.last_synced_at
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

revoke all on function public.sync_leetcode_account_from_profile()
  from public, anon, authenticated;
grant execute on function public.sync_leetcode_account_from_profile()
  to authenticated, service_role;

create or replace function public.finish_leetcode_fetch_success_v3(
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
  p_recent_submissions jsonb,
  p_public_profile jsonb,
  p_total_submissions bigint,
  p_acceptance_rate numeric
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
     or (p_recent_submissions is not null and jsonb_typeof(p_recent_submissions) <> 'array')
     or (p_public_profile is not null and jsonb_typeof(p_public_profile) <> 'object')
     or (p_total_submissions is not null and p_total_submissions < 0)
     or (p_acceptance_rate is not null and p_acceptance_rate not between 0 and 100) then
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

  perform 1
  from public.profiles as profile
  where profile.id = p_user_id
    and lower(btrim(coalesce(profile.leetcode_username, ''))) = normalized_username
  for update;

  if not found then
    raise exception 'LeetCode account changed during refresh.';
  end if;

  insert into public.leetcode_stats as existing (
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
    public_profile,
    total_submissions,
    acceptance_rate,
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
    p_public_profile,
    p_total_submissions,
    p_acceptance_rate,
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
      contest_rating = case
        when existing.provider_username is distinct from excluded.provider_username
          then excluded.contest_rating
        else coalesce(excluded.contest_rating, existing.contest_rating)
      end,
      global_ranking = case
        when existing.provider_username is distinct from excluded.provider_username
          then excluded.global_ranking
        else coalesce(excluded.global_ranking, existing.global_ranking)
      end,
      solved_by_topic = case
        when existing.provider_username is distinct from excluded.provider_username
          then excluded.solved_by_topic
        else coalesce(excluded.solved_by_topic, existing.solved_by_topic)
      end,
      recent_submissions = case
        when existing.provider_username is distinct from excluded.provider_username
          then excluded.recent_submissions
        else coalesce(excluded.recent_submissions, existing.recent_submissions)
      end,
      public_profile = case
        when existing.provider_username is distinct from excluded.provider_username
          then excluded.public_profile
        else coalesce(excluded.public_profile, existing.public_profile)
      end,
      total_submissions = case
        when existing.provider_username is distinct from excluded.provider_username
          then excluded.total_submissions
        else coalesce(excluded.total_submissions, existing.total_submissions)
      end,
      acceptance_rate = case
        when existing.provider_username is distinct from excluded.provider_username
          then excluded.acceptance_rate
        else coalesce(excluded.acceptance_rate, existing.acceptance_rate)
      end,
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

revoke all on function public.finish_leetcode_fetch_success_v3(
  text, uuid, uuid, text, integer, integer, integer, integer, jsonb,
  numeric, bigint, jsonb, jsonb, jsonb, bigint, numeric
) from public, anon, authenticated;

grant execute on function public.finish_leetcode_fetch_success_v3(
  text, uuid, uuid, text, integer, integer, integer, integer, jsonb,
  numeric, bigint, jsonb, jsonb, jsonb, bigint, numeric
) to service_role;

commit;
