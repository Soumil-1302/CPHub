-- Tighten trigger-function grants and make owner checks init-plan friendly.
-- Apply after migration 011. This migration preserves all existing policies
-- and data while changing only policy expressions, function privileges, and
-- one missing foreign-key index.

begin;

alter function public.handle_updated_at() set search_path = '';
alter function public.sync_leetcode_stats_columns() set search_path = '';

revoke all on function public.handle_new_user()
  from public, anon, authenticated;
revoke all on function public.handle_updated_at()
  from public, anon, authenticated;
revoke all on function public.rls_auto_enable()
  from public, anon, authenticated;
revoke all on function public.sync_leetcode_account_from_profile()
  from public, anon, authenticated;
revoke all on function public.sync_leetcode_stats_columns()
  from public, anon, authenticated;

alter policy "Users can view their own profile" on public.profiles
  using ((select auth.uid()) = id);
alter policy "Users can insert their own profile" on public.profiles
  with check ((select auth.uid()) = id);
alter policy "Users can update their own profile" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "Users can view their own stats" on public.leetcode_stats
  using ((select auth.uid()) = user_id);
alter policy "Users can view their own LeetCode account" on public.leetcode_accounts
  using ((select auth.uid()) = user_id);
alter policy "Users can view their own activity" on public.user_activity
  using ((select auth.uid()) = user_id);
alter policy "Users can view their own topic stats" on public.topic_stats
  using ((select auth.uid()) = user_id);
alter policy "Users can view their own sync logs" on public.sync_logs
  using ((select auth.uid()) = user_id);
alter policy "Users can view their own preferences" on public.user_preferences
  using ((select auth.uid()) = user_id);
alter policy "Users can insert their own preferences" on public.user_preferences
  with check ((select auth.uid()) = user_id);
alter policy "Users can update their own preferences" on public.user_preferences
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists leetcode_fetch_state_user_id_idx
  on public.leetcode_fetch_state (user_id);

commit;
