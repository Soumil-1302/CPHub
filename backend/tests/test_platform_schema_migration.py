import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATHS = (
    ROOT / "supabase" / "migrations" / "007_platform_architecture.sql",
)
AUTH_MIGRATION_PATHS = (
    ROOT / "supabase" / "migrations" / "008_passwordless_registration.sql",
)
LEETCODE_PROFILE_MIGRATION_PATHS = (
    ROOT / "supabase" / "migrations" / "009_leetcode_public_profile_cache.sql",
)
PUBLIC_PROFILE_MIGRATION_PATHS = (
    ROOT / "supabase" / "migrations" / "010_public_profile_analytics.sql",
)
LEADERBOARD_MIGRATION_PATHS = (
    ROOT / "supabase" / "migrations" / "011_leaderboard_public_statistics.sql",
)
SECURITY_MIGRATION_PATH = ROOT / "supabase" / "migrations" / "012_security_hardening.sql"


class PlatformSchemaMigrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.migrations = [path.read_text(encoding="utf-8") for path in MIGRATION_PATHS]
        self.migration = self.migrations[0].lower()

    def test_canonical_migration_is_loaded(self) -> None:
        self.assertEqual(len(self.migrations), 1)

    def test_migration_does_not_destroy_existing_data(self) -> None:
        without_comments = "\n".join(
            line
            for line in self.migrations[0].splitlines()
            if not line.strip().startswith("--")
        ).lower()

        self.assertNotIn("drop table", without_comments)
        self.assertNotIn("delete from", without_comments)
        self.assertNotIn("truncate ", without_comments)
        self.assertNotIn("drop column", without_comments)

    def test_passwordless_migration_is_additive(self) -> None:
        migrations = [path.read_text(encoding="utf-8") for path in AUTH_MIGRATION_PATHS]
        self.assertEqual(len(migrations), 1)
        migration = migrations[0].lower()
        without_comments = "\n".join(
            line for line in migration.splitlines() if not line.strip().startswith("--")
        )

        self.assertIn("begin;", migration)
        self.assertIn("commit;", migration)
        self.assertNotIn("drop table", without_comments)
        self.assertNotIn("delete from", without_comments)
        self.assertNotIn("truncate ", without_comments)
        self.assertIn("create or replace function public.auth_user_exists", migration)
        self.assertIn("from auth.users as auth_user", migration)
        self.assertIn("grant execute on function public.auth_user_exists(text) to service_role", migration)
        self.assertIn("create or replace function public.complete_registration", migration)
        self.assertIn("grant execute on function public.complete_registration", migration)
        self.assertIn("on conflict (user_id) do nothing", migration)
        self.assertIn("p_leetcode_username !~", migration)

    def test_leetcode_profile_cache_migration_is_additive(self) -> None:
        migrations = [
            path.read_text(encoding="utf-8")
            for path in LEETCODE_PROFILE_MIGRATION_PATHS
        ]
        self.assertEqual(len(migrations), 1)
        migration = migrations[0].lower()
        without_comments = "\n".join(
            line for line in migration.splitlines() if not line.strip().startswith("--")
        )

        self.assertIn("begin;", migration)
        self.assertIn("commit;", migration)
        self.assertNotIn("drop table", without_comments)
        self.assertNotIn("delete from", without_comments)
        self.assertNotIn("truncate ", without_comments)
        self.assertIn("add column if not exists public_profile jsonb", migration)
        self.assertIn("add column if not exists total_submissions bigint", migration)
        self.assertIn("add column if not exists acceptance_rate numeric", migration)
        self.assertIn("finish_leetcode_fetch_success_v3", migration)
        self.assertIn("p_total_submissions bigint", migration)
        self.assertIn("p_acceptance_rate numeric", migration)
        self.assertIn("public.apply_leetcode_sync_result", migration)
        self.assertIn("else coalesce(excluded.public_profile, existing.public_profile)", migration)
        self.assertIn("existing.provider_username is distinct from excluded.provider_username", migration)
        self.assertIn("grant execute", migration)
        self.assertIn("to service_role", migration)
        self.assertIn("last_synced_at = case", migration)

    def test_required_tables_and_ownership_rules_are_present(self) -> None:
        for name in (
            "public.leetcode_accounts",
            "public.user_activity",
            "public.topic_stats",
            "public.sync_logs",
            "public.user_preferences",
        ):
            self.assertIn(f"create table if not exists {name}", self.migration)
            self.assertIn(f"alter table {name} enable row level security", self.migration)
            self.assertIn(
                f"revoke all on table {name} from public, anon, authenticated",
                self.migration,
            )

        self.assertIn("references auth.users (id) on delete cascade", self.migration)
        self.assertIn("constraint leetcode_accounts_user_id_key unique (user_id)", self.migration)
        self.assertNotIn("unique (leetcode_username)", self.migration)
        self.assertIn("constraint user_activity_user_date_key unique (user_id, activity_date)", self.migration)
        self.assertIn("on public.topic_stats (user_id, lower(topic_name))", self.migration)
        self.assertIn("profiles_username_unique_idx", self.migration)
        self.assertIn("using (auth.uid() = user_id)", self.migration)
        self.assertIn("using (auth.uid() = user_id)", self.migration)
        self.assertIn("add column if not exists full_name text", self.migration)
        self.assertIn("add column if not exists is_public boolean", self.migration)
        self.assertIn("create or replace function public.sync_profile_name_columns()", self.migration)
        self.assertIn("add column if not exists total_solved integer not null default 0", self.migration)
        self.assertIn("add column if not exists ranking bigint", self.migration)
        self.assertIn("on conflict (user_id) do update", self.migration)
        self.assertIn("to service_role", self.migration)
        self.assertIn("profile.is_public", self.migration)
        self.assertIn("alter table public.profiles disable trigger on_profiles_updated", self.migration)
        self.assertNotIn("disable trigger user", self.migration)
        self.assertIn("sync_status = 'unlinked'", self.migration)
        self.assertIn("current_profile_username = normalized_username", self.migration)
        self.assertIn("from source_handles as handles", self.migration)
        self.assertIn("begin;", self.migration)
        self.assertIn("commit;", self.migration)
        public_profile = self.migration.split("create or replace function public.get_public_profile", 1)[1]
        self.assertNotIn("'email'", public_profile)
        self.assertNotIn("'user_id'", public_profile)
        self.assertNotIn("notification_preferences", public_profile)

    def test_public_profile_analytics_migration_is_additive_and_privacy_scoped(self) -> None:
        migrations = [
            path.read_text(encoding="utf-8")
            for path in PUBLIC_PROFILE_MIGRATION_PATHS
        ]
        self.assertEqual(len(migrations), 1)
        migration = migrations[0].lower()
        without_comments = "\n".join(
            line for line in migration.splitlines() if not line.strip().startswith("--")
        )

        self.assertIn("begin;", migration)
        self.assertIn("commit;", migration)
        self.assertNotIn("drop table", without_comments)
        self.assertNotIn("delete from", without_comments)
        self.assertNotIn("truncate ", without_comments)
        self.assertIn("create or replace function public.get_public_profile", migration)
        self.assertIn("security definer", migration)
        self.assertIn("set search_path = ''", migration)
        self.assertIn("and profile.is_public", migration)
        self.assertIn("'avatar_url'", migration)
        self.assertIn("'global_ranking'", migration)
        self.assertIn("'activity'", migration)
        self.assertIn("'topics'", migration)
        self.assertIn("to_timestamp", migration)
        self.assertIn("revoke all on function public.get_public_profile(text)", migration)
        self.assertIn("grant execute on function public.get_public_profile(text)", migration)
        for private_key in (
            "'user_id'",
            "'id'",
            "'email'",
            "'university_email'",
            "'usn'",
            "'access_token'",
            "'notification_preferences'",
            "'dashboard_preferences'",
            "'sync_logs'",
        ):
            self.assertNotIn(private_key, migration)

    def test_leaderboard_migration_is_publicly_scoped_and_exposes_only_approved_fields(self) -> None:
        migrations = [
            path.read_text(encoding="utf-8")
            for path in LEADERBOARD_MIGRATION_PATHS
        ]
        self.assertEqual(len(migrations), 1)
        migration = migrations[0].lower()
        without_comments = "\n".join(
            line for line in migration.splitlines() if not line.strip().startswith("--")
        )

        self.assertIn("begin;", migration)
        self.assertIn("commit;", migration)
        self.assertNotIn("drop table", without_comments)
        self.assertNotIn("delete from", without_comments)
        self.assertNotIn("truncate ", without_comments)
        self.assertIn("where profile.is_public", migration)
        self.assertIn("create index if not exists leetcode_stats_leaderboard_total_success_idx", migration)
        self.assertIn("'avatar_url'", migration)
        self.assertIn("'easy_solved'", migration)
        self.assertIn("'medium_solved'", migration)
        self.assertIn("'hard_solved'", migration)
        self.assertIn("'global_ranking'", migration)
        self.assertIn("'fetched_at'", migration)
        self.assertIn("lower(username) asc", migration)
        self.assertIn("to anon, authenticated", migration)
        for private_key in (
            "'user_id'",
            "'id'",
            "'email'",
            "'usn'",
            "'access_token'",
            "'notification_preferences'",
            "'dashboard_preferences'",
        ):
            self.assertNotIn(private_key, migration)

    def test_security_hardening_migration_preserves_policies_and_limits_trigger_access(self) -> None:
        migration = SECURITY_MIGRATION_PATH.read_text(encoding="utf-8").lower()
        without_comments = "\n".join(
            line for line in migration.splitlines() if not line.strip().startswith("--")
        )

        self.assertIn("begin;", migration)
        self.assertIn("commit;", migration)
        self.assertNotIn("drop policy", without_comments)
        self.assertNotIn("drop table", without_comments)
        self.assertNotIn("delete from", without_comments)
        self.assertNotIn("truncate ", without_comments)
        self.assertIn("alter function public.handle_updated_at() set search_path = ''", migration)
        self.assertIn("alter function public.sync_leetcode_stats_columns() set search_path = ''", migration)
        self.assertIn("revoke all on function public.handle_new_user()", migration)
        self.assertIn("using ((select auth.uid()) = user_id)", migration)
        self.assertIn("create index if not exists leetcode_fetch_state_user_id_idx", migration)


if __name__ == "__main__":
    unittest.main()
