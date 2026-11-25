import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.dependencies import get_supabase_admin_client
from app.main import app
from app.routes import auth as auth_route


class FakeRpc:
    def __init__(self, account_exists: bool):
        self.account_exists = account_exists
        self.name = None
        self.params = None

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self.account_exists)


class FakeAdminClient:
    def __init__(self, account_exists: bool = False):
        self.account_exists = account_exists
        self.last_rpc = None

    def rpc(self, name: str, params: dict[str, object]) -> FakeRpc:
        self.last_rpc = (name, params)
        return FakeRpc(self.account_exists)


class FakeAuth:
    def __init__(self, error: Exception | None = None):
        self.request = None
        self.error = error

    def sign_in_with_otp(self, request: dict[str, object]) -> None:
        self.request = request
        if self.error:
            raise self.error


class OtpRateLimitError(Exception):
    status = 429


class UnknownAuthUserError(Exception):
    status = 400
    code = "user_not_found"


class SupabaseConfigurationErrorForTest(Exception):
    status = 400
    code = "email_provider_disabled"
    message = "SMTP provider configuration detail"


class AuthRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.admin = FakeAdminClient()
        self.auth = FakeAuth()
        app.dependency_overrides[get_supabase_admin_client] = lambda: self.admin
        self.client = TestClient(app)
        self.auth_client_patch = patch(
            "app.routes.auth.create_supabase_auth_client",
            return_value=SimpleNamespace(auth=self.auth),
        )
        self.auth_client_patch.start()
        self.addCleanup(self.auth_client_patch.stop)
        self.addCleanup(app.dependency_overrides.clear)

    def request(self, email: str = "student@dsu.edu.in", intent: str = "login"):
        return self.client.post("/api/auth/otp", json={"email": email, "intent": intent})

    def test_registration_creates_only_when_account_does_not_exist(self) -> None:
        self.admin.account_exists = False

        response = self.request(intent="register")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.auth.request, {
            "email": "student@dsu.edu.in",
            "options": {"should_create_user": True},
        })
        self.assertEqual(self.admin.last_rpc, (
            "auth_user_exists",
            {"p_email": "student@dsu.edu.in"},
        ))

    def test_registration_of_existing_account_uses_non_creating_otp(self) -> None:
        self.admin.account_exists = True

        response = self.request(intent="register")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.auth.request["options"]["should_create_user"], False)
        self.assertEqual(response.json()["data"]["message"], (
            "If the address is eligible, a verification code has been sent."
        ))

    def test_returning_login_always_disallows_user_creation(self) -> None:
        self.admin.account_exists = True

        response = self.request(intent="login")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.auth.request["options"]["should_create_user"], False)

    def test_unknown_login_and_known_account_responses_do_not_disclose_existence(self) -> None:
        unknown_response = self.request(intent="login")
        self.admin.account_exists = True
        known_response = self.request(intent="login")

        self.assertEqual(unknown_response.status_code, known_response.status_code)
        self.assertEqual(unknown_response.json(), known_response.json())
        self.assertNotIn("account_exists", unknown_response.text)

    def test_unknown_login_provider_error_is_masked_but_provider_failures_are_reported(self) -> None:
        self.auth.error = UnknownAuthUserError()
        unknown_response = self.request(intent="login")
        self.assertEqual(unknown_response.status_code, 200)

        self.auth.error = SupabaseConfigurationErrorForTest()
        provider_response = self.request(intent="register")
        self.assertEqual(provider_response.status_code, 503)
        self.assertNotIn("SMTP provider configuration detail", provider_response.text)

    def test_rejects_non_university_email(self) -> None:
        response = self.request("student@gmail.com", "register")

        self.assertEqual(response.status_code, 422)
        self.assertIsNone(self.auth.request)

    def test_supabase_auth_rate_limit_is_returned_as_generic_error(self) -> None:
        self.auth.error = OtpRateLimitError()

        response = self.request()

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["error"]["code"], "otp_rate_limited")
        self.assertNotIn("student@dsu.edu.in", response.text)

    def test_account_lookup_failure_does_not_continue_with_otp_request(self) -> None:
        self.admin.rpc = lambda *_args, **_kwargs: (_ for _ in ()).throw(
            RuntimeError("private database detail")
        )

        response = self.request(intent="register")

        self.assertEqual(response.status_code, 503)
        self.assertIsNone(self.auth.request)
        self.assertNotIn("private database detail", response.text)


if __name__ == "__main__":
    unittest.main()
