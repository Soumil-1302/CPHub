import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID

from app.schemas.leetcode import LeetCodeRefreshResponse, LeetCodeStatsResponse
from app.services.dashboard_service import get_my_dashboard

USER_ID = UUID("5dd9f397-66e2-40d1-ae8c-930693031416")


def profile(*, leetcode_username: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        username="student_one",
        display_name="Student One",
        university="Example University",
        branch="CST",
        year_of_passing=2028,
        avatar_url=None,
        is_public=True,
        leetcode_username=leetcode_username,
    )


class DashboardServiceTests(unittest.TestCase):
    def test_composes_profile_with_cached_leetcode_data(self) -> None:
        cached_stats = LeetCodeStatsResponse(
            username="student_handle",
            profile_url="https://leetcode.com/u/student_handle/",
            solved_total=12,
            easy_solved=4,
            medium_solved=6,
            hard_solved=2,
            submission_calendar={"1795392000": 2},
            fetched_at=datetime(2026, 11, 23, tzinfo=timezone.utc),
        )
        with (
            patch(
                "app.services.dashboard_service.get_my_profile",
                return_value=profile(leetcode_username="student_handle"),
            ) as get_profile,
            patch(
                "app.services.dashboard_service.get_my_cached_leetcode_stats",
                return_value=LeetCodeRefreshResponse(
                    success=True,
                    cached=True,
                    data=cached_stats,
                ),
            ) as get_stats,
        ):
            result = get_my_dashboard(object(), USER_ID, "student@dsu.edu.in")

        self.assertEqual(result.data.profile.username, "student_one")
        self.assertEqual(result.data.leetcode.solved_total, 12)
        self.assertNotIn("university_email", result.model_dump()["data"]["profile"])
        self.assertNotIn("user_id", result.model_dump()["data"]["profile"])
        get_profile.assert_called_once()
        get_stats.assert_called_once()

    def test_dashboard_without_leetcode_handle_has_no_stats_lookup(self) -> None:
        with (
            patch(
                "app.services.dashboard_service.get_my_profile",
                return_value=profile(leetcode_username=None),
            ),
            patch(
                "app.services.dashboard_service.get_my_cached_leetcode_stats",
            ) as get_stats,
        ):
            result = get_my_dashboard(object(), USER_ID, "student@dsu.edu.in")

        self.assertIsNone(result.data.leetcode)
        get_stats.assert_not_called()


if __name__ == "__main__":
    unittest.main()
