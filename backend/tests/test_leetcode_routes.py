import unittest
from unittest.mock import patch
from uuid import UUID

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_supabase_admin_client,
)
from app.main import app
from app.schemas.leetcode import LeetCodeRefreshResponse, RefreshError

USER_ID = UUID("5dd9f397-66e2-40d1-ae8c-930693031416")


class LeetCodeRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = object()
        self.settings = Settings(leetcode_cache_ttl=7200)
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
            id=USER_ID,
            email="student@dsu.edu.in",
        )
        app.dependency_overrides[get_supabase_admin_client] = lambda: self.db
        app.dependency_overrides[get_settings] = lambda: self.settings
        self.client = TestClient(app)
        self.addCleanup(app.dependency_overrides.clear)

    def test_authenticated_refresh_route_uses_validated_user_id_and_cache_ttl(self) -> None:
        expected = LeetCodeRefreshResponse(success=True, cached=True)
        with patch(
            "app.routes.leetcode.refresh_my_leetcode_stats",
            return_value=(expected, 200),
        ) as refresh:
            response = self.client.post("/api/leetcode/refresh")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), expected.model_dump(mode="json"))
        refresh.assert_called_once_with(self.db, USER_ID, 7200)

    def test_sync_alias_and_cached_profile_route_use_authenticated_user(self) -> None:
        expected = LeetCodeRefreshResponse(success=True, cached=True)
        with patch(
            "app.routes.leetcode.refresh_my_leetcode_stats",
            return_value=(expected, 200),
        ) as refresh:
            response = self.client.post("/api/leetcode/sync")
        self.assertEqual(response.status_code, 200, response.text)
        refresh.assert_called_once_with(self.db, USER_ID, 7200)

        with patch(
            "app.routes.leetcode.get_my_cached_leetcode_stats",
            return_value=expected,
        ) as read:
            response = self.client.get("/api/leetcode/profile")
        self.assertEqual(response.status_code, 200, response.text)
        read.assert_called_once_with(self.db, USER_ID)

    def test_sync_status_route_uses_authenticated_user(self) -> None:
        expected = {
            "success": True,
            "cached": True,
            "data": {
                "username": "student_handle",
                "status": "syncing",
                "last_synced_at": None,
                "last_attempted_at": None,
                "last_completed_at": None,
                "error_message": None,
            },
            "error": None,
        }
        with patch(
            "app.routes.leetcode.get_my_leetcode_sync_status",
            return_value=expected,
        ) as get_status:
            response = self.client.get(
                "/api/leetcode/sync-status",
                params={"user_id": str(USER_ID)},
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), expected)
        get_status.assert_called_once_with(self.db, USER_ID)

    def test_sync_route_exposes_retry_after_for_rate_limits(self) -> None:
        expected = LeetCodeRefreshResponse(
            success=False,
            cached=False,
            error=RefreshError(
                code="upstream_rate_limited",
                message="LeetCode is rate limiting requests.",
                retry_after_seconds=900,
            ),
        )
        with patch(
            "app.routes.leetcode.refresh_my_leetcode_stats",
            return_value=(expected, 429),
        ):
            response = self.client.post("/api/leetcode/sync")

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["retry-after"], "900")

    def test_activity_limit_and_account_update_are_scoped_to_jwt_user(self) -> None:
        with patch(
            "app.routes.leetcode.get_my_leetcode_activity",
            return_value={"success": True, "cached": True, "data": None},
        ) as activity:
            response = self.client.get("/api/leetcode/activity?limit=3660")
        self.assertEqual(response.status_code, 200, response.text)
        activity.assert_called_once_with(self.db, USER_ID, 3660)

        with patch("app.routes.leetcode.get_my_leetcode_activity") as activity:
            response = self.client.get("/api/leetcode/activity?limit=3661")
        self.assertEqual(response.status_code, 422)
        activity.assert_not_called()

        with patch(
            "app.routes.leetcode.update_my_leetcode_account",
            return_value={"success": True, "cached": False, "data": None},
        ) as update:
            response = self.client.put(
                "/api/leetcode/account",
                json={"leetcode_username": "student_handle"},
            )
        self.assertEqual(response.status_code, 200, response.text)
        update.assert_called_once_with(self.db, USER_ID, "student_handle")

    def test_invalid_leetcode_account_username_is_rejected(self) -> None:
        with patch("app.routes.leetcode.update_my_leetcode_account") as update:
            response = self.client.put(
                "/api/leetcode/account",
                json={"leetcode_username": "username/with/path"},
            )
        self.assertEqual(response.status_code, 422)
        update.assert_not_called()

    def test_account_update_rejects_client_supplied_owner_id(self) -> None:
        with patch("app.routes.leetcode.update_my_leetcode_account") as update:
            response = self.client.put(
                "/api/leetcode/account",
                json={
                    "leetcode_username": "student_handle",
                    "user_id": str(USER_ID),
                },
            )
        self.assertEqual(response.status_code, 422)
        update.assert_not_called()

    def test_refresh_ignores_client_supplied_owner_id(self) -> None:
        account_b_id = UUID("b1d6b485-637f-461e-a2e4-e0ce6961c271")
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
            id=account_b_id,
            email="student-b@dsu.edu.in",
        )
        expected = LeetCodeRefreshResponse(success=True, cached=True)
        with patch(
            "app.routes.leetcode.refresh_my_leetcode_stats",
            return_value=(expected, 200),
        ) as refresh:
            response = self.client.post(
                "/api/leetcode/refresh",
                params={"user_id": str(USER_ID)},
            )

        self.assertEqual(response.status_code, 200, response.text)
        refresh.assert_called_once_with(self.db, account_b_id, 7200)

    def test_old_versioned_refresh_path_is_not_registered(self) -> None:
        response = self.client.post("/api/v1/leetcode/refresh")

        self.assertEqual(response.status_code, 404)

    def test_service_errors_use_the_refresh_response_shape(self) -> None:
        failure = HTTPException(
            status_code=400,
            detail={
                "code": "leetcode_username_required",
                "message": "Add a LeetCode username to your profile first.",
            },
        )
        with patch(
            "app.routes.leetcode.refresh_my_leetcode_stats",
            side_effect=failure,
        ):
            response = self.client.post("/api/leetcode/refresh")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {
                "success": False,
                "cached": False,
                "data": None,
                "error": {
                    "code": "leetcode_username_required",
                    "message": "Add a LeetCode username to your profile first.",
                    "retry_after_seconds": None,
                },
            },
        )


if __name__ == "__main__":
    unittest.main()
