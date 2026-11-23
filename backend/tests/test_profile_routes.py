import unittest
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID

from fastapi.testclient import TestClient

from app.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_supabase_admin_client,
    get_supabase_public_client,
)
from app.main import app

OWNER_ID = UUID("5dd9f397-66e2-40d1-ae8c-930693031416")
OTHER_ID = UUID("b1d6b485-637f-461e-a2e4-e0ce6961c271")
TIMESTAMP = datetime(2026, 11, 23, tzinfo=timezone.utc).isoformat()


class FakeDatabaseError(Exception):
    def __init__(self, code: str):
        super().__init__("database detail must not be exposed")
        self.code = code


class FakeQuery:
    def __init__(self, client: "FakeSupabaseClient", table: str):
        self.client = client
        self.table_name = table
        self.columns = "*"
        self.filters: dict[str, str] = {}
        self.updates: dict[str, object] | None = None

    def select(self, columns: str) -> "FakeQuery":
        self.columns = columns
        return self

    def eq(self, column: str, value: str) -> "FakeQuery":
        self.filters[column] = value
        return self

    def maybe_single(self) -> "FakeQuery":
        return self

    def update(self, values: dict[str, object]) -> "FakeQuery":
        self.updates = values
        return self

    def execute(self) -> SimpleNamespace:
        self.client.last_selected_columns = self.columns
        row = next(
            (
                item
                for item in self.client.profiles.values()
                if all(str(item.get(key)) == value for key, value in self.filters.items())
            ),
            None,
        )
        if row is None:
            return SimpleNamespace(data=None)
        if self.updates is not None:
            row.update(self.updates)
            row["updated_at"] = TIMESTAMP
        result = {key: deepcopy(row[key]) for key in self.columns.split(",") if key in row}
        return SimpleNamespace(data=result)


class FakeRpc:
    def __init__(self, client: "FakeSupabaseClient", params: dict[str, object]):
        self.client = client
        self.params = params

    def execute(self) -> SimpleNamespace:
        owner_id = str(self.params["p_user_id"])
        row = self.client.profiles.get(owner_id)
        if row and row.get("username"):
            raise FakeDatabaseError("P0001")

        wanted_username = str(self.params["p_username"])
        if any(
            item.get("username", "").casefold() == wanted_username.casefold()
            for key, item in self.client.profiles.items()
            if key != owner_id
        ):
            raise FakeDatabaseError("23505")

        if row is None:
            row = {
                "id": owner_id,
                "display_name": "",
                "branch": "",
                "graduation_year": "",
                "leetcode_username": "",
                "created_at": TIMESTAMP,
                "updated_at": TIMESTAMP,
            }
            self.client.profiles[owner_id] = row

        row["username"] = wanted_username
        for field in ("display_name", "branch", "graduation_year", "leetcode_username"):
            if not str(row.get(field) or "").strip():
                row[field] = self.params[f"p_{field}"]
        row["updated_at"] = TIMESTAMP
        return SimpleNamespace(data=deepcopy(row))


