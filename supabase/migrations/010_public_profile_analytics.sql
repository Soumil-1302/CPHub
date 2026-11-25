begin;

create or replace function public.get_public_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'username', profile.username,
    'display_name', coalesce(
      nullif(btrim(profile.display_name), ''),
      nullif(btrim(profile.full_name), ''),
      profile.username
    ),
    'full_name', coalesce(
      nullif(btrim(profile.full_name), ''),
      nullif(btrim(profile.display_name), ''),
      profile.username
    ),
    'university', nullif(btrim(profile.university), ''),
    'branch', coalesce(nullif(btrim(profile.branch), ''), 'General'),
    'year_of_passing', nullif(profile.graduation_year, '')::integer,
    'avatar_url', profile.avatar_url,
    'bio', profile.bio,
    'is_public', true,
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
    'global_ranking', coalesce(stats.global_ranking, stats.ranking),
    'fetched_at', stats.fetched_at,
    'activity',
      case
        when nullif(btrim(profile.leetcode_username), '') is null then null
        else jsonb_build_object(
          'username', btrim(profile.leetcode_username),
          'days', coalesce(activity.days, '[]'::jsonb),
          'fetched_at', stats.fetched_at,
          'available', coalesce(activity.available, false)
        )
      end,
    'topics',
      case
        when nullif(btrim(profile.leetcode_username), '') is null then null
        else jsonb_build_object(
          'username', btrim(profile.leetcode_username),
          'topics', coalesce(topic_data.topics, '[]'::jsonb),
          'fetched_at', stats.fetched_at,
          'available', coalesce(topic_data.available, false)
        )
      end,
    'created_at', profile.created_at,
    'updated_at', profile.updated_at
  )
  from public.profiles as profile
  left join public.leetcode_stats as stats
    on stats.user_id = profile.id
    and stats.fetch_status = 'success'
    and lower(btrim(stats.provider_username)) = lower(btrim(profile.leetcode_username))
  left join lateral (
    select
      jsonb_agg(
        jsonb_build_object(
          'activity_date',
          case
            when activity_entry.epoch ~ '^[0-9]{1,10}$'
              then (to_timestamp(activity_entry.epoch::double precision) at time zone 'UTC')::date
          end,
          'submissions_count',
          case
            when activity_entry.submissions ~ '^[0-9]{1,9}$'
              then activity_entry.submissions::integer
          end
        )
        order by case
          when activity_entry.epoch ~ '^[0-9]{1,10}$' then activity_entry.epoch::bigint
        end
      ) as days,
      count(*) > 0 as available
    from jsonb_each_text(
      case
        when jsonb_typeof(stats.submission_calendar) = 'object'
          then stats.submission_calendar
        else '{}'::jsonb
      end
    ) as activity_entry(epoch, submissions)
    where activity_entry.epoch ~ '^[0-9]{1,10}$'
      and case
        when activity_entry.epoch ~ '^[0-9]{1,10}$'
          then activity_entry.epoch::bigint between 0 and 4102444800
        else false
      end
      and case
        when activity_entry.submissions ~ '^[0-9]{1,9}$'
          then activity_entry.submissions::integer > 0
        else false
      end
  ) as activity on true
  left join lateral (
    select
      jsonb_agg(
        jsonb_build_object(
          'topic_name', btrim(topic_entry.topic_name),
          'problems_solved',
          case
            when topic_entry.problems_solved ~ '^[0-9]{1,9}$'
              then topic_entry.problems_solved::integer
          end
        )
        order by case
          when topic_entry.problems_solved ~ '^[0-9]{1,9}$'
            then topic_entry.problems_solved::integer
        end desc, lower(topic_entry.topic_name)
      ) as topics,
      count(*) > 0 as available
    from jsonb_each_text(
      case
        when jsonb_typeof(stats.solved_by_topic) = 'object'
          then stats.solved_by_topic
        else '{}'::jsonb
      end
    ) as topic_entry(topic_name, problems_solved)
    where length(btrim(topic_entry.topic_name)) between 1 and 80
      and case
        when topic_entry.problems_solved ~ '^[0-9]{1,9}$' then true
        else false
      end
  ) as topic_data on true
  where lower(btrim(profile.username)) = lower(btrim(p_username))
    and profile.is_public
    and profile.username is not null
    and btrim(profile.username) <> '';
$$;

revoke all on function public.get_public_profile(text)
  from public, anon, authenticated;
grant execute on function public.get_public_profile(text)
  to anon, authenticated;

commit;
