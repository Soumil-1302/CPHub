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
from app.schemas.leetcode import LeetCodeRefreshResponse

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
