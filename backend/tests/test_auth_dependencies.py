import unittest
from types import SimpleNamespace
from uuid import UUID
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from supabase_auth.errors import AuthApiError, AuthInvalidJwtError

from app.dependencies import get_current_user, get_supabase_admin_client
from app.main import app
from app.services.supabase_service import (
    create_supabase_admin_client,
    create_supabase_auth_client,
    create_supabase_public_client,
)
from app.config import Settings

USER_ID = UUID("5dd9f397-66e2-40d1-ae8c-930693031416")


class SupabaseAuthenticationDependencyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        profile_query = Mock()
        profile_query.select.return_value = profile_query
        profile_query.eq.return_value = profile_query
        profile_query.maybe_single.return_value = profile_query
        profile_query.execute.return_value = SimpleNamespace(
            data={
                "id": str(USER_ID),
                "username": "student_name",
                "display_name": "Student",
                "branch": "CSE",
                "graduation_year": "2028",
                "leetcode_username": "",
                "created_at": "2026-11-23T00:00:00+00:00",
                "updated_at": "2026-11-23T00:00:00+00:00",
            }
        )
        self.admin_client = SimpleNamespace(
            table=Mock(return_value=profile_query),
        )
        app.dependency_overrides[get_supabase_admin_client] = lambda: self.admin_client
        self.addCleanup(app.dependency_overrides.clear)
        self.auth_client = SimpleNamespace(
            auth=SimpleNamespace(
                get_user=Mock(
                    return_value=SimpleNamespace(
                        user=SimpleNamespace(id=str(USER_ID), email="must-not-leak@example.com")
                    )
                )
            )
        )
        self.auth_client_patch = patch(
            "app.dependencies.create_supabase_auth_client",
            return_value=self.auth_client,
        )
        self.create_auth_client = self.auth_client_patch.start()
        self.addCleanup(self.auth_client_patch.stop)

    def test_valid_bearer_token_is_validated_with_supabase_auth(self) -> None:
        response = self.client.get(
            "/api/profile/me",
            headers={"Authorization": "Bearer valid-access-token"},
        )

        self.assertEqual(response.status_code, 200)
        self.auth_client.auth.get_user.assert_called_once_with("valid-access-token")
        self.assertNotIn("valid-access-token", response.text)
        self.assertEqual(response.json()["university_email"], "must-not-leak@example.com")

    def test_authenticated_user_id_comes_from_supabase_auth_response(self) -> None:
        user = get_current_user("valid-access-token", Settings())

        self.assertEqual(user.id, USER_ID)
        self.auth_client.auth.get_user.assert_called_once_with("valid-access-token")

    def test_invalid_bearer_token_is_rejected_without_leaking_token(self) -> None:
        self.auth_client.auth.get_user.side_effect = AuthInvalidJwtError("Invalid JWT")
        token = "invalid-access-token"

        response = self.client.get(
            "/api/profile/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "unauthorized")
        self.assertEqual(response.headers["www-authenticate"], "Bearer")
        self.assertNotIn(token, response.text)

    def test_expired_bearer_token_is_rejected_with_401(self) -> None:
        self.auth_client.auth.get_user.side_effect = AuthApiError(
            "JWT expired",
            401,
            None,
        )

        response = self.client.get(
            "/api/profile/me",
            headers={"Authorization": "Bearer expired-access-token"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertNotIn("expired-access-token", response.text)

    def test_missing_bearer_token_returns_401_without_contacting_supabase(self) -> None:
        response = self.client.get("/api/profile/me")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "unauthorized")
        self.create_auth_client.assert_not_called()

    def test_non_bearer_authorization_returns_401(self) -> None:
        response = self.client.get(
            "/api/profile/me",
            headers={"Authorization": "Basic dXNlcjpwYXNz"},
        )

        self.assertEqual(response.status_code, 401)
        self.create_auth_client.assert_not_called()

    def test_auth_client_uses_anon_key_and_admin_client_uses_server_role_key(self) -> None:
        settings = Settings(
            supabase_url="https://project.supabase.co",
            supabase_anon_key="public-anon-key",
            supabase_service_role_key="server-role-secret",
        )
        with patch("app.services.supabase_service.create_client") as create_client:
            create_supabase_auth_client(settings)
            create_supabase_public_client(settings)
            create_supabase_admin_client(settings)

        self.assertEqual(
            create_client.call_args_list[0].args,
            ("https://project.supabase.co", "public-anon-key"),
        )
        self.assertEqual(
            create_client.call_args_list[1].args,
            ("https://project.supabase.co", "public-anon-key"),
        )
        self.assertEqual(
            create_client.call_args_list[2].args,
            ("https://project.supabase.co", "server-role-secret"),
        )


if __name__ == "__main__":
    unittest.main()
