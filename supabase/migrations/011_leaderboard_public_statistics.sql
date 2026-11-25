begin;

create index if not exists leetcode_stats_leaderboard_total_success_idx
  on public.leetcode_stats (solved_total desc, user_id)
  where fetch_status = 'success';

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
      profile.avatar_url,
      coalesce(nullif(btrim(profile.branch), ''), 'General') as branch,
      coalesce(profile.graduation_year, '') as year,
      nullif(btrim(profile.leetcode_username), '') as leetcode_username,
      case
        when stats.fetch_status = 'success'
          then coalesce(stats.solved_total, stats.easy_solved + stats.medium_solved + stats.hard_solved, 0)
        else 0
      end as leetcode,
      case when stats.fetch_status = 'success' then coalesce(stats.solved_total, stats.easy_solved + stats.medium_solved + stats.hard_solved, 0) else 0 end as total,
      case when stats.fetch_status = 'success' then coalesce(stats.easy_solved, 0) else 0 end as easy_solved,
      case when stats.fetch_status = 'success' then coalesce(stats.medium_solved, 0) else 0 end as medium_solved,
      case when stats.fetch_status = 'success' then coalesce(stats.hard_solved, 0) else 0 end as hard_solved,
      case when stats.fetch_status = 'success' then coalesce(stats.global_ranking, stats.ranking) else null end as global_ranking,
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
          in lower(concat_ws(' ', public_profiles.username, public_profiles.name))
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
          total desc,
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
            'avatar_url', page_rows.avatar_url,
            'branch', page_rows.branch,
            'year', page_rows.year,
            'leetcode', page_rows.leetcode,
            'total', page_rows.total,
            'easy_solved', page_rows.easy_solved,
            'medium_solved', page_rows.medium_solved,
            'hard_solved', page_rows.hard_solved,
            'global_ranking', page_rows.global_ranking,
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
