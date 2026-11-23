import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID

import httpx
from fastapi import HTTPException

from app.services.leetcode_service import (
    LeetCodeProviderError,
    LeetCodeStats,
    fetch_leetcode_stats,
    normalize_leetcode_username,
    refresh_my_leetcode_stats,
)

USER_ID = UUID("5dd9f397-66e2-40d1-ae8c-930693031416")
NOW = datetime(2026, 11, 23, tzinfo=timezone.utc)


def provider_payload(username: str = "student_handle") -> dict:
    return {
        "data": {
            "matchedUser": {
                "username": username,
                "profile": {"ranking": 1234},
                "submitStats": {
                    "acSubmissionNum": [
                        {"difficulty": "All", "count": 6},
                        {"difficulty": "Easy", "count": 2},
                        {"difficulty": "Medium", "count": 3},
                        {"difficulty": "Hard", "count": 1},
                    ]
                },
                "submissionCalendar": '{"1732300000":2}',
            },
            "userContestRanking": {"rating": 1480.25, "globalRanking": 4321},
            "recentSubmissionList": [
                {
                    "title": "Two Sum",
                    "titleSlug": "two-sum",
                    "timestamp": "1732300000",
                    "statusDisplay": "Accepted",
                    "lang": "python3",
                }
            ],
        }
    }


class FakeQuery:
    def __init__(self, client: "FakeSupabaseClient", table: str) -> None:
        self.client = client
        self.table_name = table
        self.columns = ""
        self.filters: dict[str, str] = {}

    def select(self, columns: str) -> "FakeQuery":
        self.columns = columns
        return self

    def eq(self, column: str, value: str) -> "FakeQuery":
        self.filters[column] = value
        return self

    def maybe_single(self) -> "FakeQuery":
        return self

    def execute(self) -> SimpleNamespace:
        rows = self.client.tables[self.table_name]
        row = next(
            (
                item
                for item in rows
                if all(str(item.get(key)) == value for key, value in self.filters.items())
            ),
            None,
        )
        return SimpleNamespace(
            data={key: deepcopy(row[key]) for key in self.columns.split(",") if key in row}
            if row
            else None
        )


class FakeRpc:
    def __init__(self, client: "FakeSupabaseClient", name: str, params: dict) -> None:
        self.client = client
        self.name = name
        self.params = params

    def execute(self) -> SimpleNamespace:
        self.client.rpc_calls.append((self.name, deepcopy(self.params)))
        if self.name == "claim_leetcode_fetch":
            return SimpleNamespace(
                data=[
                    {
                        "claimed": self.client.claimed,
                        "retry_after_seconds": 18,
                        "reason": self.client.claim_reason,
                        "attempt_token": "0a9c3270-d28d-424a-a633-c20e78a33a49"
                        if self.client.claimed
                        else None,
                    }
                ]
            )
        if self.name == "finish_leetcode_fetch_error":
            return SimpleNamespace(data=True)
        if self.name == "finish_leetcode_fetch_success_v2":
            row = {
                "user_id": self.params["p_user_id"],
                "provider_username": self.params["p_provider_username"],
                "solved_total": self.params["p_solved_total"],
                "easy_solved": self.params["p_easy_solved"],
                "medium_solved": self.params["p_medium_solved"],
                "hard_solved": self.params["p_hard_solved"],
                "submission_calendar": self.params["p_submission_calendar"],
                "contest_rating": self.params["p_contest_rating"],
                "global_ranking": self.params["p_global_ranking"],
                "solved_by_topic": self.params["p_solved_by_topic"],
                "recent_submissions": self.params["p_recent_submissions"],
                "fetched_at": NOW.isoformat(),
                "fetch_status": "success",
            }
            self.client.tables["leetcode_stats"] = [row]
            return SimpleNamespace(data=row)
        raise AssertionError(f"Unexpected RPC: {self.name}")


class FakeSupabaseClient:
    def __init__(self) -> None:
        self.tables = {
            "profiles": [{"id": str(USER_ID), "leetcode_username": "student_handle"}],
            "leetcode_stats": [],
        }
        self.rpc_calls: list[tuple[str, dict]] = []
        self.claimed = True
        self.claim_reason = None

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)

    def rpc(self, name: str, params: dict) -> FakeRpc:
        return FakeRpc(self, name, params)