class FakePublicProfileRpc:
    def __init__(self, client: "FakeSupabaseClient", params: dict[str, object]):
        self.client = client
        self.params = params

    def execute(self) -> SimpleNamespace:
        self.client.last_rpc = "get_public_profile"
        username = str(self.params["p_username"]).casefold()
        row = next(
            (
                item
                for item in self.client.profiles.values()
                if str(item.get("username") or "").casefold() == username
            ),
            None,
        )
        if row is None:
            return SimpleNamespace(data=None)
        leetcode_username = str(row.get("leetcode_username") or "").strip() or None
        stats = self.client.stats.get(str(row.get("id")), {})
        if (
            stats.get("fetch_status") != "success"
            or str(stats.get("provider_username") or "").casefold()
            != str(leetcode_username or "").casefold()
        ):
            stats = {}
        return SimpleNamespace(
            data={
                "username": row["username"],
                "display_name": row.get("display_name") or row["username"],
                "usn": row.get("usn"),
                "branch": row.get("branch") or "General",
                "year_of_passing": int(row["graduation_year"]),
                "leetcode_username": leetcode_username,
                "leetcode_profile_url": (
                    f"https://leetcode.com/u/{leetcode_username}/"
                    if leetcode_username
                    else None
                ),
                "solved_total": stats.get("solved_total", 0),
                "easy_solved": stats.get("easy_solved", 0),
                "medium_solved": stats.get("medium_solved", 0),
                "hard_solved": stats.get("hard_solved", 0),
                "contest_rating": stats.get("contest_rating"),
                "global_ranking": stats.get("global_ranking"),
                "fetched_at": stats.get("fetched_at"),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        )


class FakeSupabaseClient:
    def __init__(self) -> None:
        self.profiles: dict[str, dict[str, object]] = {}
        self.stats: dict[str, dict[str, object]] = {}
        self.last_selected_columns = ""
        self.last_rpc = ""

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)

    def rpc(self, name: str, params: dict[str, object]) -> FakeRpc | FakePublicProfileRpc:
        if name == "get_public_profile":
            return FakePublicProfileRpc(self, params)
        return FakeRpc(self, params)


class ProfileRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = FakeSupabaseClient()
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
            id=OWNER_ID,
            email="student@dsu.edu.in",
        )
        app.dependency_overrides[get_supabase_admin_client] = lambda: self.db
        app.dependency_overrides[get_supabase_public_client] = lambda: self.db
        self.client = TestClient(app)
        self.addCleanup(app.dependency_overrides.clear)

    def test_create_profile_completes_existing_trigger_row_without_overwriting_data(self) -> None:
        self.db.profiles[str(OWNER_ID)] = {
            "id": str(OWNER_ID),
            "username": None,
            "display_name": "Existing Auth Name",
            "branch": "",
            "graduation_year": "",
            "leetcode_username": "",
            "created_at": TIMESTAMP,
            "updated_at": TIMESTAMP,
        }

        response = self.client.post(
            "/api/profile",
            json={
                "username": "NewStudent",
                "display_name": "Submitted Name",
                "branch": "cs",
                "year_of_passing": 2028,
                "leetcode_profile_url": "https://leetcode.com/u/student_handle/",
            },
        )

        self.assertEqual(response.status_code, 201, response.text)
        payload = response.json()
        self.assertEqual(payload["user_id"], str(OWNER_ID))
        self.assertEqual(payload["university_email"], "student@dsu.edu.in")
        self.assertEqual(payload["username"], "newstudent")
        self.assertEqual(payload["display_name"], "Existing Auth Name")
        self.assertEqual(payload["branch"], "CSE")
        self.assertEqual(payload["year_of_passing"], 2028)
        self.assertEqual(payload["leetcode_username"], "student_handle")
        self.assertEqual(payload["leetcode_profile_url"], "https://leetcode.com/u/student_handle/")

    def test_create_preserves_all_existing_non_empty_profile_fields(self) -> None:
        self.db.profiles[str(OWNER_ID)] = {
            "id": str(OWNER_ID),
            "username": None,
            "display_name": "Saved Name",
            "branch": "ECE",
            "graduation_year": "2027",
            "leetcode_username": "saved_handle",
            "created_at": TIMESTAMP,
            "updated_at": TIMESTAMP,
        }

        response = self.client.post(
            "/api/profile",
            json={
                "username": "claimed_username",
                "display_name": "Replacement Name",
                "branch": "CSE",
                "year_of_passing": 2029,
                "leetcode_profile_url": "https://leetcode.com/u/replacement_handle/",
            },
        )

        self.assertEqual(response.status_code, 201, response.text)
        profile = self.db.profiles[str(OWNER_ID)]
        self.assertEqual(profile["display_name"], "Saved Name")
        self.assertEqual(profile["branch"], "ECE")
        self.assertEqual(profile["graduation_year"], "2027")
        self.assertEqual(profile["leetcode_username"], "saved_handle")

    def test_create_rejects_identity_fields_supplied_by_client(self) -> None:
        response = self.client.post(
            "/api/profile",
            json={
                "user_id": str(OTHER_ID),
                "email": "other@dsu.edu.in",
                "username": "student",
                "display_name": "Student",
                "branch": "CSE",
                "year_of_passing": 2028,
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "validation_error")
        self.assertEqual(self.db.profiles, {})

    def test_create_rejects_unknown_branch(self) -> None:
        body = {
            "username": "validstudent",
            "display_name": "Valid Student",
            "branch": "Not a branch",
            "year_of_passing": 2028,
            "leetcode_profile_url": "https://leetcode.com/u/student_handle/",
        }
        response = self.client.post("/api/profile", json=body)

        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.db.profiles, {})

    def test_create_rejects_non_leetcode_profile_url(self) -> None:
        body = {
            "username": "validstudent",
            "display_name": "Valid Student",
            "branch": "CSE",
            "year_of_passing": 2028,
            "leetcode_profile_url": "https://example.com/attacker",
        }
        response = self.client.post("/api/profile", json=body)

        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.db.profiles, {})

    def test_create_rejects_year_outside_existing_student_options(self) -> None:
        response = self.client.post(
            "/api/profile",
            json={
                "username": "validstudent",
                "display_name": "Valid Student",
                "branch": "CSE",
                "year_of_passing": 2200,
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.db.profiles, {})

    def test_create_rejects_duplicate_username(self) -> None:
        self.db.profiles[str(OTHER_ID)] = {
            "id": str(OTHER_ID),
            "username": "taken_name",
            "display_name": "Other",
        }

        response = self.client.post(
            "/api/profile",
            json={
                "username": "taken_name",
                "display_name": "Student",
                "branch": "CSE",
                "year_of_passing": 2028,
            },
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "username_taken")
        self.assertNotIn("database detail", response.text)

    def test_get_me_handles_authenticated_user_without_profile(self) -> None:
        response = self.client.get("/api/profile/me")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "profile_not_found")

    def test_update_changes_only_authenticated_users_row(self) -> None:
        self.db.profiles[str(OWNER_ID)] = {
            "id": str(OWNER_ID),
            "username": "student_name",
            "display_name": "Student",
            "branch": "CSE",
            "graduation_year": "2028",
            "leetcode_username": "",
            "created_at": TIMESTAMP,
            "updated_at": TIMESTAMP,
        }
        response = self.client.put(
            "/api/profile/me",
            json={
                "display_name": "Updated Student",
                "year_of_passing": 2029,
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["display_name"], "Updated Student")
        self.assertEqual(response.json()["year_of_passing"], 2029)
        self.assertEqual(self.db.profiles[str(OWNER_ID)]["display_name"], "Updated Student")
        self.assertEqual(self.db.profiles[str(OWNER_ID)]["graduation_year"], "2029")

    def test_update_rejects_an_attempt_to_choose_another_owner(self) -> None:
        response = self.client.put(
            "/api/profile/me",
            json={"user_id": str(OTHER_ID), "display_name": "Intruder"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.db.profiles, {})

    def test_account_b_cannot_update_account_a_profile(self) -> None:
        self.db.profiles[str(OWNER_ID)] = {
            "id": str(OWNER_ID),
            "username": "student_name",
            "display_name": "Student",
            "branch": "CSE",
            "graduation_year": "2028",
            "leetcode_username": "",
            "created_at": TIMESTAMP,
            "updated_at": TIMESTAMP,
        }
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
            id=OTHER_ID,
            email="other@dsu.edu.in",
        )

        response = self.client.put(
            "/api/profile/me",
            json={"display_name": "Changed by another account"},
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.db.profiles[str(OWNER_ID)]["display_name"], "Student")

    def test_public_profile_does_not_expose_private_fields(self) -> None:
        self.db.profiles[str(OWNER_ID)] = {
            "id": str(OWNER_ID),
            "username": "student_name",
            "display_name": "Student",
            "branch": "CSE",
            "graduation_year": "2028",
            "leetcode_username": "student_handle",
            "created_at": TIMESTAMP,
            "updated_at": TIMESTAMP,
            "email": "private@dsu.edu.in",
            "access_token": "must-not-return",
        }

        response = self.client.get("/api/profile/student_name")

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertNotIn("user_id", payload)
        self.assertNotIn("id", payload)
        self.assertNotIn("email", payload)
        self.assertNotIn("university_email", payload)
        self.assertNotIn("access_token", payload)
        self.assertNotIn("private@dsu.edu.in", response.text)
        self.assertNotIn("must-not-return", response.text)
        self.assertEqual(self.db.last_rpc, "get_public_profile")
        self.assertEqual(self.db.last_selected_columns, "")

    def test_account_b_can_view_account_a_public_profile_and_cached_stats(self) -> None:
        self.db.profiles[str(OWNER_ID)] = {
            "id": str(OWNER_ID),
            "username": "student_name",
            "display_name": "Student",
            "branch": "CSE",
            "graduation_year": "2028",
            "leetcode_username": "student_handle",
            "created_at": TIMESTAMP,
            "updated_at": TIMESTAMP,
        }
        self.db.stats[str(OWNER_ID)] = {
            "provider_username": "student_handle",
            "fetch_status": "success",
            "solved_total": 20,
            "easy_solved": 8,
            "medium_solved": 9,
            "hard_solved": 3,
            "contest_rating": 1420.5,
            "global_ranking": 12345,
            "fetched_at": TIMESTAMP,
            "submission_calendar": {"private": "not returned"},
        }
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
            id=OTHER_ID,
            email="other@dsu.edu.in",
        )

        response = self.client.get("/api/profile/student_name")

        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertEqual(payload["username"], "student_name")
        self.assertEqual(payload["solved_total"], 20)
        self.assertEqual(payload["easy_solved"], 8)
        self.assertEqual(payload["contest_rating"], 1420.5)
        self.assertNotIn("user_id", payload)
        self.assertNotIn("email", payload)
        self.assertNotIn("submission_calendar", payload)

    def test_public_profile_returns_not_found_without_disclosing_data(self) -> None:
        response = self.client.get("/api/profile/missing_student")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "profile_not_found")

    def test_security_migration_restricts_base_tables_and_projects_public_profile(self) -> None:
        migration_path = (
            Path(__file__).resolve().parents[2]
            / "Frontend"
            / "supabase"
            / "migrations"
            / "006_secure_public_profile_access.sql"
        )
        migration = migration_path.read_text(encoding="utf-8").lower()

        self.assertIn("revoke all on table public.profiles from public, anon, authenticated", migration)
        self.assertIn(
            "revoke all on table public.leetcode_stats from public, anon, authenticated",
            migration,
        )
        self.assertIn("using (auth.uid() = id)", migration)
        self.assertIn("using (auth.uid() = user_id)", migration)
        self.assertIn("create or replace function public.get_public_profile", migration)
        self.assertIn("security definer", migration)
        self.assertIn("to anon, authenticated", migration)
        self.assertNotIn("'email'", migration)
        self.assertNotIn("'user_id'", migration)

    def test_migration_adds_username_without_changing_existing_rls_policies(self) -> None:
        migration_path = (
            Path(__file__).resolve().parents[2]
            / "Frontend"
            / "supabase"
            / "migrations"
            / "003_user_profiles_api.sql"
        )
        migration = migration_path.read_text(encoding="utf-8")

        self.assertIn("add column if not exists username text", migration)
        self.assertIn("create unique index if not exists profiles_username_unique_idx", migration)
        self.assertIn("security definer", migration.lower())
        self.assertIn("from public, anon, authenticated", migration)
        self.assertRegex(migration, r"grant execute[\s\S]+to service_role")
        self.assertNotRegex(
            migration.lower(),
            r"(?m)^\s*(create|drop|alter)\s+policy\b",
        )


if __name__ == "__main__":
    unittest.main()
