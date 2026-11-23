-- CPHub profile API additions.
-- Apply after 001_initial_schema.sql and 002_leetcode_provider.sql.
-- Existing profile rows and RLS policies are deliberately preserved.

alter table public.profiles
  add column if not exists username text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_username_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (username is null or username ~ '^[a-z0-9_]{3,30}$')
      not valid;
  end if;
end;
$$;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

comment on column public.profiles.username is
  'Public, unique CPHub profile username. NULL for legacy profiles until claimed.';

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
      branch = coalesce(nullif(btrim(profile.branch), ''), p_branch),
      graduation_year = coalesce(
        nullif(btrim(profile.graduation_year), ''),
        p_graduation_year
      ),
      leetcode_username = coalesce(
        nullif(btrim(profile.leetcode_username), ''),
        p_leetcode_username
      )
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
