-- Optional fields are nullable because LeetCode may not expose them for every
-- profile, and its public GraphQL schema can change without notice.
alter table public.leetcode_stats
  add column if not exists contest_rating numeric,
  add column if not exists global_ranking bigint,
  add column if not exists solved_by_topic jsonb,
  add column if not exists recent_submissions jsonb;

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

  return to_jsonb(saved_stats);
end;
$$;

revoke all on function public.finish_leetcode_fetch_success_v2(
  text, uuid, uuid, text, integer, integer, integer, integer, jsonb,
  numeric, bigint, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.finish_leetcode_fetch_success_v2(
  text, uuid, uuid, text, integer, integer, integer, integer, jsonb,
  numeric, bigint, jsonb, jsonb
) to service_role;
