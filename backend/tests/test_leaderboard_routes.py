import unittest
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.dependencies import get_supabase_public_client
from app.main import app


def leaderboard_payload() -> dict:
    return {
        "students": [
            {
                "username": "student_one",
                "name": "Student One",
                "usn": "eng25ct0060",
                "branch": "CST",
                "year": "2028",
                "leetcode": 12,
                "total": 12,
                "easy_solved": 4,
                "medium_solved": 6,
                "hard_solved": 2,
                "contest_rating": 1420.5,
                "leetcode_username": "student_handle",
                "leetcode_profile_url": "https://leetcode.com/u/student_handle/",
                "fetched_at": "2026-11-23T12:00:00+00:00",
                "rank": 1,
            }
        ],
        "summary": {
            "total_students": 2,
            "total_solved": 12,
            "active_branch_count": 1,
            "available_branches": ["CST"],
            "available_years": ["2028"],
        },
        "pagination": {"total": 1, "limit": 20, "offset": 0, "has_more": False},
    }


class FakeRpc:
    def __init__(self, client: "FakePublicSupabaseClient", name: str, params: dict) -> None:
        self.client = client
        self.name = name
        self.params = params

    def execute(self) -> SimpleNamespace:
        self.client.calls.append((self.name, self.params))
        if self.client.error:
            raise RuntimeError("private database response")
        return SimpleNamespace(data=self.client.payload)


class FakePublicSupabaseClient:
    def __init__(self) -> None:
        self.payload = leaderboard_payload()
        self.calls: list[tuple[str, dict]] = []
        self.error = False

    def rpc(self, name: str, params: dict) -> FakeRpc:
        return FakeRpc(self, name, params)


class LeaderboardRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = FakePublicSupabaseClient()
        app.dependency_overrides[get_supabase_public_client] = lambda: self.db
        self.client = TestClient(app)
        self.addCleanup(app.dependency_overrides.clear)

    def test_returns_public_legacy_compatible_student_fields_without_auth(self) -> None:
        response = self.client.get("/api/leaderboard")

        self.assertEqual(response.status_code, 200, response.text)
        student = response.json()["data"]["students"][0]
        self.assertEqual(student["name"], "Student One")
        self.assertEqual(student["leetcode"], 12)
        self.assertEqual(student["year"], "2028")
        self.assertNotIn("email", student)
        self.assertNotIn("user_id", student)
        self.assertEqual(self.db.calls[0][0], "get_public_leaderboard")
        self.assertEqual(self.db.calls[0][1]["p_branches"], None)

    def test_filters_and_paginates_in_database_function(self) -> None:
        response = self.client.get(
            "/api/leaderboard",
            params={
                "branch": "ct",
                "year": 2028,
                "sort_by": "medium_solved",
                "sort_order": "asc",
                "limit": 10,
                "offset": 20,
                "search": "Student",
            },
        )

        self.assertEqual(response.status_code, 200, response.text)
        args = self.db.calls[0][1]
        self.assertIn("cst", args["p_branches"])
        self.assertIn("ct", args["p_branches"])
        self.assertEqual(args["p_year_of_passing"], 2028)
        self.assertEqual(args["p_sort_by"], "medium_solved")
        self.assertEqual(args["p_sort_order"], "asc")
        self.assertEqual(args["p_limit"], 10)
        self.assertEqual(args["p_offset"], 20)
        self.assertEqual(args["p_search"], "Student")

    def test_includes_students_without_a_leetcode_handle_or_cached_stats(self) -> None:
        self.db.payload["students"] = [
            {
                "username": "new_student",
                "name": "New Student",
                "usn": None,
                "branch": "CSE",
                "year": "2029",
                "leetcode": 0,
                "total": 0,
                "easy_solved": 0,
                "medium_solved": 0,
                "hard_solved": 0,
                "contest_rating": None,
                "leetcode_username": None,
                "leetcode_profile_url": None,
                "fetched_at": None,
                "rank": 2,
            }
        ]

        response = self.client.get("/api/leaderboard")

        self.assertEqual(response.status_code, 200, response.text)
        student = response.json()["data"]["students"][0]
        self.assertEqual(student["username"], "new_student")
        self.assertEqual(student["total"], 0)
        self.assertIsNone(student["leetcode_username"])
        self.assertIsNone(student["contest_rating"])

    def test_rejects_unknown_branch(self) -> None:
        response = self.client.get("/api/leaderboard", params={"branch": "unknown"})

        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.db.calls, [])

    def test_rejects_invalid_sort_and_pagination_values(self) -> None:
        for params in (
            {"sort_by": "email"},
            {"sort_order": "sideways"},
            {"limit": 101},
            {"offset": -1},
        ):
            with self.subTest(params=params):
                response = self.client.get("/api/leaderboard", params=params)
                self.assertEqual(response.status_code, 422)

    def test_database_failure_does_not_expose_database_error(self) -> None:
        self.db.error = True

        response = self.client.get("/api/leaderboard")

        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private database response", response.text)
        self.assertEqual(response.json()["error"]["code"], "leaderboard_unavailable")

    def test_private_fields_from_database_result_are_not_serialized(self) -> None:
        self.db.payload["students"][0]["email"] = "student@dsu.edu.in"

        response = self.client.get("/api/leaderboard")

        self.assertEqual(response.status_code, 503)
        self.assertNotIn("student@dsu.edu.in", response.text)


if __name__ == "__main__":
    unittest.main()
