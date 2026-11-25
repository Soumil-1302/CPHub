begin;

create or replace function public.auth_user_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from auth.users as auth_user
    where lower(btrim(auth_user.email)) = lower(btrim(p_email))
  );
$function$;

revoke all on function public.auth_user_exists(text)
  from public, anon, authenticated;
grant execute on function public.auth_user_exists(text) to service_role;

create or replace function public.complete_registration(
  p_user_id uuid,
  p_username text,
  p_full_name text,
  p_university text,
  p_branch text,
  p_graduation_year integer,
  p_leetcode_username text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_profile public.profiles%rowtype;
begin
  if p_user_id is null
     or p_username is null
     or p_username !~ '^[a-z0-9_]{3,30}$'
     or p_full_name is null
     or char_length(btrim(p_full_name)) not between 1 and 100
     or p_university is null
     or char_length(btrim(p_university)) not between 1 and 120
     or p_branch is null
     or char_length(btrim(p_branch)) not between 1 and 60
     or p_graduation_year is null
     or p_graduation_year < 1900
     or p_graduation_year > 2200
     or p_leetcode_username is null
     or p_leetcode_username !~ '^[A-Za-z0-9_-]{1,40}$' then
    raise exception using
      errcode = '22023',
      message = 'Invalid registration data.';
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
      display_name = btrim(p_full_name),
      full_name = btrim(p_full_name),
      university = btrim(p_university),
      branch = btrim(p_branch),
      graduation_year = p_graduation_year::text,
      leetcode_username = btrim(p_leetcode_username),
      is_public = true
  where profile.id = p_user_id
  returning profile.* into current_profile;

  insert into public.leetcode_stats (user_id, provider_username, fetch_status)
  values (p_user_id, btrim(p_leetcode_username), 'pending')
  on conflict (user_id) do nothing;

  return current_profile;
end;
$function$;

revoke all on function public.complete_registration(
  uuid, text, text, text, text, integer, text
) from public, anon, authenticated;
grant execute on function public.complete_registration(
  uuid, text, text, text, text, integer, text
) to service_role;

commit;
