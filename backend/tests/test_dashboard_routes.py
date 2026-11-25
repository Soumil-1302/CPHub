import unittest
from datetime import datetime, timezone
from uuid import UUID
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_supabase_admin_client,
)
from app.main import app
from app.schemas.dashboard import (
    DashboardData,
    DashboardProfile,
    DashboardResponse,
)
from app.schemas.leetcode import LeetCodeStatsResponse

USER_ID = UUID("5dd9f397-66e2-40d1-ae8c-930693031416")


class DashboardRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = object()
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
            id=USER_ID,
            email="student@dsu.edu.in",
        )
        app.dependency_overrides[get_supabase_admin_client] = lambda: self.db
        self.client = TestClient(app)
        self.addCleanup(app.dependency_overrides.clear)

    def test_dashboard_returns_profile_and_cached_leetcode_stats(self) -> None:
        expected = DashboardResponse(
            data=DashboardData(
                profile=DashboardProfile(
                    username="student_one",
                    display_name="Student One",
                    branch="CST",
                    year_of_passing=2028,
                    leetcode_username="student_handle",
                ),
                leetcode=LeetCodeStatsResponse(
                    username="student_handle",
                    profile_url="https://leetcode.com/u/student_handle/",
                    solved_total=12,
                    easy_solved=4,
                    medium_solved=6,
                    hard_solved=2,
                    submission_calendar={"1795392000": 2},
                    fetched_at=datetime(2026, 11, 23, tzinfo=timezone.utc),
                ),
            )
        )
        with patch(
            "app.routes.dashboard.get_my_dashboard",
            return_value=expected,
        ) as dashboard:
            response = self.client.get(
                "/api/dashboard/me",
                params={"user_id": "b1d6b485-637f-461e-a2e4-e0ce6961c271"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), expected.model_dump(mode="json"))
        dashboard.assert_called_once_with(
            self.db,
            USER_ID,
            "student@dsu.edu.in",
        )

    def test_dashboard_requires_a_validated_supabase_user(self) -> None:
        app.dependency_overrides.pop(get_current_user)

        response = self.client.get("/api/dashboard/me")

        self.assertEqual(response.status_code, 401, response.text)
        self.assertEqual(response.json()["success"], False)
        self.assertEqual(response.json()["data"], None)


if __name__ == "__main__":
    unittest.main()