class LeetCodeProviderTests(unittest.TestCase):
    def test_normalizes_and_validates_username(self) -> None:
        self.assertEqual(normalize_leetcode_username(" Student_Handle "), "student_handle")
        for invalid in ("", "user/name", "x" * 41, None):
            with self.subTest(invalid=invalid), self.assertRaises(LeetCodeProviderError):
                normalize_leetcode_username(invalid)

    def test_fetches_and_validates_supported_statistics(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertIn("recentSubmissionList", request.content.decode())
            return httpx.Response(200, json=provider_payload())

        stats = fetch_leetcode_stats(
            "student_handle",
            client_factory=lambda **kwargs: httpx.Client(
                transport=httpx.MockTransport(handler),
                **kwargs,
            ),
        )

        self.assertEqual(stats.solved_total, 6)
        self.assertEqual(stats.easy_solved, 2)
        self.assertEqual(stats.contest_rating, 1480.25)
        self.assertEqual(stats.global_ranking, 4321)
        self.assertEqual(stats.recent_submissions[0]["title_slug"], "two-sum")
        self.assertEqual(stats.submission_calendar, {"1732300000": 2})
        self.assertIsNone(stats.solved_by_topic)

    def test_falls_back_to_core_statistics_when_optional_fields_are_unavailable(self) -> None:
        requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if len(requests) == 1:
                return httpx.Response(200, json={"errors": [{"message": "unknown optional field"}]})
            return httpx.Response(200, json={"data": {"matchedUser": provider_payload()["data"]["matchedUser"]}})

        stats = fetch_leetcode_stats(
            "student_handle",
            client_factory=lambda **kwargs: httpx.Client(
                transport=httpx.MockTransport(handler),
                **kwargs,
            ),
        )

        self.assertEqual(len(requests), 2)
        self.assertIsNone(stats.contest_rating)
        self.assertIsNone(stats.recent_submissions)
        self.assertEqual(stats.solved_total, 6)

    def test_maps_missing_profile_to_not_found(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": {"matchedUser": None}})

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "profile_not_found")
        self.assertEqual(error.exception.status_code, 404)

    def test_maps_upstream_rate_limit(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(429)

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "upstream_rate_limited")
        self.assertEqual(error.exception.status_code, 429)

    def test_maps_network_failure_without_exposing_provider_details(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("sensitive transport details")

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "upstream_unavailable")
        self.assertNotIn("sensitive", str(error.exception))

    def test_maps_provider_timeout(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            raise httpx.ReadTimeout("transport details")

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "upstream_timeout")
        self.assertEqual(error.exception.status_code, 504)

    def test_rejects_oversized_provider_response(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=b" " * (256 * 1024 + 1))

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "response_too_large")

    def test_rejects_malformed_provider_data(self) -> None:
        payload = provider_payload()
        payload["data"]["matchedUser"]["submitStats"]["acSubmissionNum"][0]["count"] = -1

        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=payload)

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "invalid_response")


class LeetCodeRefreshTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = FakeSupabaseClient()

    def test_returns_fresh_cache_without_calling_provider(self) -> None:
        self.client.tables["leetcode_stats"] = [
            {
                "user_id": str(USER_ID),
                "provider_username": "student_handle",
                "solved_total": 6,
                "easy_solved": 2,
                "medium_solved": 3,
                "hard_solved": 1,
                "submission_calendar": {},
                "contest_rating": None,
                "global_ranking": None,
                "solved_by_topic": None,
                "recent_submissions": None,
                "fetched_at": (NOW - timedelta(minutes=10)).isoformat(),
                "fetch_status": "success",
            }
        ]

        def fail_if_called(_username: str) -> LeetCodeStats:
            raise AssertionError("fresh cache should not call the provider")

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            3600,
            fetcher=fail_if_called,
            now=NOW,
        )

        self.assertEqual(response_status, 200)
        self.assertTrue(response.cached)
        self.assertEqual(response.data.solved_total, 6)
        self.assertEqual(self.client.rpc_calls, [])

    def test_successful_refresh_persists_all_supported_stats(self) -> None:
        stats = LeetCodeStats(
            provider_username="student_handle",
            solved_total=6,
            easy_solved=2,
            medium_solved=3,
            hard_solved=1,
            submission_calendar={"1732300000": 2},
            contest_rating=1480.25,
            global_ranking=4321,
            recent_submissions=[],
        )

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            3600,
            fetcher=lambda _username: stats,
        )

        self.assertEqual(response_status, 200)
        self.assertFalse(response.cached)
        self.assertEqual(response.data.contest_rating, 1480.25)
        self.assertEqual(response.data.global_ranking, 4321)
        self.assertEqual(self.client.rpc_calls[-1][0], "finish_leetcode_fetch_success_v2")
        self.assertEqual(self.client.rpc_calls[-1][1]["p_user_id"], str(USER_ID))

    def test_provider_failure_returns_old_stats_without_overwriting_them(self) -> None:
        prior_row = {
            "user_id": str(USER_ID),
            "provider_username": "student_handle",
            "solved_total": 6,
            "easy_solved": 2,
            "medium_solved": 3,
            "hard_solved": 1,
            "submission_calendar": {},
            "contest_rating": 1234.5,
            "global_ranking": 7654,
            "solved_by_topic": None,
            "recent_submissions": None,
            "fetched_at": (NOW - timedelta(days=2)).isoformat(),
            "fetch_status": "success",
        }
        self.client.tables["leetcode_stats"] = [deepcopy(prior_row)]

        def fail(_username: str) -> LeetCodeStats:
            raise LeetCodeProviderError("upstream_timeout", "LeetCode did not respond.", 504)

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            3600,
            fetcher=fail,
            now=NOW,
        )

        self.assertEqual(response_status, 504)
        self.assertFalse(response.success)
        self.assertTrue(response.cached)
        self.assertEqual(response.data.solved_total, 6)
        self.assertEqual(response.data.contest_rating, 1234.5)
        self.assertEqual(self.client.tables["leetcode_stats"][0], prior_row)
        self.assertEqual(self.client.rpc_calls[-1][0], "finish_leetcode_fetch_error")

    def test_fetch_claim_rate_limit_returns_existing_cache(self) -> None:
        self.client.claimed = False
        self.client.claim_reason = "rate_limited"

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            1,
            fetcher=lambda _username: self.fail("rate-limited claims must not fetch"),
        )

        self.assertEqual(response_status, 429)
        self.assertEqual(response.error.retry_after_seconds, 18)
        self.assertIsNone(response.data)

    def test_missing_saved_username_is_rejected(self) -> None:
        self.client.tables["profiles"][0]["leetcode_username"] = None

        with self.assertRaises(HTTPException) as error:
            refresh_my_leetcode_stats(self.client, USER_ID, 3600)

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail["code"], "leetcode_username_required")

    def test_old_handle_cache_is_not_returned_for_a_new_saved_username(self) -> None:
        self.client.tables["profiles"][0]["leetcode_username"] = "new_handle"
        self.client.tables["leetcode_stats"] = [
            {
                "user_id": str(USER_ID),
                "provider_username": "old_handle",
                "solved_total": 3,
                "easy_solved": 1,
                "medium_solved": 1,
                "hard_solved": 1,
                "submission_calendar": {},
                "contest_rating": None,
                "global_ranking": None,
                "solved_by_topic": None,
                "recent_submissions": None,
                "fetched_at": (NOW - timedelta(days=2)).isoformat(),
                "fetch_status": "success",
            }
        ]

        def fail(_username: str) -> LeetCodeStats:
            raise LeetCodeProviderError("profile_not_found", "Profile not found.", 404)

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            3600,
            fetcher=fail,
            now=NOW,
        )

        self.assertEqual(response_status, 404)
        self.assertIsNone(response.data)
        self.assertEqual(self.client.tables["leetcode_stats"][0]["provider_username"], "old_handle")


if __name__ == "__main__":
    unittest.main()
