import unittest
from unittest.mock import patch
from uuid import UUID

from fastapi.testclient import TestClient

from app.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_supabase_admin_client,
)
from app.main import app
from app.schemas.settings import UserSettingsData, UserSettingsResponse

USER_ID = UUID("5dd9f397-66e2-40d1-ae8c-930693031416")


class SettingsRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = object()
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
            id=USER_ID,
            email="student@dsu.edu.in",
        )
        app.dependency_overrides[get_supabase_admin_client] = lambda: self.db
        self.client = TestClient(app)
        self.addCleanup(app.dependency_overrides.clear)

    def test_settings_are_read_for_the_authenticated_user(self) -> None:
        expected = UserSettingsResponse(
            data=UserSettingsData(
                is_public=True,
                notification_preferences={"sync_reminders": True},
            )
        )
        with patch(
            "app.routes.settings.get_my_settings",
            return_value=expected.data,
        ) as get_settings:
            response = self.client.get("/api/settings/me")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), expected.model_dump(mode="json"))
        get_settings.assert_called_once_with(self.db, USER_ID)

    def test_settings_updates_use_authenticated_owner_and_reject_user_id(self) -> None:
        with patch(
            "app.routes.settings.update_my_settings",
            return_value=UserSettingsData(
                is_public=False,
                notification_preferences={"sync_reminders": True},
            ),
        ) as update_settings:
            response = self.client.put(
                "/api/settings/me",
                json={
                    "is_public": False,
                    "notification_preferences": {"sync_reminders": True},
                },
            )

        self.assertEqual(response.status_code, 200, response.text)
        update_settings.assert_called_once()
        self.assertEqual(update_settings.call_args.args[0], self.db)
        self.assertEqual(update_settings.call_args.args[1], USER_ID)
        self.assertEqual(
            update_settings.call_args.args[2].model_dump(exclude_unset=True),
            {
                "is_public": False,
                "notification_preferences": {"sync_reminders": True},
            },
        )

        with patch("app.routes.settings.update_my_settings") as update_settings:
            response = self.client.put(
                "/api/settings/me",
                json={"is_public": False, "user_id": str(USER_ID)},
            )
        self.assertEqual(response.status_code, 422)
        update_settings.assert_not_called()

        with patch("app.routes.settings.update_my_settings") as update_settings:
            response = self.client.put("/api/settings/me", json={"is_public": None})
        self.assertEqual(response.status_code, 422)
        update_settings.assert_not_called()

    def test_account_deletion_requires_confirmation_and_uses_jwt_owner(self) -> None:
        with patch("app.routes.settings.delete_my_account") as delete_account:
            response = self.client.request(
                "DELETE",
                "/api/settings/account",
                json={"confirmation": "DELETE"},
            )

        self.assertEqual(response.status_code, 200, response.text)
        delete_account.assert_called_once_with(self.db, USER_ID)

        with patch("app.routes.settings.delete_my_account") as delete_account:
            response = self.client.request(
                "DELETE",
                "/api/settings/account",
                json={"confirmation": "DELETE", "user_id": str(USER_ID)},
            )
        self.assertEqual(response.status_code, 422)
        delete_account.assert_not_called()


if __name__ == "__main__":
    unittest.main()
